// Database Service - SmartSQL abstraction layer
import type { D1Database, D1Result } from '@cloudflare/workers-types';
import type { Extension } from './types';

export interface CreateExtensionData {
  id: string;
  userId: string;
  prompt: string;
  parentId?: string;
  timestamp: string;
  dailyLimit?: number;
}

export interface UpdateExtensionStatusData {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  zipKey?: string;
  error?: string | null;
  completedAt?: string;
  version?: string;
  name?: string;
  description?: string;
  summary?: string;
  usageTokens?: number;
}

export class DatabaseService {
  constructor(private db: any) { } // Using any for Raindrop SqlDatabase compatibility

  /**
   * Create a new extension record
   */
  async createExtension(data: CreateExtensionData): Promise<void> {
    if (data.dailyLimit !== undefined) {
      // Atomic check-and-insert for rate limiting
      // We only insert if the count for today is less than the limit
      const result = await this.db
        .prepare(
          `INSERT INTO extensions (id, user_id, prompt, parent_id, status, created_at) 
           SELECT ?, ?, ?, ?, 'pending', ?
           WHERE (
             SELECT COUNT(*) 
             FROM extensions 
             WHERE user_id = ? 
             AND created_at >= date('now')
           ) < ?`
        )
        .bind(
          data.id,
          data.userId,
          data.prompt,
          data.parentId || null,
          data.timestamp,
          data.userId, // for subquery
          data.dailyLimit
        )
        .run();

      if (result.meta?.changes === 0) {
        throw new Error('Daily limit reached');
      }
    } else {
      // Standard insert (unlimited)
      await this.db
        .prepare(
          `INSERT INTO extensions (id, user_id, prompt, parent_id, status, created_at) 
           VALUES (?, ?, ?, ?, 'pending', ?)`
        )
        .bind(data.id, data.userId, data.prompt, data.parentId || null, data.timestamp)
        .run();
    }
  }

  /**
   * Helper to map DB result to Extension type
   */
  private mapToExtension(row: any): Extension {
    return {
      id: row.id,
      userId: row.user_id || row.userId,
      prompt: row.prompt,
      status: row.status,
      zipKey: row.zip_key || row.zipKey,
      parentId: row.parent_id || row.parentId,
      version: row.version,
      name: row.name,
      description: row.description,
      summary: row.summary,
      createdAt: row.created_at || row.createdAt,
      completedAt: row.completed_at || row.completedAt,
      error: row.error,
    };
  }

  /**
   * Get extension by ID and user ID (user-scoped)
   */
  async getExtension(id: string, userId: string): Promise<Extension | null> {
    const result = await this.db
      .prepare(`SELECT * FROM extensions WHERE id = ? AND user_id = ?`)
      .bind(id, userId)
      .first();

    return result ? this.mapToExtension(result) : null;
  }

  /**
   * Get extension by ID (admin access, no user scope)
   */
  async getExtensionById(id: string): Promise<Extension | null> {
    const result = await this.db.prepare(`SELECT * FROM extensions WHERE id = ?`).bind(id).first();

    return result ? this.mapToExtension(result) : null;
  }

