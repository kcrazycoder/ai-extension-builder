// StorageService Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from './storage';

describe('StorageService', () => {
    let storageService: StorageService;
    let mockBucket: any;

    beforeEach(() => {
        mockBucket = {
            put: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            head: vi.fn(),
            list: vi.fn()
        };
        storageService = new StorageService(mockBucket);
    });

    describe('uploadZip', () => {
        it('should upload ZIP file with correct metadata', async () => {
            mockBucket.put.mockResolvedValue(undefined);
            const zipData = new Uint8Array([1, 2, 3, 4]);

            await storageService.uploadZip('test-key.zip', zipData);

            expect(mockBucket.put).toHaveBeenCalledWith(
                'test-key.zip',
                zipData,
                {
                    httpMetadata: {
                        contentType: 'application/zip'
                    }
                }
            );
        });
    });

    describe('getZip', () => {
        it('should retrieve ZIP file', async () => {
            const mockFile = { body: new Uint8Array([1, 2, 3]) };
            mockBucket.get.mockResolvedValue(mockFile);

            const result = await storageService.getZip('test-key.zip');

            expect(result).toEqual(mockFile);
            expect(mockBucket.get).toHaveBeenCalledWith('test-key.zip');
        });

        it('should return null for non-existent file', async () => {
            mockBucket.get.mockResolvedValue(null);

            const result = await storageService.getZip('non-existent.zip');

            expect(result).toBeNull();
        });
    });

    describe('deleteZip', () => {
        it('should delete ZIP file', async () => {
            mockBucket.delete.mockResolvedValue(undefined);

            await storageService.deleteZip('test-key.zip');

            expect(mockBucket.delete).toHaveBeenCalledWith('test-key.zip');
        });
    });

    describe('zipExists', () => {
        it('should return true if ZIP exists', async () => {
            mockBucket.head.mockResolvedValue({ size: 1024 });

            const result = await storageService.zipExists('test-key.zip');

            expect(result).toBe(true);
            expect(mockBucket.head).toHaveBeenCalledWith('test-key.zip');
        });

        it('should return false if ZIP does not exist', async () => {
            mockBucket.head.mockResolvedValue(null);

            const result = await storageService.zipExists('non-existent.zip');

            expect(result).toBe(false);
        });
    });

    describe('listZips', () => {
        it('should list ZIPs without prefix', async () => {
            const mockObjects = {
                objects: [
                    { key: 'file1.zip' },
                    { key: 'file2.zip' }
                ]
            };
            mockBucket.list.mockResolvedValue(mockObjects);

            const result = await storageService.listZips();

            expect(result).toEqual(['file1.zip', 'file2.zip']);
            expect(mockBucket.list).toHaveBeenCalledWith({
                prefix: undefined,
                limit: 100
            });
        });

        it('should list ZIPs with prefix', async () => {
            const mockObjects = {
                objects: [
                    { key: 'user-123/file1.zip' },
                    { key: 'user-123/file2.zip' }
                ]
            };
            mockBucket.list.mockResolvedValue(mockObjects);

            const result = await storageService.listZips('user-123/', 50);

            expect(result).toEqual(['user-123/file1.zip', 'user-123/file2.zip']);
            expect(mockBucket.list).toHaveBeenCalledWith({
                prefix: 'user-123/',
                limit: 50
            });
        });
    });

    describe('getZipMetadata', () => {
        it('should return metadata for existing ZIP', async () => {
            const mockMetadata = {
                size: 2048,
                uploaded: new Date('2024-01-01T00:00:00Z')
            };
            mockBucket.head.mockResolvedValue(mockMetadata);

            const result = await storageService.getZipMetadata('test-key.zip');

            expect(result).toEqual({
                size: 2048,
                uploaded: new Date('2024-01-01T00:00:00Z')
            });
        });

        it('should return null for non-existent ZIP', async () => {
            mockBucket.head.mockResolvedValue(null);

            const result = await storageService.getZipMetadata('non-existent.zip');

            expect(result).toBeNull();
        });
    });

    describe('deleteMultipleZips', () => {
        it('should delete multiple ZIP files', async () => {
            mockBucket.delete.mockResolvedValue(undefined);

            await storageService.deleteMultipleZips(['file1.zip', 'file2.zip', 'file3.zip']);

            expect(mockBucket.delete).toHaveBeenCalledTimes(3);
            expect(mockBucket.delete).toHaveBeenCalledWith('file1.zip');
            expect(mockBucket.delete).toHaveBeenCalledWith('file2.zip');
            expect(mockBucket.delete).toHaveBeenCalledWith('file3.zip');
        });

        it('should handle empty array', async () => {
            await storageService.deleteMultipleZips([]);

            expect(mockBucket.delete).not.toHaveBeenCalled();
        });
    });
});
