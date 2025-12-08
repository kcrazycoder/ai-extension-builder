// Queue Configuration Tests - Simplified for Internal Queue Only
import { describe, it, expect, vi } from 'vitest';
import { createQueueAdapter } from './queue';

describe('Queue Configuration', () => {
    describe('createQueueAdapter', () => {
        it('should create internal queue adapter', () => {
            const mockInternalQueue = {
                send: vi.fn()
            };

            const adapter = createQueueAdapter(mockInternalQueue);

            expect(adapter).toBeDefined();
            expect(typeof adapter.sendJob).toBe('function');
        });

        it('should throw error when internal queue not provided', () => {
            expect(() => createQueueAdapter(null)).toThrow(
                'Internal queue not provided'
            );
        });
    });

    describe('InternalQueueAdapter', () => {
        it('should send job to internal queue', async () => {
            const mockInternalQueue = {
                send: vi.fn().mockResolvedValue(undefined)
            };

            const adapter = createQueueAdapter(mockInternalQueue);

            const job = {
                jobId: 'test-123',
                userId: 'user-456',
                prompt: 'Test prompt',
                timestamp: '2024-01-01T00:00:00Z'
            };

            await adapter.sendJob(job);

            expect(mockInternalQueue.send).toHaveBeenCalledWith(job);
        });
    });
});
