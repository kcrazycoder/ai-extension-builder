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
  tier?: 'free' | 'pro';
}

export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { jobId, userId, prompt, templateId } = message.body;
    const db = this.env.EXTENSION_DB;
    const bucket = this.env.EXTENSION_STORAGE;

    console.log(`Processing job ${jobId} for user ${userId}`);

    if (message.body.tier === 'pro') {
      console.log(`[PRIORITY] Processing PRO user job: ${jobId}`);
    }

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
      const aiService = new AIService(
        this.env.AI,
        this.env.CEREBRAS_API_KEY,
        this.env.CEREBRAS_API_URL
      );


      let generationResult;
      if (message.body.tier === 'pro') {
        console.log('[JobProcessor] Using Multi-Inference (Best-of-3) for Pro User');
        generationResult = await aiService.generateRefinedExtension({
          prompt,
          userId,
          contextFiles,
          templateId,
        });
      } else {
        console.log('[JobProcessor] Using Single-Shot Inference (Standard) for Free User');
        generationResult = await aiService.generateExtension({
          prompt,
          userId,
          contextFiles,
          templateId,
        });
      }

      const files = generationResult.files;
      const usage = generationResult.usage;

      // FORCE VERSION 0.1.0 for new projects
      if (!message.body.parentId && files['manifest.json']) {
        const rawManifest = files['manifest.json'] as string;
        console.log(
          `[Version Check] Checking new project version. ParentId: ${message.body.parentId}`
        );
        try {
          const manifest = JSON.parse(rawManifest);
          if (manifest.version !== '0.1.0') {
            console.log(`[Version Check] Enforcing version 0.1.0 (Was: ${manifest.version})`);
            manifest.version = '0.1.0';
            files['manifest.json'] = JSON.stringify(manifest, null, 2);
          }
        } catch (e) {
          console.warn('[Version Check] Failed to parse manifest for version check', e);
          if (rawManifest.includes('"version":')) {
            files['manifest.json'] = rawManifest.replace(
              /"version"\s*:\s*"[^"]*"/,
              '"version": "0.1.0"'
            );
          }
        }
      }

      // 3b. VERIFICATION (Sandbox)
      let verificationResult = { success: false, logs: [] as string[] };
      try {
        console.log('[Verification] Skipping Sandbox check (Edge Compatibility)...');
        // Dynamic import to avoid strict dependency on puppeteer in non-compatible envs
        // const { SandboxRunner } = await import('../testing/sandbox');
        // verificationResult = await SandboxRunner.validateFiles(files);
        // console.log(`[Verification] Result: ${verificationResult.success ? 'PASS' : 'FAIL'}`);
        // if (!verificationResult.success) {
        //   console.warn('[Verification Logs]', verificationResult.logs);
        // }
      } catch (vError) {
        console.warn('[Verification] Skipped or Failed to load SandboxRunner:', vError);
      }

      // 4. Extract Metadata & Cleanup
      let version = '0.1.0';
      let name: string | undefined;
      let description: string | undefined;
      let summary: string | undefined;

      try {
        // Extract summary from files special key
        if (files['summary']) {
          summary = files['summary'] as string;
          // Remove summary from files before zipping
          delete files['summary'];
        }

        if (files['manifest.json']) {
          const manifest = JSON.parse(files['manifest.json']);
          if (manifest.version) version = manifest.version;
          if (manifest.name) name = manifest.name;
          if (manifest.description) description = manifest.description;
        }

        // Fallback for description
        if (!description) {
          description = summary || 'No description available';
        }

        // Tag summary with verification status
        if (verificationResult.success && summary) {
          summary = `[Verified] ${summary}`;
        } else if (verificationResult.success) {
          summary = '[Verified] No summary provided.';
        }
      } catch (e) {
        console.warn('Failed to parse metadata from manifest', e);
      }

      // 5. Add LICENSE if missing
      if (!files['LICENSE'] && !files['LICENSE.md'] && !files['LICENSE.txt']) {
        files['LICENSE'] = `MIT License

Copyright (c) ${new Date().getFullYear()} Extension Author

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
      }

      // 6. Create ZIP archive
      const archiverService = new ArchiverService();
      const zipBuffer = await archiverService.createZip(files);

      // 7. Upload to SmartBucket
      const zipKey = `extensions/${userId}/${jobId}.zip`;
      await storageService.uploadZip(zipKey, zipBuffer);

      // 8. Update status to completed
      await dbService.updateExtensionStatus(jobId, {
        status: 'completed',
        zipKey,
        version,
        name,
        description,
        summary,
        usageTokens: usage?.total_tokens,
        completedAt: new Date().toISOString(),
      });

      console.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);

      // Update status to failed using DatabaseService
      const dbService = new DatabaseService(this.env.EXTENSION_DB);
      await dbService.updateExtensionStatus(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