  /**
   * Update extension status
   */
  async updateExtensionStatus(id: string, data: UpdateExtensionStatusData): Promise<void> {
    const fields: string[] = ['status = ?'];
    const values: any[] = [data.status];

    if (data.zipKey !== undefined) {
      fields.push('zip_key = ?');
      values.push(data.zipKey);
    }

    if (data.error !== undefined) {
      fields.push('error = ?');
      values.push(data.error);
    }

    if (data.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(data.completedAt);
    }

    if (data.version !== undefined) {
      fields.push('version = ?');
      values.push(data.version);
    }

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }

    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }

    if (data.summary !== undefined) {
      fields.push('summary = ?');
      values.push(data.summary);
    }

    if (data.usageTokens !== undefined) {
      fields.push('usage_tokens = ?');
      values.push(data.usageTokens);
    }

    values.push(id);

    await this.db
      .prepare(`UPDATE extensions SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  /**
   * Get user's extensions with pagination
   */
  async getUserExtensions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Extension[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM extensions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
      )
      .bind(userId, limit, offset)
      .all();

    return (result.results || []).map((row: any) => this.mapToExtension(row));
  }

  /**
   * Get extension by ZIP key
   */
  async getExtensionByZipKey(zipKey: string): Promise<Extension | null> {
    const result = await this.db
      .prepare(`SELECT * FROM extensions WHERE zip_key = ?`)
      .bind(zipKey)
      .first();

    return result ? this.mapToExtension(result) : null;
  }

  /**
   * Delete extension (admin only)
   */
  async deleteExtension(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM extensions WHERE id = ?`).bind(id).run();
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    totalTokens: number;
    activity: { date: string; count: number }[];
  }> {
    const result = await this.db
      .prepare(
        `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 ELSE 0 END) as pending,
        SUM(COALESCE(usage_tokens, 0)) as total_tokens
       FROM extensions 
       WHERE user_id = ?`
      )
      .bind(userId)
      .first();

    return {
      total: result?.total || 0,
      completed: result?.completed || 0,
      failed: result?.failed || 0,
      pending: result?.pending || 0,
      totalTokens: result?.total_tokens || 0,
      activity: await this.getActivityStats(userId),
    };
  }

  /**
   * Get daily activity stats for the last 30 days
   */
  async getActivityStats(userId: string): Promise<{ date: string; count: number }[]> {
    // SQLite query to group by date
    // Note: D1/SQLite stores ISO strings, so substr(created_at, 1, 10) gives YYYY-MM-DD
    const results = await this.db
      .prepare(
        `SELECT 
          substr(created_at, 1, 10) as date,
          COUNT(*) as count
         FROM extensions
         WHERE user_id = ? 
           AND created_at >= date('now', '-30 days')
         GROUP BY date
         ORDER BY date ASC`
      )
      .bind(userId)
      .all();

    return (results.results || []).map((r: any) => ({
      date: r.date,
      count: r.count,
    }));
  }

  /**
   * Upsert user record (called on login/webhook)
   */
  async upsertUser(data: { id: string; email: string; stripeCustomerId?: string }): Promise<void> {
    // Check if user exists
    const existing = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(data.id).first();

    if (existing) {
      if (data.stripeCustomerId) {
        await this.db
          .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
          .bind(data.stripeCustomerId, data.id)
          .run();
      }
    } else {
      await this.db
        .prepare('INSERT INTO users (id, email, stripe_customer_id, role) VALUES (?, ?, ?, ?)')
        .bind(data.id, data.email, data.stripeCustomerId || null, 'user')
        .run();
    }
  }

  /**
   * Update subscription status from webhook
   */
  async updateSubscription(data: {
    stripeCustomerId: string;
    status: string;
    tier: string;
    currentPeriodEnd: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `UPDATE users 
         SET subscription_status = ?, tier = ?, current_period_end = ? 
         WHERE stripe_customer_id = ?`
      )
      .bind(data.status, data.tier, data.currentPeriodEnd, data.stripeCustomerId)
      .run();
  }

  /**
   * Get user tier (defaults to free)
   */
  async getUserTier(userId: string): Promise<'free' | 'pro'> {
    const user = await this.db.prepare('SELECT tier FROM users WHERE id = ?').bind(userId).first();
    return (user?.tier as 'free' | 'pro') || 'free';
  }

  /**
   * Get full user subscription details
   */
  async getUserSubscription(userId: string): Promise<{
    tier: 'free' | 'pro';
    subscriptionStatus: 'active' | 'canceled' | 'past_due' | null;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    role: 'user' | 'admin';
  } | null> {
    const user = await this.db
      .prepare('SELECT tier, subscription_status, current_period_end, stripe_customer_id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) return null;

    return {
      tier: (user.tier as 'free' | 'pro') || 'free',
      subscriptionStatus: user.subscription_status || null,
      currentPeriodEnd: user.current_period_end || null,
      stripeCustomerId: user.stripe_customer_id || null,
      role: (user.role as 'user' | 'admin') || 'user',
    };
  }

  /**
   * Get user profile with role
   */
  async getUserProfile(userId: string): Promise<{
    id: string;
    email: string;
    role: 'user' | 'admin';
  } | null> {
    const user = await this.db.prepare('SELECT id, email, role FROM users WHERE id = ?').bind(userId).first();
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      role: (user.role as 'user' | 'admin') || 'user',
    };
  }

  /**
   * ADMIN: Get system-wide statistics
   */
  async getSystemStats(): Promise<{
    totalUsers: number;
    totalExtensions: number;
    totalGenerations: number;
    activeUsersResult: number;
    extensionsByStatus: { status: string; count: number }[];
    recentActivity: { date: string; count: number }[];
  }> {
    // 1. Total Users
    const usersResult = await this.db.prepare('SELECT COUNT(*) as count FROM users').first();

    // 2. Total Extensions (Generations)
    const extResult = await this.db.prepare('SELECT COUNT(*) as count FROM extensions').first();

    // 3. Extensions by Status
    const statusResult = await this.db
      .prepare(`
        SELECT status, COUNT(*) as count 
        FROM extensions 
        GROUP BY status
      `)
      .all();

    // 4. Activity (Last 30 days)
    const activityResult = await this.db
      .prepare(`
        SELECT 
          substr(created_at, 1, 10) as date,
          COUNT(*) as count
        FROM extensions
        WHERE created_at >= date('now', '-30 days')
        GROUP BY date
        ORDER BY date ASC
      `)
      .all();

    return {
      totalUsers: usersResult?.count || 0,
      totalExtensions: extResult?.count || 0,
      totalGenerations: extResult?.count || 0, // Same as extensions for now
      activeUsersResult: 0, // Placeholder
      extensionsByStatus: (statusResult.results || []).map((r: any) => ({ status: r.status, count: r.count })),
      recentActivity: (activityResult.results || []).map((r: any) => ({ date: r.date, count: r.count })),
    };
  }

  /**
   * ADMIN: Get all users with pagination
   */
  async getAllUsers(limit: number = 50, offset: number = 0): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT id, email, role, tier, created_at, subscription_status 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `)
      .bind(limit, offset)
      .all();

    return result.results || [];
  }

  /**
   * ADMIN: Update user role
   */
  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    await this.db
      .prepare('UPDATE users SET role = ? WHERE id = ?')
      .bind(role, userId)
      .run();
  }

  /**
   * Get today's usage count for rate limiting
   */
  async getDailyUsageCount(userId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count 
         FROM extensions 
         WHERE user_id = ? 
         AND created_at >= date('now')`
      )
      .bind(userId)
      .first();
    return result?.count || 0;
  }

  /**
   * Check if there are any newer extensions with the same parentId (siblings)
   * Used for validating that a retry target is indeed the latest in its branch.
   */
  async hasNewerSibling(userId: string, parentId: string | null, createdAt: string): Promise<boolean> {
    const parentIdCondition = parentId === null ? 'parent_id IS NULL' : 'parent_id = ?';
    const params = parentId === null ? [userId, createdAt] : [parentId, userId, createdAt];

    const result = await this.db
      .prepare(
        `SELECT 1 
         FROM extensions 
         WHERE ${parentIdCondition}
         AND user_id = ? 
         AND created_at > ?
         LIMIT 1`
      )
      .bind(...params)
      .first();

    return !!result;
  }

  /**
   * Get position in queue (count of pending jobs created before this one)
   */
  async getQueuePosition(createdAt: string): Promise<number> {
    // We want to count how many 'pending' or 'processing' jobs exist that were created BEFORE or AT THE SAME TIME as this one
    // Excluding the job itself (so strictly less than, or <= count - 1)
    // Actually, simpler: Count all pending/processing jobs with created_at < this_job.created_at
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count 
         FROM extensions 
         WHERE (status = 'pending' OR status = 'processing')
         AND created_at < ?`
      )
      .bind(createdAt)
      .first();

    // Position is 1-indexed. If 0 jobs are ahead, you are #1.
    return (result?.count || 0) + 1;
  }
}
