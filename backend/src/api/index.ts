import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { authMiddleware, getAuthUser } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { GenerateRequestSchema, JobIdSchema, safeValidateRequest } from '../validation/schemas';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../services/types';
import { DatabaseService } from '../services/db';
import { MemoryService } from '../services/memory';
import { StorageService } from '../services/storage';
import { R2Bucket } from '@cloudflare/workers-types';
import { createQueueAdapter } from '../config/queue';

// Simple Rate Limiter Middleware
// Token Bucket Rate Limiter Middleware
const createRateLimiter = (kv: any, capacity: number = 60, refillRate: number = 1) => {
  return async (c: any, next: any) => {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const key = `rate_limit_v2:${ip}`; // Changed key to v2 to avoid conflicts with old format

    interface Bucket {
      tokens: number;
      lastRefill: number;
    }

    // Get current bucket state
    const now = Date.now() / 1000; // seconds
    let bucket: Bucket;

    try {
      const data = await kv.get(key);
      if (data) {
        bucket = JSON.parse(data);
        // Refill tokens
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = timePassed * refillRate;
        bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      } else {
        bucket = { tokens: capacity, lastRefill: now };
      }
    } catch {
      bucket = { tokens: capacity, lastRefill: now };
    }

    // Consume token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      // Save state
      await kv.put(key, JSON.stringify(bucket), { expirationTtl: 86400 });
      await next();
    } else {
      const waitTime = Math.ceil((1 - bucket.tokens) / refillRate);
      c.header('Retry-After', waitTime.toString());
      return c.json({ error: 'Too many requests' }, 429);
    }
  };
};

// Define context variables type for authenticated routes
type Variables = {
  user: {
    id: string;
    email: string;
  };
};

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Add request logging middleware
app.use('*', logger());

// Rate Limiting Middleware
app.use('/api/*', async (c, next) => {
  // Only apply if KV is available (it might not be in dev/test sometimes)
  if (c.env.RATE_LIMITER) {
    const limiter = createRateLimiter(c.env.RATE_LIMITER);
    return limiter(c, next);
  }
  await next();
});

// CORS - Configure for production with custom headers
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow requests from configured frontend URL or localhost for development
      const allowedOrigins = ['https://www.browser-tools.com', 'https://browser-tools.com'];
      if (allowedOrigins.includes(origin || '')) {
        return origin || '*';
      }
      return '*'; // Allow all for now, can restrict later
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'x-user-id'],
    exposeHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'Content-Disposition'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
  })
);

// Health check endpoint (public)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// === Public Auth Routes ===

// Login endpoint - redirects to WorkOS AuthKit
app.get('/auth/login', async (c) => {
  try {
    const { AuthService } = await import('../services/auth');
    const authService = new AuthService(
      c.env.WORKOS_API_KEY,
      c.env.WORKOS_CLIENT_ID,
      c.env.WORKOS_COOKIE_PASSWORD
    );

    const redirectUri = c.env.WORKOS_REDIRECT_URI;
    const url = await authService.getAuthorizationUrl(redirectUri);

    return c.redirect(url);
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Failed to initialize login' }, 500);
  }
});

