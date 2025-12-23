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

        const VERSION_FILE = path.join(config.workDir, 'version');
        let lastModified = '';
        if (fs.existsSync(VERSION_FILE)) {
            lastModified = fs.readFileSync(VERSION_FILE, 'utf-8').trim();
        }
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
                            fs.writeFileSync(VERSION_FILE, newVersion);
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

                    // --- HOT RELOAD INJECTION ---
                    try {
                        const HOT_RELOAD_CODE = `
const EVENT_SOURCE_URL = 'http://localhost:3500/status';
let lastVersion = null;

setInterval(async () => {
    try {
        const res = await fetch(EVENT_SOURCE_URL);
        const data = await res.json();
        
        if (lastVersion && data.version !== lastVersion) {
            console.log('[Hot Reload] New version detected:', data.version);
            chrome.runtime.reload();
        }
        
        lastVersion = data.version;
    } catch (err) {
        // Build tool might be offline
    }
}, 1000);
console.log('[Hot Reload] Active');
`;
                        const hotReloadPath = path.join(DIST_DIR, 'hot-reload.js');
                        await fs.writeFile(hotReloadPath, HOT_RELOAD_CODE);

                        // Patch Manifest / Background
                        const manifestPath = path.join(DIST_DIR, 'manifest.json');
                        if (await fs.pathExists(manifestPath)) {
                            const manifest = await fs.readJson(manifestPath);

                            // MV3 Module Worker Strategy
                            if (manifest.manifest_version === 3 && manifest.background?.service_worker) {
                                const swPath = path.join(DIST_DIR, manifest.background.service_worker);
                                if (await fs.pathExists(swPath)) {
                                    const swContent = await fs.readFile(swPath, 'utf-8');
                                    // Prepend import
                                    await fs.writeFile(swPath, "import './hot-reload.js';\n" + swContent);
                                    await ctx.actions.runAction('core:log', { level: 'info', message: 'Injected Hot Reload script into background worker.' });
                                }
                            }
                            // MV2 Scripts Strategy (Fallback if user generates MV2)
                            else if (manifest.background?.scripts) {
                                manifest.background.scripts.push('hot-reload.js');
                                await fs.writeJson(manifestPath, manifest, { spaces: 2 });
                                await ctx.actions.runAction('core:log', { level: 'info', message: 'Injected Hot Reload script into background scripts.' });
                            }
                        }
                    } catch (injectErr: any) {
                        await ctx.actions.runAction('core:log', { level: 'error', message: `Hot Reload Injection Failed: ${injectErr.message}` });
                    }
                    // ----------------------------

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
