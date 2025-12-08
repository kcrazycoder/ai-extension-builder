// MemoryService Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryService } from './memory';

describe('MemoryService', () => {
    let memoryService: MemoryService;
    let mockMemory: any;

    beforeEach(() => {
        mockMemory = {
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn()
        };
        memoryService = new MemoryService(mockMemory);
    });

    describe('getUserPreferences', () => {
        it('should return stored preferences', async () => {
            const mockPrefs = {
                theme: 'dark',
                emailNotifications: true,
                maxHistoryItems: 100
            };
            mockMemory.get.mockResolvedValue(mockPrefs);

            const result = await memoryService.getUserPreferences('user-123');

            expect(result).toEqual(mockPrefs);
            expect(mockMemory.get).toHaveBeenCalledWith('user:user-123:preferences', 'json');
        });

        it('should return defaults when no preferences stored', async () => {
            mockMemory.get.mockResolvedValue(null);

            const result = await memoryService.getUserPreferences('user-123');

            expect(result).toEqual({
                theme: 'light',
                emailNotifications: true,
                maxHistoryItems: 50
            });
        });
    });

    describe('updateUserPreferences', () => {
        it('should merge and update preferences', async () => {
            const currentPrefs = {
                theme: 'light',
                emailNotifications: true,
                maxHistoryItems: 50
            };
            mockMemory.get.mockResolvedValue(currentPrefs);
            mockMemory.put.mockResolvedValue(undefined);

            await memoryService.updateUserPreferences('user-123', {
                theme: 'dark'
            });

            expect(mockMemory.put).toHaveBeenCalledWith(
                'user:user-123:preferences',
                JSON.stringify({
                    theme: 'dark',
                    emailNotifications: true,
                    maxHistoryItems: 50
                })
            );
        });
    });

    describe('getUserContext', () => {
        it('should return complete user context', async () => {
            mockMemory.get
                .mockResolvedValueOnce({ theme: 'dark' }) // preferences
                .mockResolvedValueOnce({ totalGenerations: 5, lastGeneratedAt: '2024-01-01' }) // stats
                .mockResolvedValueOnce(['prompt1', 'prompt2']); // recent prompts

            const result = await memoryService.getUserContext('user-123');

            expect(result).toEqual({
                userId: 'user-123',
                preferences: { theme: 'dark' },
                stats: { totalGenerations: 5, lastGeneratedAt: '2024-01-01' },
                recentPrompts: ['prompt1', 'prompt2']
            });
        });
    });

    describe('getUserStats', () => {
        it('should return stored stats', async () => {
            const mockStats = {
                totalGenerations: 10,
                lastGeneratedAt: '2024-01-01T00:00:00Z'
            };
            mockMemory.get.mockResolvedValue(mockStats);

            const result = await memoryService.getUserStats('user-123');

            expect(result).toEqual(mockStats);
        });

        it('should return defaults when no stats', async () => {
            mockMemory.get.mockResolvedValue(null);

            const result = await memoryService.getUserStats('user-123');

            expect(result).toEqual({
                totalGenerations: 0
            });
        });
    });

    describe('updateUserStats', () => {
        it('should increment total generations', async () => {
            mockMemory.get.mockResolvedValue({ totalGenerations: 5 });
            mockMemory.put.mockResolvedValue(undefined);

            await memoryService.updateUserStats('user-123', true);

            const putCall = mockMemory.put.mock.calls[0];
            const savedData = JSON.parse(putCall[1]);

            expect(savedData.totalGenerations).toBe(6);
            expect(savedData.lastGeneratedAt).toBeDefined();
        });

        it('should not increment when increment is false', async () => {
            mockMemory.get.mockResolvedValue({ totalGenerations: 5 });
            mockMemory.put.mockResolvedValue(undefined);

            await memoryService.updateUserStats('user-123', false);

            const putCall = mockMemory.put.mock.calls[0];
            const savedData = JSON.parse(putCall[1]);

            expect(savedData.totalGenerations).toBe(5);
        });
    });

    describe('getRecentPrompts', () => {
        it('should return stored prompts', async () => {
            const mockPrompts = ['prompt1', 'prompt2', 'prompt3'];
            mockMemory.get.mockResolvedValue(mockPrompts);

            const result = await memoryService.getRecentPrompts('user-123');

            expect(result).toEqual(mockPrompts);
        });

        it('should return empty array when no prompts', async () => {
            mockMemory.get.mockResolvedValue(null);

            const result = await memoryService.getRecentPrompts('user-123');

            expect(result).toEqual([]);
        });

        it('should support custom limit', async () => {
            const mockPrompts = ['p1', 'p2', 'p3', 'p4', 'p5'];
            mockMemory.get.mockResolvedValue(mockPrompts);

            await memoryService.getRecentPrompts('user-123', 5);

            expect(mockMemory.get).toHaveBeenCalledWith('user:user-123:recent-prompts', 'json');
        });
    });

    describe('addRecentPrompt', () => {
        it('should add new prompt to beginning', async () => {
            mockMemory.get.mockResolvedValue(['old1', 'old2']);
            mockMemory.put.mockResolvedValue(undefined);

            await memoryService.addRecentPrompt('user-123', 'new prompt');

            const putCall = mockMemory.put.mock.calls[0];
            const savedData = JSON.parse(putCall[1]);

            expect(savedData[0]).toBe('new prompt');
            expect(savedData).toHaveLength(3);
        });

        it('should remove duplicates', async () => {
            mockMemory.get.mockResolvedValue(['prompt1', 'prompt2', 'prompt3']);
            mockMemory.put.mockResolvedValue(undefined);

            await memoryService.addRecentPrompt('user-123', 'prompt2');

            const putCall = mockMemory.put.mock.calls[0];
            const savedData = JSON.parse(putCall[1]);

            expect(savedData).toEqual(['prompt2', 'prompt1', 'prompt3']);
        });

        it('should limit to 10 prompts', async () => {
            const manyPrompts = Array.from({ length: 10 }, (_, i) => `prompt${i}`);
            mockMemory.get.mockResolvedValue(manyPrompts);
            mockMemory.put.mockResolvedValue(undefined);

            await memoryService.addRecentPrompt('user-123', 'new prompt');

            const putCall = mockMemory.put.mock.calls[0];
            const savedData = JSON.parse(putCall[1]);

            expect(savedData).toHaveLength(10);
            expect(savedData[0]).toBe('new prompt');
        });
    });

    describe('clearRecentPrompts', () => {
        it('should delete recent prompts', async () => {
            mockMemory.delete.mockResolvedValue(undefined);

            await memoryService.clearRecentPrompts('user-123');

            expect(mockMemory.delete).toHaveBeenCalledWith('user:user-123:recent-prompts');
        });
    });

    describe('setSessionData', () => {
        it('should store session data with TTL', async () => {
            mockMemory.put.mockResolvedValue(undefined);

            await memoryService.setSessionData('user-123', 'session-456', { data: 'test' }, 7200);

            expect(mockMemory.put).toHaveBeenCalledWith(
                'session:user-123:session-456',
                JSON.stringify({ data: 'test' }),
                { expirationTtl: 7200 }
            );
        });

        it('should use default TTL of 3600 seconds', async () => {
            mockMemory.put.mockResolvedValue(undefined);

            await memoryService.setSessionData('user-123', 'session-456', { data: 'test' });

            const putCall = mockMemory.put.mock.calls[0];
            expect(putCall[2]).toEqual({ expirationTtl: 3600 });
        });
    });

    describe('getSessionData', () => {
        it('should retrieve session data', async () => {
            const mockData = { sessionInfo: 'test' };
            mockMemory.get.mockResolvedValue(mockData);

            const result = await memoryService.getSessionData('user-123', 'session-456');

            expect(result).toEqual(mockData);
            expect(mockMemory.get).toHaveBeenCalledWith('session:user-123:session-456', 'json');
        });

        it('should return null for expired session', async () => {
            mockMemory.get.mockResolvedValue(null);

            const result = await memoryService.getSessionData('user-123', 'session-456');

            expect(result).toBeNull();
        });
    });

    describe('deleteSessionData', () => {
        it('should delete session data', async () => {
            mockMemory.delete.mockResolvedValue(undefined);

            await memoryService.deleteSessionData('user-123', 'session-456');

            expect(mockMemory.delete).toHaveBeenCalledWith('session:user-123:session-456');
        });
    });

    describe('clearUserData', () => {
        it('should delete all user data (GDPR)', async () => {
            mockMemory.delete.mockResolvedValue(undefined);

            await memoryService.clearUserData('user-123');

            expect(mockMemory.delete).toHaveBeenCalledTimes(3);
            expect(mockMemory.delete).toHaveBeenCalledWith('user:user-123:preferences');
            expect(mockMemory.delete).toHaveBeenCalledWith('user:user-123:stats');
            expect(mockMemory.delete).toHaveBeenCalledWith('user:user-123:recent-prompts');
        });
    });
});