// Auth Callback endpoint
app.get('/auth/callback', async (c) => {
  try {
    const code = c.req.query('code');

    if (!code) {
      return c.json({ error: 'No code provided' }, 400);
    }

    const { AuthService } = await import('../services/auth');
    const authService = new AuthService(
      c.env.WORKOS_API_KEY,
      c.env.WORKOS_CLIENT_ID,
      c.env.WORKOS_COOKIE_PASSWORD
    );
    const { user, accessToken } = await authService.authenticateWithCode(code);

    // Redirect to frontend with token
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
    return c.redirect(`${frontendUrl}/?token=${accessToken}&userId=${user.id}&email=${user.email}`);
  } catch (error) {
    console.error('Callback error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// === PREVIEW TOOL AUTH (Device Flow) ===

// Init Session (Tool calls this)
app.post('/api/preview/init', async (c) => {
  try {
    console.log('[DEBUG] Request headers:', c.req.header());
    console.log('[DEBUG] Content-Type:', c.req.header('content-type'));

    let port: number | undefined;
    try {
      const body = await c.req.json();
      console.log('[DEBUG] Parsed body:', body);
      port = body.port; // Port from preview tool (optional)
    } catch (e) {
      // Body might be empty, that's ok
      console.log('[DEBUG] Failed to parse body:', e);
      console.log('No body in /preview/init request');
    }

    console.log('[DEBUG] Port value:', port);

    const sessionId = uuidv4();
    const code = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4-char code
    const mem = c.env.mem;

    // Store Code -> Session mapping (TTL 10 mins)
    await mem.put(`preview:code:${code}`, sessionId, { expirationTtl: 600 });

    // Store Session -> Status with port (if provided)
    await mem.put(`preview:session:${sessionId}`, JSON.stringify({
      status: 'pending',
      port: port
    }), { expirationTtl: 600 });

    return c.json({ code, sessionId });
  } catch (error) {
    console.error('Preview Init error:', error);
    return c.json({ error: 'Failed to init session', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Link Session (User calls this from Frontend)
app.post('/api/preview/link', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    console.log('[DEBUG Link] User authenticated:', user.id);

    const body = await c.req.json();
    console.log('[DEBUG Link] Body received');

    const code = body.code?.toUpperCase();
    const jobId = body.jobId;
    const mem = c.env.mem;

    if (!code) return c.json({ error: 'Code required' }, 400);

    const sessionId = await mem.get(`preview:code:${code}`);
    console.log('[DEBUG Link] Session lookup for code:', code, '->', sessionId);

    if (!sessionId) {
      return c.json({ error: 'Invalid or expired code' }, 404);
    }

    // Invalidate code (one-time use)
    await mem.delete(`preview:code:${code}`);

    // Get session data to extract port
    const sessionDataStr = await mem.get(`preview:session:${sessionId}`);
    const sessionData = sessionDataStr ? JSON.parse(sessionDataStr) : {};

    console.log('[DEBUG Link] Session data retrieved:', sessionData);

    // Update Session
    // Generate JWT token for preview tool
    console.log('[DEBUG Link] Generating JWT...');

    const { sign } = await import('hono/jwt');
    const jwtSecret = (c.env as any).JWT_SECRET as string;

    if (!jwtSecret) {
      console.error('[CRITICAL] JWT_SECRET is missing in handler');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    const token = await sign(
      {
        id: user.id,
        email: user.email,
        type: 'preview-session'
      },
      jwtSecret
    );
    console.log('[DEBUG Link] JWT generated');

    await mem.put(`preview:session:${sessionId}`, JSON.stringify({
      ...sessionData,
      status: 'linked',
      userId: user.id,
      email: user.email,
      jobId: jobId,
      token: token,
      linkedAt: new Date().toISOString()
    }), { expirationTtl: 3600 * 24 }); // 24 hours validity

    return c.json({
      success: true,
      port: sessionData.port // Return port to frontend
    });
  } catch (error) {
    console.error('Preview Link error:', error);
    return c.json({ error: 'Failed to link session' }, 500);
  }
});

// Check Status (Tool polls this)
app.get('/api/preview/status/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) return c.json({ error: 'Session ID required' }, 400);

    const mem = c.env.mem;

    const data = await mem.get(`preview:session:${sessionId}`);
    if (!data) return c.json({ status: 'expired' });

    const session = JSON.parse(data);
    console.log('[DEBUG] Returning session status:', { status: session.status, userId: session.userId, jobId: session.jobId });
    return c.json(session);
  } catch (error) {
    console.error('Preview Status error:', error);
    return c.json({ error: 'Failed to check status' }, 500);
  }
});

// === Protected API Routes (require authentication) ===

// Generate Suggestions (New)
app.get('/api/suggestions', authMiddleware, async (c) => {
  try {
    const { AIService } = await import('../services/ai');
    // Pass AI binding and legacy keys (optional)
    const aiService = new AIService(c.env.AI, c.env.CEREBRAS_API_KEY, c.env.CEREBRAS_API_URL);

    // Default to 3 suggestions to keep it fast
    const rawSuggestions = await aiService.generateSuggestions(3);
    const suggestions = rawSuggestions.map((s) => ({ ...s, isAi: true }));

    return c.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    // Return empty list on error to not break UI
    return c.json({ suggestions: [] });
  }
});

// Generate Extension
app.post('/api/generate', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    const body = await c.req.json();

    // Validate request
    const validation = safeValidateRequest(GenerateRequestSchema, body);
    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        400
      );
    }

    const { prompt, parentId, retryFromId } = validation.data;
    const dbService = new DatabaseService(c.env.EXTENSION_DB);

    // USAGE LIMIT CHECK - Handled atomically in createExtension
    const tier = await dbService.getUserTier(user.id);
    // Removed old limit check block to prevent race condition

    // RETRY LOGIC VALIDATION
    if (retryFromId) {
      // 1. Direct DB Validation (Replacing brittle "last 20" check)
      const targetValidation = await dbService.getExtension(retryFromId, user.id);

      if (!targetValidation) {
        return c.json({ error: 'Retry target not found' }, 404);
      }

      if (targetValidation.status !== 'failed') {
        return c.json({ error: 'Can only retry failed generations' }, 400);
      }

      // 2. Strict "Latest" Check via DB
      // Use hasNewerSibling to ensure no newer item exists with the same parent
      const parentId = targetValidation.parentId || null;

      // FIX: If parentId is null, these are independent root conversations.
      // We should NOT block retrying an old failed root just because a newer root exists.
      // This check only applies to non-root items (linear history within a chat).
      if (parentId !== null) {
        const createdAt = targetValidation.createdAt || '';
        const hasNewer = await dbService.hasNewerSibling(user.id, parentId, createdAt);

        if (hasNewer) {
          return c.json(
            { error: 'Can only retry the latest failed generation in this conversation' },
            400
          );
        }
      }
    }

    let jobId: string;
    let timestamp: string;

    if (retryFromId) {
      // REUSE EXISTING ID
      jobId = retryFromId;
      timestamp = new Date().toISOString(); // Update timestamp? Or keep original? Original creation time should stay.
      // We don't update creation timestamp in DB, but we need timestamp for the Job object if used?
      // The job processor uses it for logging maybe.
      // Let's use current time for the Job payload so the queue sees it as fresh work.
      timestamp = new Date().toISOString();

      // Reset status to pending and clear error
      await dbService.updateExtensionStatus(jobId, {
        status: 'pending',
        error: null,
      });

      console.log(`Retrying job ${jobId}`);
    } else {
      // NEW GENERATION
      jobId = uuidv4();
      timestamp = new Date().toISOString();

      try {
        await dbService.createExtension({
          id: jobId,
          userId: user.id,
          prompt,
          parentId,
          timestamp,
          dailyLimit: tier === 'free' ? 5 : undefined
        });
      } catch (err: any) {
        if (err.message === 'Daily limit reached') {
          return c.json(
            {
              error: 'Daily limit reached',
              message: 'You have reached your daily limit of 5 extensions. Please upgrade to Pro for unlimited access.',
            },
            403
          );
        }
        throw err;
      }
    }

    const job = {
      jobId,
      userId: user.id,
      prompt,
      parentId,
      timestamp,
      tier: tier // Pass tier for priority processing
    };

    // Update user stats and recent prompts in SmartMemory
    // TODO: Fix SmartMemory API - currently disabled to unblock generation
    // const memoryService = new MemoryService(c.env.USER_CONTEXT);
    // await Promise.all([
    //   memoryService.updateUserStats(user.id, true),
    //   memoryService.addRecentPrompt(user.id, prompt)
    // ]);

    // Send to queue (internal queue)
    const queueAdapter = createQueueAdapter(c.env.GENERATION_QUEUE);
    await queueAdapter.sendJob(job);

    return c.json(
      {
        success: true,
        jobId,
        message: 'Extension generation started',
        status: 'pending',
      },
      202
    );
  } catch (error) {
    console.error('Generation error:', error);

    return c.json(
      {
        error: 'Failed to start generation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// Get Job Status
app.get('/api/jobs/:id', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    const jobId = c.req.param('id');

    // Validate job ID format
    const validation = safeValidateRequest(JobIdSchema, jobId);
    if (!validation.success) {
      return c.json({ error: 'Invalid job ID format' }, 400);
    }

    const dbService = new DatabaseService(c.env.EXTENSION_DB);
    const extension = await dbService.getExtension(jobId, user.id);

    if (!extension) {
      return c.json({ error: 'Job not found' }, 404);
    }

    let progressMessage = `Status: ${extension.status}`;
    let queuePosition = undefined;
    let estimatedWaitSeconds = undefined;

    if (extension.status === 'pending' || extension.status === 'processing') {
      const position = await dbService.getQueuePosition(extension.createdAt);
      queuePosition = position;
      // Estimate: 30 seconds per job ahead
      estimatedWaitSeconds = position * 30;

      if (extension.status === 'pending') {
        progressMessage = `Queued (Position #${position})`;
      } else {
        progressMessage = 'Generating files...';
      }
    }

    if (extension.status === 'completed') progressMessage = 'Generation complete!';
    if (extension.status === 'failed') progressMessage = `Failed: ${extension.error}`;

    return c.json({
      ...extension,
      queue_position: queuePosition,
      estimated_wait_seconds: estimatedWaitSeconds,
      progress_message: progressMessage,
    });
  } catch (error) {
    console.error('Get job status error:', error);
    return c.json({ error: 'Failed to get job status' }, 500);
  }
});

// Download Extension
app.get('/api/download/:id', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    const jobId = c.req.param('id');

    // Validate job ID format
    const validation = safeValidateRequest(JobIdSchema, jobId);
    if (!validation.success) {
      return c.json({ error: 'Invalid job ID format' }, 400);
    }

    const dbService = new DatabaseService(c.env.EXTENSION_DB);
    const extension = await dbService.getExtension(jobId, user.id);

    if (!extension || !extension.zipKey) {
      return c.json({ error: 'Extension not found or not ready' }, 404);
    }

    const bucket = c.env.EXTENSION_STORAGE;
    const file = await bucket.get(extension.zipKey);

    if (!file) {
      return c.json({ error: 'File not found in storage' }, 404);
    }

    // Generate kebab-case filename
    const name = extension.name || 'extension';
    const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const version = extension.version || '0.1.0';
    const filename = `${safeName}-v${version}.zip`;

    return new Response(file.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return c.json({ error: 'Failed to download file' }, 500);
  }
});

// Get History
app.get('/api/history', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    const dbService = new DatabaseService(c.env.EXTENSION_DB);

    const extensions = await dbService.getUserExtensions(user.id, 50);

    return c.json({
      success: true,
      extensions,
    });
  } catch (error) {
    console.error('History error:', error);
    return c.json({ error: 'Failed to get history' }, 500);
  }
});

// Delete Conversation
app.delete('/api/conversations/:id', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    const targetId = c.req.param('id');
    const dbService = new DatabaseService(c.env.EXTENSION_DB);
    const storageService = new StorageService(c.env.EXTENSION_STORAGE as unknown as R2Bucket);

    // 1. Fetch user's extensions (using a larger limit to ensure we get the full tree if possible)
    // In a real app, we'd need a better way to traverse up/down without fetching everything
    const allExtensions = await dbService.getUserExtensions(user.id, 1000);

    // 2. Verify the target exists and belongs to user
    const targetExt = allExtensions.find((e) => e.id === targetId);
    if (!targetExt) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // 3. Find root of the conversation
    let root = targetExt;
    while (root.parentId) {
      const parent = allExtensions.find((e) => e.id === root.parentId);
      if (parent) root = parent;
      else break; // Orphaned or parent not in fetched set
    }

    // 4. Find all descendants (the whole conversation tree)
    const toDelete: string[] = []; // IDs
    const typesToDelete: { id: string; zipKey?: string }[] = [];

    // Simple BFS/DFS to find all connected nodes starting from root
    // Since we only have parent pointers, we have to scan the list.
    // Given the small scale (1000 items), this is fine.

    // First, find all nodes that trace back to this root
    const conversationNodes = allExtensions.filter((ext) => {
      let curr = ext;
      while (curr.parentId) {
        if (curr.id === root.id) return true; // It IS the root (caught below) or loops back?
        // Check if curr is root
        const parent = allExtensions.find((e) => e.id === curr.parentId);
        if (!parent) return false; // Broken chain
        curr = parent;
      }
      return curr.id === root.id;
    });

    // Add valid nodes to delete list
    conversationNodes.forEach((node) => {
      typesToDelete.push({ id: node.id, zipKey: node.zipKey });
    });

    // 5. Delete ZIPs from storage
    const zipKeys = typesToDelete.map((t) => t.zipKey).filter((k) => k !== undefined) as string[];
    if (zipKeys.length > 0) {
      await storageService.deleteMultipleZips(zipKeys);
    }

    // 6. Delete records from DB
    // We do this concurrently or largely sequentially
    await Promise.all(typesToDelete.map((t) => dbService.deleteExtension(t.id)));

    return c.json({
      success: true,
      deletedCount: typesToDelete.length,
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return c.json({ error: 'Failed to delete conversation' }, 500);
  }
});

// User Stats
app.get('/api/user/stats', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    const dbService = new DatabaseService(c.env.EXTENSION_DB);

    const [stats, subscription, dailyUsage] = await Promise.all([
      dbService.getUserStats(user.id),
      dbService.getUserSubscription(user.id),
      dbService.getDailyUsageCount(user.id)
    ]);

    const tier = subscription?.tier || 'free';
    const limit = tier === 'free' ? 5 : -1; // -1 indicates unlimited

    return c.json({
      success: true,
      stats,
      tier,
      dailyUsage,
      limit,
      subscriptionStatus: subscription?.subscriptionStatus || null,
      nextBillingDate: subscription?.currentPeriodEnd || null,
    });
  } catch (error) {
    console.error('User stats error:', error);
    return c.json({ error: 'Failed to get user stats' }, 500);
  }
});

