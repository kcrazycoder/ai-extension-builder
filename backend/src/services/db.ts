// Database Service - SmartSQL abstraction layer
import type { D1Database, D1Result } from '@cloudflare/workers-types';
import type { Extension } from './types';

export interface CreateExtensionData {
    id: string;
    userId: string;
    prompt: string;
    parentId?: string;
    timestamp: string;
}

export interface UpdateExtensionStatusData {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    zipKey?: string;
    error?: string;
    completedAt?: string;
    version?: string;
}

export class DatabaseService {
    constructor(private db: any) { } // Using any for Raindrop SqlDatabase compatibility

    /**
     * Create a new extension record
     */
    async createExtension(data: CreateExtensionData): Promise<void> {
        await this.db.prepare(
            `INSERT INTO extensions (id, user_id, prompt, parent_id, status, created_at) 
       VALUES (?, ?, ?, ?, 'pending', ?)`
        ).bind(data.id, data.userId, data.prompt, data.parentId || null, data.timestamp).run();
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
            created_at: row.created_at || row.createdAt,
            completedAt: row.completed_at || row.completedAt,
            error: row.error
        };
    }

    /**
     * Get extension by ID and user ID (user-scoped)
     */
    async getExtension(id: string, userId: string): Promise<Extension | null> {
        const result = await this.db.prepare(
            `SELECT * FROM extensions WHERE id = ? AND user_id = ?`
        ).bind(id, userId).first();

        return result ? this.mapToExtension(result) : null;
    }

    /**
     * Get extension by ID (admin access, no user scope)
     */
    async getExtensionById(id: string): Promise<Extension | null> {
        const result = await this.db.prepare(
            `SELECT * FROM extensions WHERE id = ?`
        ).bind(id).first();

        return result ? this.mapToExtension(result) : null;
    }

    /**
     * Update extension status
     */
    async updateExtensionStatus(
        id: string,
        data: UpdateExtensionStatusData
    ): Promise<void> {
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

        values.push(id);

        await this.db.prepare(
            `UPDATE extensions SET ${fields.join(', ')} WHERE id = ?`
        ).bind(...values).run();
    }

    /**
     * Get user's extensions with pagination
     */
    async getUserExtensions(
        userId: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<Extension[]> {
        const result = await this.db.prepare(
            `SELECT * FROM extensions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
        ).bind(userId, limit, offset).all();

        return (result.results || []).map((row: any) => this.mapToExtension(row));
    }

    /**
     * Get extension by ZIP key
     */
    async getExtensionByZipKey(zipKey: string): Promise<Extension | null> {
        const result = await this.db.prepare(
            `SELECT * FROM extensions WHERE zip_key = ?`
        ).bind(zipKey).first();

        return result ? this.mapToExtension(result) : null;
    }

    /**
     * Delete extension (admin only)
     */
    async deleteExtension(id: string): Promise<void> {
        await this.db.prepare(
            `DELETE FROM extensions WHERE id = ?`
        ).bind(id).run();
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId: string): Promise<{
        total: number;
        completed: number;
        failed: number;
        pending: number;
    }> {
        const result = await this.db.prepare(
            `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 ELSE 0 END) as pending
       FROM extensions 
       WHERE user_id = ?`
        ).bind(userId).first();

        return {
            total: result?.total || 0,
            completed: result?.completed || 0,
            failed: result?.failed || 0,
            pending: result?.pending || 0
        };
    }
}
