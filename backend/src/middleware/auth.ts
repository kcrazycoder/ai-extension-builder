// Auth Middleware - Protect routes with WorkOS authentication
import { Context, Next } from 'hono';
import { Env } from '../api/raindrop.gen';
import { AuthService } from '../services/auth';
import { AuthenticationError, WorkOSUser } from '../services/types';

// Define context variables type
type Variables = {
  user: WorkOSUser;
};

/**
 * Middleware to verify authentication token and attach user to context
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  try {
    // 1. Preview Tool Auth (Strict JWT check on specific header)
    const previewToken = c.req.header('X-Preview-Token');
    if (previewToken) {
      try {
        const { verify } = await import('hono/jwt');
        // JWT_SECRET is not in Env interface (generated), so we cast
        const secret = (c.env as any).JWT_SECRET as string;
        if (!secret) throw new Error('JWT_SECRET not configured');

        const payload = await verify(previewToken, secret);

        // Trust the token payload
        c.set('user', {
          id: payload.id as string,
          email: payload.email as string,
          firstName: '',
          lastName: '',
          profilePictureUrl: '',
          emailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as unknown as WorkOSUser);

        await next();
        return;
      } catch (e) {
        console.error('Preview token verification failed:', e);
        return c.json({ error: 'Invalid preview token' }, 401);
      }
    }

    // 2. Legacy X-User-Id Auth (Slow, checks DB/WorkOS every time)
    // Extract userId from X-User-Id header (sent by frontend)
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      return c.json({ error: 'Missing user ID' }, 401);
    }

    // Validate user exists in WorkOS
    const authService = new AuthService(
      c.env.WORKOS_API_KEY,
      c.env.WORKOS_CLIENT_ID,
      c.env.WORKOS_COOKIE_PASSWORD
    );

    const user = await authService.getUser(userId);

    // Attach user to context
    c.set('user', user);

    await next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return c.json({ error: 'Authentication failed', message: error.message }, 401);
    }

    console.error('Auth middleware error:', error);
    return c.json({ error: 'Internal authentication error' }, 500);
  }
}

/**
 * Helper to get authenticated user from context
 */
export function getAuthUser(c: any): WorkOSUser {
  const user = c.get('user');
  if (!user) {
    throw new AuthenticationError('User not authenticated');
  }
  return user;
}
