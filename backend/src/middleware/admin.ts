import { Context, Next } from 'hono';
import { Env } from '../api/raindrop.gen';
import { DatabaseService } from '../services/db';
import { AuthenticationError } from '../services/types';
import { getAuthUser } from './auth';

type Variables = {
    user: any; // Using any or importing WorkOSUser to avoid complex import cycles if not needed
    role: string;
};

export async function adminMiddleware(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
) {
    try {
        // 1. Ensure user is authenticated first
        const user = getAuthUser(c);

        // 2. Check role in DB
        const db = new DatabaseService(c.env.EXTENSION_DB);
        const profile = await db.getUserProfile(user.id);

        if (!profile || profile.role !== 'admin') {
            return c.json({ error: 'Forbidden: Admin access required' }, 403);
        }

        // 3. Attach role to context (optional, but helpful)
        c.set('role', 'admin');

        await next();
    } catch (error) {
        if (error instanceof AuthenticationError) {
            return c.json({ error: 'Authentication required' }, 401);
        }
        console.error('Admin middleware error:', error);
        return c.json({ error: 'Internal server error checking permissions' }, 500);
    }
}