// === Admin Routes ===

// Admin Stats
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (c) => {
  try {
    const dbService = new DatabaseService(c.env.EXTENSION_DB);
    const stats = await dbService.getSystemStats();
    return c.json({ success: true, stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    return c.json({ error: 'Failed to fetch admin stats' }, 500);
  }
});

// Admin Users List
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;
    const dbService = new DatabaseService(c.env.EXTENSION_DB);
    const users = await dbService.getAllUsers(limit, offset);
    return c.json({ success: true, users });
  } catch (error) {
    console.error('Admin users error:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Admin Update User Role
app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, async (c) => {
  try {
    const userId = c.req.param('id');
    const { role } = await c.req.json();

    if (role !== 'user' && role !== 'admin') {
      return c.json({ error: 'Invalid role' }, 400);
    }

    const dbService = new DatabaseService(c.env.EXTENSION_DB);
    await dbService.updateUserRole(userId, role);
    return c.json({ success: true });
  } catch (error) {
    console.error('Admin update role error:', error);
    return c.json({ error: 'Failed to update user role' }, 500);
  }
});

// Create Checkout Session
app.post('/api/create-checkout-session', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    const { PaymentService } = await import('../services/payment');
    const paymentService = new PaymentService(c.env);

    // Ensure we have the user record
    const dbService = new DatabaseService(c.env.EXTENSION_DB);
    await dbService.upsertUser({ id: user.id, email: user.email });

    const session = await paymentService.createCheckoutSession({
      userId: user.id,
      email: user.email,
      successUrl: `${c.env.FRONTEND_URL}/dashboard?success=true`,
      cancelUrl: `${c.env.FRONTEND_URL}/dashboard?canceled=true`,
    });

    return c.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// Verify Payment Session (Fallback/Manual Check)
app.get('/api/payment/verify/:sessionId', authMiddleware, async (c) => {
  try {
    const user = getAuthUser(c);
    const sessionId = c.req.param('sessionId');

    if (!sessionId) {
      return c.json({ error: 'Session ID required' }, 400);
    }

    const { PaymentService } = await import('../services/payment');
    const paymentService = new PaymentService(c.env);

    // Verify with Stripe
    const sessionFn = await paymentService.verifySession(sessionId);

    // Security check: ensure this session belongs to the user
    if (sessionFn.userId && sessionFn.userId !== user.id) {
      return c.json({ error: 'Unauthorized session verification' }, 403);
    }

    const dbService = new DatabaseService(c.env.EXTENSION_DB);

    // If paid, update DB (idempotent operation)
    if (sessionFn.paymentStatus === 'paid') {
      try {
        // We might need to fetch the subscription details if it's a sub
        // But for now, if 'paid' and mode was subscription, we can assume active/pro
        // However, the best way is to fetch the customer/sub from Stripe or rely on the fact 
        // that if checkout is paid, they are at least provisionally pro.
        // Let's do a reliable update:

        if (sessionFn.customerId) {
          await dbService.upsertUser({
            id: user.id,
            email: sessionFn.email || user.email,
            stripeCustomerId: sessionFn.customerId as string
          });

          await dbService.updateSubscription({
            stripeCustomerId: sessionFn.customerId as string,
            status: 'active', // Safely assume active if just paid
            tier: 'pro',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Fallback estimate
          });

          // Ideally we would fetch the subscription object from Stripe to get the exact period end
          // But verifySession implementation above only fetches the session. 
          // For a quick fix/verification, this is acceptable. The webhook will eventually correct the date.
        }
      } catch (err) {
        console.error('Failed to update DB during verification', err);
        // Don't fail the request, just log. The frontend just wants to know "is it paid?"
      }
    }

    return c.json({
      status: sessionFn.status,
      paymentStatus: sessionFn.paymentStatus,
      verified: true
    });

  } catch (error) {
    console.error('Verification error:', error);
    return c.json({ error: 'Failed to verify session' }, 500);
  }
});

// Stripe Webhook
app.post('/api/webhook/stripe', async (c) => {
  try {
    const sig = c.req.header('stripe-signature');
    const body = await c.req.text();

    if (!sig) return c.json({ error: 'Missing signature' }, 400);

    const { PaymentService } = await import('../services/payment');
    const paymentService = new PaymentService(c.env);

    let event;
    try {
      event = await paymentService.constructEvent(body, sig);
    } catch (err) {
      console.error('Webhook signature verification failed', err);
      return c.json({ error: 'Webhook signature verification failed' }, 400);
    }

    const dbService = new DatabaseService(c.env.EXTENSION_DB);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const userId = session.metadata?.userId || session.client_reference_id;
      const customerId = session.customer;

      if (userId && customerId) {
        await dbService.upsertUser({
          id: userId,
          email: session.customer_details?.email,
          stripeCustomerId: customerId
        });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const subscription = event.data.object as any;
      const status = subscription.status;
      const customerId = subscription.customer as string;
      const tier = status === 'active' ? 'pro' : 'free';
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

      await dbService.updateSubscription({
        stripeCustomerId: customerId,
        status,
        tier,
        currentPeriodEnd,
      });
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook handler failed' }, 500);
  }
});

// Config endpoint (public, for debugging)
app.get('/api/config', (c) => {
  return c.json({
    hasEnv: !!c.env,
    services: {
      db: !!c.env.EXTENSION_DB,
      storage: !!c.env.EXTENSION_STORAGE,
      queue: !!c.env.GENERATION_QUEUE,
      ai: !!c.env.CEREBRAS_API_KEY,
    },
  });
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
