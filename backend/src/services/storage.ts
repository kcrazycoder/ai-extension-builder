// Storage Service - SmartBuckets abstraction layer
import type { R2Bucket, R2Object } from '@cloudflare/workers-types';

export class StorageService {
    constructor(private bucket: any) { } // Using any for Raindrop SmartBucket compatibility

    /**
     * Upload a ZIP file to storage
     */
    async uploadZip(key: string, data: Uint8Array): Promise<void> {
        await this.bucket.put(key, data, {
            httpMetadata: {
                contentType: 'application/zip'
            }
        });
    }

    /**
     * Get a ZIP file from storage
     */
    async getZip(key: string): Promise<R2Object | null> {
        return await this.bucket.get(key);
    }

    /**
     * Download ZIP file content as ArrayBuffer
     */
    async downloadZip(key: string): Promise<ArrayBuffer | null> {
        const object = await this.bucket.get(key);
        if (!object) return null;
        return await object.arrayBuffer();
    }

    /**
     * Delete a ZIP file from storage
     */
    async deleteZip(key: string): Promise<void> {
        await this.bucket.delete(key);
    }

    /**
     * Check if a ZIP file exists
     */
    async zipExists(key: string): Promise<boolean> {
        const object = await this.bucket.head(key);
        return object !== null;
    }

    /**
     * List ZIP files with a prefix (e.g., user-specific)
     */
    async listZips(prefix?: string, limit: number = 100): Promise<string[]> {
        const listed = await this.bucket.list({
            prefix,
            limit
        });

        return listed.objects.map((obj: any) => obj.key);
    }

    /**
     * Get ZIP file metadata
     */
    async getZipMetadata(key: string): Promise<{
        size: number;
        uploaded: Date;
    } | null> {
        const object = await this.bucket.head(key);

        if (!object) return null;

        return {
            size: object.size,
            uploaded: object.uploaded
        };
    }

    /**
     * Delete multiple ZIP files
     */
    async deleteMultipleZips(keys: string[]): Promise<void> {
        await Promise.all(keys.map(key => this.bucket.delete(key)));
    }
}
