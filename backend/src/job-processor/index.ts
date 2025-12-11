import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { AIService } from '../services/ai';
import { ArchiverService } from '../services/archiver';
import { DatabaseService } from '../services/db';
import { StorageService } from '../services/storage';

// Define the job body type
export interface Body {
  jobId: string;
  userId: string;
  prompt: string;
  parentId?: string;
  timestamp: string;
  templateId?: string;
}

export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { jobId, userId, prompt, templateId } = message.body;
    const db = this.env.EXTENSION_DB;
    const bucket = this.env.EXTENSION_STORAGE;

    console.log(`Processing job ${jobId} for user ${userId}`);

    try {
      // Initialize services
      const dbService = new DatabaseService(this.env.EXTENSION_DB);
      const storageService = new StorageService(this.env.EXTENSION_STORAGE);

      // 1. Update status to processing
      await dbService.updateExtensionStatus(jobId, { status: 'processing' });

      // 2. Prepare context if parentId exists
      let contextFiles;
      if (message.body.parentId) {
        console.log(`Fetching parent context: ${message.body.parentId}`);
        try {
          const parent = await dbService.getExtensionById(message.body.parentId);
          if (parent && parent.zipKey) {
            const parentZip = await storageService.downloadZip(parent.zipKey);
            if (parentZip) {
              const archiver = new ArchiverService();
              contextFiles = await archiver.extractFiles(parentZip);
              console.log('Parent context loaded');
            }
          }
        } catch (ctxError) {
          console.warn('Failed to load parent context, proceeding with fresh generation', ctxError);
        }
      }

      // 3. Generate extension files using Cerebras (with LiquidMetal binding passed for compatibility)
      const aiService = new AIService(this.env.AI, this.env.CEREBRAS_API_KEY, this.env.CEREBRAS_API_URL);
      const files = await aiService.generateExtension({ prompt, userId, contextFiles, templateId });

      // 3. Create ZIP archive
      const archiverService = new ArchiverService();
      const zipBuffer = await archiverService.createZip(files);

      // 4. Upload to SmartBucket using StorageService
      const zipKey = `extensions/${userId}/${jobId}.zip`;
      await storageService.uploadZip(zipKey, zipBuffer);

      // Extract version, name, description, and summary
      let version = '0.1.0';
      let name: string | undefined;
      let description: string | undefined;
      let summary: string | undefined;

      try {
        // Extract summary from files special key
        if (files['summary']) {
          summary = files['summary'] as string;
          // Remove summary from files before zipping to avoid including it in the zip
          delete files['summary'];
        }

        if (files['manifest.json']) {
          const manifest = JSON.parse(files['manifest.json']);
          if (manifest.version) {
            version = manifest.version;
          }
          if (manifest.name) {
            name = manifest.name;
          }
          if (manifest.description) {
            description = manifest.description;
          }
        }

        // Fallback for description if missing in manifest
        if (!description) {
          if (summary) {
            description = summary;
          } else {
            description = 'No description available';
          }
        }
      } catch (e) {
        console.warn('Failed to parse metadata from manifest', e);
      }

      // 5. Update status to completed using DatabaseService
      await dbService.updateExtensionStatus(jobId, {
        status: 'completed',
        zipKey,
        version,
        name,
        description,
        summary,
        completedAt: new Date().toISOString()
      });

      console.log(`Job ${jobId} completed successfully`);

    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);

      // Update status to failed using DatabaseService
      const dbService = new DatabaseService(this.env.EXTENSION_DB);
      await dbService.updateExtensionStatus(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
