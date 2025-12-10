// DatabaseService Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from './db';
import type { Extension } from './types';

describe('DatabaseService', () => {
    let dbService: DatabaseService;
    let mockDb: any;

    beforeEach(() => {
        // Create mock database
        mockDb = {
            prepare: vi.fn()
        };
        dbService = new DatabaseService(mockDb);
    });

    describe('createExtension', () => {
        it('should create a new extension record', async () => {
            const mockRun = vi.fn().mockResolvedValue({});
            const mockBind = vi.fn().mockReturnValue({ run: mockRun });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            await dbService.createExtension({
                id: 'test-id',
                userId: 'user-123',
                prompt: 'Test prompt',
                timestamp: '2024-01-01T00:00:00Z'
            });

            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO extensions')
            );
            expect(mockBind).toHaveBeenCalledWith('test-id', 'user-123', 'Test prompt', '2024-01-01T00:00:00Z');
            expect(mockRun).toHaveBeenCalled();
        });
    });

    describe('getExtension', () => {
        it('should return extension for valid user', async () => {
            const mockExtension: Extension = {
                id: 'test-id',
                userId: 'user-123',
                prompt: 'Test prompt',
                status: 'completed',
                zipKey: 'test.zip',
                created_at: '2024-01-01T00:00:00Z'
            };

            const mockFirst = vi.fn().mockResolvedValue(mockExtension);
            const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            const result = await dbService.getExtension('test-id', 'user-123');

            expect(result).toEqual(mockExtension);
            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM extensions WHERE id = ? AND user_id = ?')
            );
            expect(mockBind).toHaveBeenCalledWith('test-id', 'user-123');
        });

        it('should return null for non-existent extension', async () => {
            const mockFirst = vi.fn().mockResolvedValue(null);
            const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            const result = await dbService.getExtension('non-existent', 'user-123');

            expect(result).toBeNull();
        });
    });

    describe('getExtensionById', () => {
        it('should return extension without user scope', async () => {
            const mockExtension: Extension = {
                id: 'test-id',
                userId: 'user-123',
                prompt: 'Test prompt',
                status: 'completed',
                created_at: '2024-01-01T00:00:00Z'
            };

            const mockFirst = vi.fn().mockResolvedValue(mockExtension);
            const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            const result = await dbService.getExtensionById('test-id');

            expect(result).toEqual(mockExtension);
            expect(mockBind).toHaveBeenCalledWith('test-id');
        });
    });

    describe('updateExtensionStatus', () => {
        it('should update status only', async () => {
            const mockRun = vi.fn().mockResolvedValue({});
            const mockBind = vi.fn().mockReturnValue({ run: mockRun });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            await dbService.updateExtensionStatus('test-id', {
                status: 'processing'
            });

            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE extensions SET status = ? WHERE id = ?')
            );
            expect(mockBind).toHaveBeenCalledWith('processing', 'test-id');
        });

        it('should update status and zipKey', async () => {
            const mockRun = vi.fn().mockResolvedValue({});
            const mockBind = vi.fn().mockReturnValue({ run: mockRun });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            await dbService.updateExtensionStatus('test-id', {
                status: 'completed',
                zipKey: 'test.zip'
            });

            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE extensions SET')
            );
            expect(mockBind).toHaveBeenCalledWith('completed', 'test.zip', 'test-id');
        });

        it('should update status with error', async () => {
            const mockRun = vi.fn().mockResolvedValue({});
            const mockBind = vi.fn().mockReturnValue({ run: mockRun });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            await dbService.updateExtensionStatus('test-id', {
                status: 'failed',
                error: 'Generation failed'
            });

            expect(mockBind).toHaveBeenCalledWith('failed', 'Generation failed', 'test-id');
        });
    });

    describe('getUserExtensions', () => {
        it('should return user extensions with default pagination', async () => {
            const mockExtensions: Extension[] = [
                {
                    id: 'ext-1',
                    userId: 'user-123',
                    prompt: 'Prompt 1',
                    status: 'completed',
                    created_at: '2024-01-01T00:00:00Z'
                },
                {
                    id: 'ext-2',
                    userId: 'user-123',
                    prompt: 'Prompt 2',
                    status: 'pending',
                    created_at: '2024-01-02T00:00:00Z'
                }
            ];

            const mockAll = vi.fn().mockResolvedValue({ results: mockExtensions });
            const mockBind = vi.fn().mockReturnValue({ all: mockAll });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            const result = await dbService.getUserExtensions('user-123');

            expect(result).toEqual(mockExtensions);
            expect(mockBind).toHaveBeenCalledWith('user-123', 50, 0);
        });

        it('should support custom pagination', async () => {
            const mockAll = vi.fn().mockResolvedValue({ results: [] });
            const mockBind = vi.fn().mockReturnValue({ all: mockAll });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            await dbService.getUserExtensions('user-123', 10, 20);

            expect(mockBind).toHaveBeenCalledWith('user-123', 10, 20);
        });

        it('should return empty array when no results', async () => {
            const mockAll = vi.fn().mockResolvedValue({ results: null });
            const mockBind = vi.fn().mockReturnValue({ all: mockAll });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            const result = await dbService.getUserExtensions('user-123');

            expect(result).toEqual([]);
        });
    });

    describe('getExtensionByZipKey', () => {
        it('should return extension by ZIP key', async () => {
            const mockExtension: Extension = {
                id: 'test-id',
                userId: 'user-123',
                prompt: 'Test prompt',
                status: 'completed',
                zipKey: 'test.zip',
                created_at: '2024-01-01T00:00:00Z'
            };

            const mockFirst = vi.fn().mockResolvedValue(mockExtension);
            const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            const result = await dbService.getExtensionByZipKey('test.zip');

            expect(result).toEqual(mockExtension);
            expect(mockBind).toHaveBeenCalledWith('test.zip');
        });
    });

    describe('deleteExtension', () => {
        it('should delete extension by ID', async () => {
            const mockRun = vi.fn().mockResolvedValue({});
            const mockBind = vi.fn().mockReturnValue({ run: mockRun });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            await dbService.deleteExtension('test-id');

            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM extensions WHERE id = ?')
            );
            expect(mockBind).toHaveBeenCalledWith('test-id');
        });
    });

    describe('getUserStats', () => {
        it('should return user statistics', async () => {
            const mockStats = {
                total: 10,
                completed: 7,
                failed: 2,
                pending: 1
            };

            const mockFirst = vi.fn().mockResolvedValue(mockStats);
            const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            const result = await dbService.getUserStats('user-123');

            expect(result).toEqual(mockStats);
            expect(mockBind).toHaveBeenCalledWith('user-123');
        });

        it('should return zeros when no data', async () => {
            const mockFirst = vi.fn().mockResolvedValue(null);
            const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
            mockDb.prepare.mockReturnValue({ bind: mockBind });

            const result = await dbService.getUserStats('user-123');

            expect(result).toEqual({
                total: 0,
                completed: 0,
                failed: 0,
                pending: 0
            });
        });
    });
});
