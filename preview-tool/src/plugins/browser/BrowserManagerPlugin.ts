import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import path from 'path';
import fs from 'fs-extra';
import { findExtensionRoot, validateExtension, getWSLTempPath } from '../../utils/browserUtils.js';
import { PreviewContext, PreviewConfig } from '../../types.js';
import { SandboxRunner } from '../../utils/sandbox.js';
import puppeteer from 'puppeteer-core';
import os from 'os';

const BrowserManagerPlugin: PluginDefinition<PreviewConfig> = {
    name: 'browser-manager',
    version: '1.0.0',
    dependencies: ['config', 'downloader'],
    setup(ctx: RuntimeContext<PreviewConfig>) {
        // Helper to get dynamic paths
        const getPaths = () => {
            const config = ctx.config;
            const DIST_DIR = path.join(config.workDir, 'dist');
            const isWSL = fs.existsSync('/mnt/c');
            const isWin = process.platform === 'win32';

            let STAGING_DIR = '';
            let WIN_STAGING_DIR = '';

            if (isWSL) {
                const wslPaths = getWSLTempPath();
                if (wslPaths) {
                    const folder = 'ai-ext-preview';
                    STAGING_DIR = path.join(wslPaths.wsl, folder);
                    // Force Windows Backslashes for WIN_STAGING_DIR
                    WIN_STAGING_DIR = `${wslPaths.win}\\${folder}`.replace(/\//g, '\\');
                } else {
                    // Fallback
                    STAGING_DIR = '/mnt/c/Temp/ai-ext-preview';
                    WIN_STAGING_DIR = 'C:\\Temp\\ai-ext-preview';
                }
            } else if (isWin) {
                // Native Windows (Git Bash, Command Prompt, PowerShell)
                // Use os.tmpdir() which resolves to %TEMP%
                const tempDir = os.tmpdir();
                STAGING_DIR = path.join(tempDir, 'ai-ext-preview');
                WIN_STAGING_DIR = STAGING_DIR; // Node handles paths well, but we can verify later
            } else {
                // Linux / Mac (Native)
                STAGING_DIR = path.join(config.workDir, '../staging');
            }
            return { DIST_DIR, STAGING_DIR, WIN_STAGING_DIR };
        };

        // --- SYNC FUNCTION ---
        const syncToStaging = async () => {
            const { DIST_DIR, STAGING_DIR } = getPaths();
            try {
                if (fs.existsSync(STAGING_DIR)) {
                    fs.emptyDirSync(STAGING_DIR);
                }
                fs.ensureDirSync(STAGING_DIR);
                fs.copySync(DIST_DIR, STAGING_DIR);

                await ctx.logger.info(`Synced code to Staging`);

                // Emit staged event (optional)
                ctx.events.emit('browser:staged', { path: STAGING_DIR });
            } catch (err: any) {
                await ctx.logger.error(`Failed to sync to staging: ${err.message}`);
            }
        };

        const launchBrowser = async () => {
            const { STAGING_DIR, WIN_STAGING_DIR } = getPaths();
            // Resolve proper root AFTER sync
            const extensionRoot = findExtensionRoot(STAGING_DIR) || STAGING_DIR;

            // 1. Static Validation
            const validation = validateExtension(extensionRoot);
            if (!validation.valid) {
                await ctx.logger.error(`[CRITICAL] Extension validation failed: ${validation.error} in ${extensionRoot}`);
            } else if (extensionRoot !== STAGING_DIR) {
                await ctx.logger.info(`Detected nested extension at: ${path.basename(extensionRoot)}`);
            }

            // Debug: List files in staging to verify extension presence
            try {
                const files = await fs.readdir(extensionRoot);
                await ctx.logger.info(`[DEBUG] Files in Staging (${extensionRoot}): ${files.join(', ')}`);
                await ctx.logger.info(`[DEBUG] WIN_STAGING_DIR: ${WIN_STAGING_DIR}`);
            } catch (e: any) {
                await ctx.logger.error(`[DEBUG] Failed to list staging files: ${e.message}`);
            }

            // Delegate Launch
            await ctx.actions.runAction('launcher:launch', {
                extensionPath: extensionRoot,
                stagingDir: STAGING_DIR,
                winStagingDir: WIN_STAGING_DIR
            });
        };

        let isInitialized = false;
        let browserConnection: any = null;

        const getHostIp = () => {
            // In WSL2, the host IP is in /etc/resolv.conf
            try {
                if (fs.existsSync('/etc/resolv.conf')) {
                    const content = fs.readFileSync('/etc/resolv.conf', 'utf-8');
                    const match = content.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
                    if (match) return match[1];
                }
            } catch { }
            return null;
        };

        const connectToBrowser = async () => {
            // Retry connection for 30 seconds
            const maxRetries = 60;
            const hostIp = getHostIp();
            const port = 9222;

            for (let i = 0; i < maxRetries; i++) {
                const errors: string[] = [];
                try {
                    try {
                        // Strategy 1: Host IP
                        if (hostIp) {
                            browserConnection = await puppeteer.connect({
                                browserURL: `http://${hostIp}:${port}`,
                                defaultViewport: null
                            });
                        } else {
                            throw new Error('No Host IP');
                        }
                    } catch (err1: any) {
                        errors.push(`Host(${hostIp}): ${err1.message}`);
                        try {
                            // Strategy 2: 0.0.0.0 (Requested by User)
                            browserConnection = await puppeteer.connect({
                                browserURL: `http://0.0.0.0:${port}`,
                                defaultViewport: null
                            });
                        } catch (err2: any) {
                            errors.push(`0.0.0.0: ${err2.message}`);
                            try {
                                // Strategy 3: 127.0.0.1
                                browserConnection = await puppeteer.connect({
                                    browserURL: `http://127.0.0.1:${port}`,
                                    defaultViewport: null
                                });
                            } catch (err3: any) {
                                errors.push(`127.0.0.1: ${err3.message}`);
                                // Strategy 4: Localhost
                                try {
                                    browserConnection = await puppeteer.connect({
                                        browserURL: `http://localhost:${port}`,
                                        defaultViewport: null
                                    });
                                } catch (err4: any) {
                                    errors.push(`Localhost: ${err4.message}`);
                                    const combinedError = errors.join(', ');
                                    if (i === maxRetries - 1 && hostIp) {
                                        // Final attempt hint
                                        throw new Error(`${combinedError}. [HINT] Check Windows Firewall for port ${port}.`);
                                    }
                                    throw new Error(combinedError);
                                }
                            }
                        }
                    }

                    ctx.logger.info('[LogCapture] Connected to browser CDP');

                    const attachToPage = async (page: any) => {
                        page.on('console', (msg: any) => {
                            const type = msg.type();
                            const text = msg.text();
                            ctx.events.emit('browser:log', {
                                level: type === 'warning' ? 'warn' : type,
                                message: text,
                                timestamp: new Date().toISOString()
                            });
                        });

                        page.on('pageerror', (err: any) => {
                            ctx.events.emit('browser:log', {
                                level: 'error',
                                message: `[Runtime Error] ${err.toString()}`,
                                timestamp: new Date().toISOString()
                            });
                        });
                    };

                    const pages = await browserConnection.pages();
                    pages.forEach(attachToPage);

                    browserConnection.on('targetcreated', async (target: any) => {
                        const page = await target.page();
                        if (page) attachToPage(page);
                    });

                    return;
                } catch (e: any) {
                    if (i % 10 === 0) {
                        ctx.logger.debug(`[LogCapture] Connection attempt ${i + 1}/${maxRetries} failed: ${e.message}`);
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            ctx.logger.warn('[LogCapture] Failed to connect to browser CDP after multiple attempts.');
        };

        // Action: Start Browser (Orchestrator)
        ctx.actions.registerAction({
            id: 'browser:start',
            handler: async () => {
                await syncToStaging();
                await launchBrowser();
                connectToBrowser();
                isInitialized = true;
                return true;
            }
        });

        // Action: Stop Browser
        ctx.actions.registerAction({
            id: 'browser:stop',
            handler: async () => {
                await ctx.logger.info('Stopping browser...');
                if (browserConnection) {
                    try { browserConnection.disconnect(); } catch { }
                    browserConnection = null;
                }
                const result = await ctx.actions.runAction('launcher:kill', null);
                return result;
            }
        });

        // Event: Update detected
        ctx.events.on('downloader:updated', async () => {
            if (isInitialized) {
                await ctx.logger.info('Update detected. Restarting browser...');
                try {
                    await ctx.actions.runAction('browser:stop', {});
                } catch (e) {
                    // Ignore if already stopped
                }

                // [Optimization] Wait for process cleanup to avoid "Open in new tab" race condition
                await new Promise(r => setTimeout(r, 1000));

                await ctx.actions.runAction('browser:start', {});
            }
        });

        // Event: Browser closed (from launcher)
        ctx.events.on('browser:closed', async (data: any) => {
            await ctx.logger.info(`Browser closed with code ${data.code}`);
            // Emit event that can be picked up by other plugins (e.g., to notify backend)
            ctx.events.emit('session:terminated', { reason: 'browser_closed' });
        });
    }
};

export default BrowserManagerPlugin;
