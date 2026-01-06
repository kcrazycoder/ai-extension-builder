import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import ora from 'ora';
import https from 'https';
import { PreviewContext, PreviewConfig } from '../types.js';

let checkInterval: NodeJS.Timeout;

const DownloaderPlugin: PluginDefinition<PreviewConfig> = {
    name: 'downloader',
    version: '1.0.0',
    dependencies: ['config'],
    setup(ctx: RuntimeContext<PreviewConfig>) {
        // Helper to get paths dynamically
        const getPaths = () => {
            const workDir = ctx.config.workDir;
            return {
                DIST_DIR: path.join(workDir, 'dist'),
                DOWNLOAD_PATH: path.join(workDir, 'extension.zip'),
                VERSION_FILE: path.join(workDir, 'version')
            };
        };

        // Helper function to create axios client with current config
        const createClient = () => {
            const config = ctx.config;
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
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }

            ctx.logger.info(`[DEBUG] DownloaderPlugin creating client with userId: ${userId}`);

            return axios.create({
                baseURL: config.host,
                headers: {
                    'X-Preview-Token': token,
                    'X-User-Id': userId
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            });
        };

        let lastModified = '';
        let currentWorkDir = '';

        // Check initial state if workDir exists
        try {
            const { VERSION_FILE } = getPaths();
            if (fs.existsSync(VERSION_FILE)) {
                lastModified = fs.readFileSync(VERSION_FILE, 'utf-8').trim();
            }
        } catch (e) { }
        let isChecking = false;

        // Action: Check Status
        ctx.actions.registerAction({
            id: 'downloader:check',
            handler: async () => {
                if (isChecking) return true; // Skip if busy
                isChecking = true;
                const { jobId, workDir } = ctx.config;
                const { DIST_DIR, VERSION_FILE } = getPaths();

                // Reset lastModified if workDir changed
                if (workDir !== currentWorkDir) {
                    currentWorkDir = workDir;
                    lastModified = '';
                    if (fs.existsSync(VERSION_FILE)) {
                        lastModified = fs.readFileSync(VERSION_FILE, 'utf-8').trim();
                    }
                }

                await ctx.logger.info('Checking for updates...');
                const MAX_RETRIES = 3;
                let attempt = 0;

                while (attempt < MAX_RETRIES) {
                    try {
                        const client = createClient(); // Create client with current config
                        const res = await client.get(`/jobs/${jobId}`);
                        const job = res.data;
                        const newVersion = job.version;

                        // If no version in job yet, fall back to timestamp or ignore
                        if (!newVersion && !lastModified) {
                            // First run, just verify it exists
                        }

                        if (job.status === 'completed') {
                            // Check if files actually exist
                            let forceDownload = false;
                            const manifestPath = path.join(DIST_DIR, 'manifest.json');
                            if (!fs.existsSync(manifestPath)) {
                                await ctx.logger.warn('Version match but files missing. Forcing download...');
                                forceDownload = true;
                            }

                            if (newVersion !== lastModified || forceDownload) {
                                if (newVersion !== lastModified) {
                                    await ctx.logger.info(`New version detected (Old: "${lastModified}", New: "${newVersion}")`);
                                }

                                const success = await ctx.actions.runAction('downloader:download', null);
                                if (success) {
                                    lastModified = newVersion;
                                    fs.writeFileSync(VERSION_FILE, newVersion);
                                    ctx.events.emit('downloader:updated', { version: job.version, jobId: ctx.config.jobId });
                                }
                            }
                        } else {
                            // await ctx.actions.runAction('core:log', { level: 'info', message: `Poll: Job status is ${job.status}` });
                        }

                        isChecking = false;
                        return true;

                    } catch (error: any) {
                        attempt++;
                        const isNetworkError = error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';

                        if (attempt < MAX_RETRIES && isNetworkError) {
                            await ctx.logger.warn(`Connection failed (${error.code}). Retrying (${attempt}/${MAX_RETRIES})...`);
                            await new Promise(r => setTimeout(r, 1000 * attempt)); // Backoff
                            continue;
                        }

                        isChecking = false;
                        await ctx.logger.error(`Check failed: ${error.message}`);
                        return false;
                    }
                }
                isChecking = false;
                return false;
            }
        });

        // Action: Download
        ctx.actions.registerAction({
            id: 'downloader:download',
            handler: async () => {
                const spinner = ora('Downloading new version...').start();
                try {
                    const client = createClient(); // Create client with current config
                    const { DIST_DIR, DOWNLOAD_PATH, VERSION_FILE } = getPaths();

                    const response = await client.get(`/download/${ctx.config.jobId}`, {
                        responseType: 'arraybuffer'
                    });
                    await fs.ensureDir(ctx.config.workDir);
                    await fs.writeFile(DOWNLOAD_PATH, response.data);

                    await fs.emptyDir(DIST_DIR);
                    const zip = new AdmZip(DOWNLOAD_PATH);
                    zip.extractAllTo(DIST_DIR, true);

                    // --- HOT RELOAD INJECTION ---
                    try {
                        // Get dynamically allocated port from ServerPlugin via config
                        const hotReloadPort = ctx.config.hotReloadPort || 3500;

                        const HOT_RELOAD_CODE = `
const EVENT_SOURCE_URL = 'http://localhost:${hotReloadPort}/status';
const CURRENT_JOB_ID = '${ctx.config.jobId}';
let lastVersion = null;
let lastJobId = null;

setInterval(async () => {
    try {
        const res = await fetch(EVENT_SOURCE_URL);
        const data = await res.json();
        
        // 1. Job ID Swap (User switched project)
        if (data.jobId && data.jobId !== CURRENT_JOB_ID) {
             console.log('[Hot Reload] Job Swap detected. Reloading...');
             chrome.runtime.reload();
             return;
        }

        // 2. Version Bump (Same project, new build)
        if (lastVersion && data.version !== lastVersion) {
            console.log('[Hot Reload] New version detected:', data.version);
            chrome.runtime.reload();
        }
        
        lastVersion = data.version;
        lastJobId = data.jobId;
    } catch (err) {
        // Build tool might be offline
    }
}, 1000);
console.log('[Hot Reload] Active for Job:', CURRENT_JOB_ID);
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
                                    await ctx.logger.info('Injected Hot Reload script into background worker.');
                                }
                            }
                            // MV2 Scripts Strategy (Fallback if user generates MV2)
                            else if (manifest.background?.scripts) {
                                manifest.background.scripts.push('hot-reload.js');
                                await fs.writeJson(manifestPath, manifest, { spaces: 2 });
                                await ctx.logger.info('Injected Hot Reload script into background scripts.');
                            }
                        }
                    } catch (injectErr: any) {
                        await ctx.logger.error(`Hot Reload Injection Failed: ${injectErr.message}`);
                    }
                    // ----------------------------

                    spinner.succeed('Updated extension code!');
                    return true;
                } catch (error: any) {
                    spinner.fail(`Failed to download: ${error.message}`);
                    await ctx.logger.error(`Download failed: ${error.message}`);
                    return false;
                }
            }
        });

        // Polling removed in favor of push-based updates (POST /refresh)
        ctx.logger.info('Ready. Waiting for update signals...');
    }
};

export default DownloaderPlugin;
