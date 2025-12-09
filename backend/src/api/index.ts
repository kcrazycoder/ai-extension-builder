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
      'https://extn.netlify.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    if (allowedOrigins.includes(origin || '') || origin?.endsWith('.netlify.app')) {
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

    const { prompt, parentId } = validation.data;
    const jobId = uuidv4();
    const timestamp = new Date().toISOString();
    const job = {
      jobId,
      userId: user.id,
      prompt,
      parentId,
      timestamp
    };

    // Store initial status in DB using DatabaseService
    const dbService = new DatabaseService(c.env.EXTENSION_DB);
    await dbService.createExtension({
      id: jobId,
      userId: user.id,
      prompt,
      parentId,
      timestamp
    });

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
