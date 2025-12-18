import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import ora from 'ora';
import https from 'https';

let checkInterval: NodeJS.Timeout;

export const DownloaderPlugin: PluginDefinition = {
    name: 'downloader',
    version: '1.0.0',
    setup(ctx: RuntimeContext) {
        const config = ctx.host.config as any;
        const DIST_DIR = path.join(config.workDir, 'dist');
        const DOWNLOAD_PATH = path.join(config.workDir, 'extension.zip');

        const rawToken = config.token ? String(config.token) : '';
        const token = rawToken.replace(/^Bearer\s+/i, '').trim();

        // Auto-extract user ID from token if not provided
        let userId = config.user;
        if (!userId && token) {
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                    userId = payload.id || payload.sub || payload.userId;
                    // Add cleanup logging
                    if (userId) ctx.actions.runAction('core:log', { level: 'info', message: `Extracted User ID: ${userId}` });
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        const client = axios.create({
            baseURL: config.host,
            headers: {
                'Authorization': token ? `Bearer ${token}` : undefined,
                'X-User-Id': userId
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });

        let lastModified = '';
        let isChecking = false;

        // Action: Check Status
        ctx.actions.registerAction({
            id: 'downloader:check',
            handler: async () => {
                if (isChecking) return true; // Skip if busy
                isChecking = true;

                try {
                    const res = await client.get(`/jobs/${config.jobId}`);
                    const job = res.data;
                    const newVersion = job.version;

                    // If no version in job yet, fall back to timestamp or ignore
                    if (!newVersion && !lastModified) {
                        // First run, just verify it exists
                        // We might want to download anyway if we don't have it locally
                    }

                    if (job.status === 'completed' && newVersion !== lastModified) {
                        await ctx.actions.runAction('core:log', { level: 'info', message: `New version detected (Old: "${lastModified}", New: "${newVersion}")` });

                        const success = await ctx.actions.runAction('downloader:download', null);
                        if (success) {
                            lastModified = newVersion;
                            ctx.events.emit('downloader:updated', { version: job.version });
                        }
                    }
                    isChecking = false;
                    return true;
                } catch (error: any) {
                    isChecking = false;
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Check failed: ${error.message}` });
                    // Return false only on actual error, so index.ts knows to fail
                    return true;
                }
            }
        });

        // Action: Download
        ctx.actions.registerAction({
            id: 'downloader:download',
            handler: async () => {
                const spinner = ora('Downloading new version...').start();
                try {
                    const response = await client.get(`/download/${config.jobId}`, {
                        responseType: 'arraybuffer'
                    });

                    await fs.ensureDir(config.workDir);
                    await fs.writeFile(DOWNLOAD_PATH, response.data);

                    await fs.emptyDir(DIST_DIR);
                    const zip = new AdmZip(DOWNLOAD_PATH);
                    zip.extractAllTo(DIST_DIR, true);

                    spinner.succeed('Updated extension code!');
                    return true;
                } catch (error: any) {
                    spinner.fail(`Failed to download: ${error.message}`);
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Download failed: ${error.message}` });
                    return false;
                }
            }
        });

        // Start Polling (Loop)
        const scheduleNextCheck = () => {
            checkInterval = setTimeout(async () => {
                if (!checkInterval) return; // Disposed
                await ctx.actions.runAction('downloader:check', null);
                scheduleNextCheck();
            }, 2000);
        };

        scheduleNextCheck();
    },
    dispose(ctx) {
        if (checkInterval) {
            clearTimeout(checkInterval);
            checkInterval = undefined as any;
        }
    }
};
