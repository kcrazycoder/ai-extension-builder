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
