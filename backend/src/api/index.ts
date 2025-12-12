import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { authMiddleware, getAuthUser } from '../middleware/auth';
import {
  GenerateRequestSchema,
  JobIdSchema,
  safeValidateRequest
} from '../validation/schemas';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../services/types';
import { DatabaseService } from '../services/db';
import { MemoryService } from '../services/memory';
import { StorageService } from '../services/storage';
import { R2Bucket } from '@cloudflare/workers-types';
import { createQueueAdapter } from '../config/queue';

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

// CORS - Configure for production with custom headers
app.use('*', cors({
  origin: (origin) => {
    // Allow requests from configured frontend URL or localhost for development
    const allowedOrigins = [
      'https://www.browser-tools.com',
      'https://browser-tools.com'
    ];
    if (allowedOrigins.includes(origin || '')) {
      return origin || '*';
    }
    return '*'; // Allow all for now, can restrict later
  },
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'x-user-id'],
  exposeHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // Cache preflight for 24 hours
}));

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

// === Protected API Routes (require authentication) ===

// Generate Suggestions (New)
app.get('/api/suggestions', authMiddleware, async (c) => {
  try {
    const { AIService } = await import('../services/ai');
    // Pass AI binding and legacy keys (optional)
    const aiService = new AIService(c.env.AI, c.env.CEREBRAS_API_KEY, c.env.CEREBRAS_API_URL);

    // Default to 3 suggestions to keep it fast
    const rawSuggestions = await aiService.generateSuggestions(3);
    const suggestions = rawSuggestions.map(s => ({ ...s, isAi: true }));

    return c.json({
      success: true,
      suggestions
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
      return c.json({
        error: 'Validation failed',
        details: validation.error.errors
      }, 400);
    }

    const { prompt, parentId, retryFromId } = validation.data;
    const dbService = new DatabaseService(c.env.EXTENSION_DB);

    // RETRY LOGIC VALIDATION
    if (retryFromId) {
      // 1. Fetch recent history to validate context
      // We fetch slightly more to ensure we cover the siblings context
      const recentExtensions = await dbService.getUserExtensions(user.id, 20);

      const targetValidation = recentExtensions.find(e => e.id === retryFromId);

      if (!targetValidation) {
        return c.json({ error: 'Retry target not found in recent history' }, 404);
      }

      if (targetValidation.status !== 'failed') {
        return c.json({ error: 'Can only retry failed generations' }, 400);
      }

      // 2. Strict "Latest" Check
      // We must ensure no OTHER extension exists that has the same parentId (sibling) 
      // AND was created AFTER this one.
      // OR if it's a root node, ensure no other root node was created after it? 
      // usually "latest" means "latest in this conversation branch".

      // Let's filter for siblings (same parentId)
      const siblings = recentExtensions.filter(e => e.parentId === targetValidation.parentId);

      // Sort by creation date DESC (newest first)
      const sortedSiblings = siblings.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // The target MUST be the first one in this sorted list
      const latestSibling = sortedSiblings[0];
      if (!latestSibling || latestSibling.id !== retryFromId) {
        return c.json({ error: 'Can only retry the latest failed generation in this conversation' }, 400);
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
        error: null
      });

      console.log(`Retrying job ${jobId}`);

    } else {
      // NEW GENERATION
      jobId = uuidv4();
      timestamp = new Date().toISOString();

      await dbService.createExtension({
        id: jobId,
        userId: user.id,
        prompt,
        parentId,
        timestamp
      });
    }

    const job = {
      jobId,
      userId: user.id,
      prompt,
      parentId,
      timestamp
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

    return c.json({
      success: true,
      jobId,
      message: 'Extension generation started',
      status: 'pending'
    }, 202);

  } catch (error) {
    console.error('Generation error:', error);

    return c.json({
      error: 'Failed to start generation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
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
    if (extension.status === 'pending') progressMessage = 'Queued...';
    if (extension.status === 'processing') progressMessage = 'Generating files...';
    if (extension.status === 'completed') progressMessage = 'Generation complete!';
    if (extension.status === 'failed') progressMessage = `Failed: ${extension.error}`;

    return c.json({
      ...extension,
      progress_message: progressMessage
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

    return new Response(file.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="extension-${jobId}.zip"`,
      }
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
      extensions
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
    const targetExt = allExtensions.find(e => e.id === targetId);
    if (!targetExt) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // 3. Find root of the conversation
    let root = targetExt;
    while (root.parentId) {
      const parent = allExtensions.find(e => e.id === root.parentId);
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
    const conversationNodes = allExtensions.filter(ext => {
      let curr = ext;
      while (curr.parentId) {
        if (curr.id === root.id) return true; // It IS the root (caught below) or loops back?
        // Check if curr is root
        const parent = allExtensions.find(e => e.id === curr.parentId);
        if (!parent) return false; // Broken chain
        curr = parent;
      }
      return curr.id === root.id;
    });

    // Add valid nodes to delete list
    conversationNodes.forEach(node => {
      typesToDelete.push({ id: node.id, zipKey: node.zipKey });
    });

    // 5. Delete ZIPs from storage
    const zipKeys = typesToDelete.map(t => t.zipKey).filter(k => k !== undefined) as string[];
    if (zipKeys.length > 0) {
      await storageService.deleteMultipleZips(zipKeys);
    }

    // 6. Delete records from DB
    // We do this concurrently or largely sequentially
    await Promise.all(typesToDelete.map(t => dbService.deleteExtension(t.id)));

    return c.json({
      success: true,
      deletedCount: typesToDelete.length
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    return c.json({ error: 'Failed to delete conversation' }, 500);
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
      ai: !!c.env.CEREBRAS_API_KEY
    }
  });
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
