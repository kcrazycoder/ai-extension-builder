// SmartMemory Service - User context and preferences
import type { KVNamespace } from '@cloudflare/workers-types';

export interface UserPreferences {
    theme?: 'light' | 'dark';
    defaultModel?: string;
    emailNotifications?: boolean;
    maxHistoryItems?: number;
}

export interface UserContext {
    userId: string;
    preferences: UserPreferences;
    stats: {
        totalGenerations: number;
        lastGeneratedAt?: string;
    };
    recentPrompts: string[];
}

export class MemoryService {
    constructor(private memory: any) { } // Using any for Raindrop SmartMemory compatibility

    private getUserKey(userId: string, suffix: string): string {
        return `user:${userId}:${suffix}`;
    }

    /**
     * Get user preferences
     */
    async getUserPreferences(userId: string): Promise<UserPreferences> {
        try {
            const key = this.getUserKey(userId, 'preferences');

            // SmartMemory might use different method names
            const data = this.memory.get
                ? await this.memory.get(key, 'json')
                : this.memory.read
                    ? await this.memory.read(key)
                    : null;

            if (data && typeof data === 'string') {
                return JSON.parse(data);
            }

            return data || {
                theme: 'light',
                emailNotifications: true,
                maxHistoryItems: 50
            };
        } catch (error) {
            console.error('Error getting user preferences:', error);
            return {
                theme: 'light',
                emailNotifications: true,
                maxHistoryItems: 50
            };
        }
    }

    /**
     * Update user preferences
     */
    async updateUserPreferences(
        userId: string,
        preferences: Partial<UserPreferences>
    ): Promise<void> {
        const key = this.getUserKey(userId, 'preferences');
        const current = await this.getUserPreferences(userId);
        const updated = { ...current, ...preferences };

        await this.memory.put(key, JSON.stringify(updated));
    }

    /**
     * Get user context (preferences + stats)
     */
    async getUserContext(userId: string): Promise<UserContext> {
        const preferences = await this.getUserPreferences(userId);
        const stats = await this.getUserStats(userId);
        const recentPrompts = await this.getRecentPrompts(userId);

        return {
            userId,
            preferences,
            stats,
            recentPrompts
        };
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId: string): Promise<{
        totalGenerations: number;
        lastGeneratedAt?: string;
    }> {
        const key = this.getUserKey(userId, 'stats');
        const data = await this.memory.get(key, 'json');

        return (data as any) || {
            totalGenerations: 0
        };
    }

    /**
     * Update user statistics
     */
    async updateUserStats(userId: string, increment: boolean = true): Promise<void> {
        const key = this.getUserKey(userId, 'stats');
        const current = await this.getUserStats(userId);

        const updated = {
            totalGenerations: increment ? current.totalGenerations + 1 : current.totalGenerations,
            lastGeneratedAt: new Date().toISOString()
        };

        await this.memory.put(key, JSON.stringify(updated));
    }

    /**
     * Get recent prompts (last 10)
     */
    async getRecentPrompts(userId: string, limit: number = 10): Promise<string[]> {
        const key = this.getUserKey(userId, 'recent-prompts');
        const data = await this.memory.get(key, 'json');

        return (data as string[]) || [];
    }

    /**
     * Add a prompt to recent prompts
     */
    async addRecentPrompt(userId: string, prompt: string): Promise<void> {
        const key = this.getUserKey(userId, 'recent-prompts');
        const current = await this.getRecentPrompts(userId);

        // Add to beginning, remove duplicates, limit to 10
        const updated = [prompt, ...current.filter(p => p !== prompt)].slice(0, 10);

        await this.memory.put(key, JSON.stringify(updated));
    }

    /**
     * Clear user's recent prompts
     */
    async clearRecentPrompts(userId: string): Promise<void> {
        const key = this.getUserKey(userId, 'recent-prompts');
        await this.memory.delete(key);
    }

    /**
     * Store session data (temporary, with TTL)
     */
    async setSessionData(
        userId: string,
        sessionId: string,
        data: any,
        ttlSeconds: number = 3600
    ): Promise<void> {
        const key = `session:${userId}:${sessionId}`;
        await this.memory.put(key, JSON.stringify(data), {
            expirationTtl: ttlSeconds
        });
    }

    /**
     * Get session data
     */
    async getSessionData(userId: string, sessionId: string): Promise<any | null> {
        const key = `session:${userId}:${sessionId}`;
        return await this.memory.get(key, 'json');
    }

    /**
     * Delete session data
     */
    async deleteSessionData(userId: string, sessionId: string): Promise<void> {
        const key = `session:${userId}:${sessionId}`;
        await this.memory.delete(key);
    }

    /**
     * Clear all user data (GDPR compliance)
     */
    async clearUserData(userId: string): Promise<void> {
        const keys = [
            this.getUserKey(userId, 'preferences'),
            this.getUserKey(userId, 'stats'),
            this.getUserKey(userId, 'recent-prompts')
        ];

        await Promise.all(keys.map(key => this.memory.delete(key)));
    }
}
