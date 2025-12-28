import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import path from 'path';
import fs from 'fs-extra';
import { findExtensionRoot, validateExtension } from '../../utils/browserUtils.js';

export const BrowserManagerPlugin: PluginDefinition = {
    name: 'browser-manager',
    version: '1.0.0',
    setup(ctx: RuntimeContext) {
        const config = ctx.host.config as any;
        const DIST_DIR = path.join(config.workDir, 'dist');

        // --- Centralized Path Strategy ---
        const isWSL = fs.existsSync('/mnt/c');
        const isWin = process.platform === 'win32';

        // Unified Staging Path (C:\\Temp for Windows/WSL, local for others)
        const STAGING_DIR = isWSL
            ? '/mnt/c/Temp/ai-ext-preview'
            : (isWin ? 'C:\\Temp\\ai-ext-preview' : path.join(config.workDir, '../staging'));

        // --- SYNC FUNCTION ---
        const syncToStaging = async () => {
            try {
                if (fs.existsSync(STAGING_DIR)) {
                    fs.emptyDirSync(STAGING_DIR);
                }
                fs.ensureDirSync(STAGING_DIR);
                fs.copySync(DIST_DIR, STAGING_DIR);

                await ctx.actions.runAction('core:log', { level: 'info', message: `Synced code to Staging` });

                // Emit staged event (optional)
                ctx.events.emit('browser:staged', { path: STAGING_DIR });
            } catch (err: any) {
                await ctx.actions.runAction('core:log', { level: 'error', message: `Failed to sync to staging: ${err.message}` });
            }
        };

        const launchBrowser = async () => {
            // Resolve proper root AFTER sync
            const extensionRoot = findExtensionRoot(STAGING_DIR) || STAGING_DIR;

            // Validate
            const validation = validateExtension(extensionRoot);
            if (!validation.valid) {
                await ctx.actions.runAction('core:log', { level: 'error', message: `[CRITICAL] Extension validation failed: ${validation.error} in ${extensionRoot}` });
            } else if (extensionRoot !== STAGING_DIR) {
                await ctx.actions.runAction('core:log', { level: 'info', message: `Detected nested extension at: ${path.basename(extensionRoot)}` });
            }

            // Delegate Launch
            // We pass the filesystem path (STAGING_DIR or extensionRoot)
            // The specific Launcher plugin handles environment specific path verification/conversion
            await ctx.actions.runAction('launcher:launch', {
                extensionPath: extensionRoot,
                stagingDir: STAGING_DIR
            });
        };

        let isInitialized = false;

        // Action: Start Browser (Orchestrator)
        ctx.actions.registerAction({
            id: 'browser:start',
            handler: async () => {
                await syncToStaging();
                await launchBrowser();
                isInitialized = true;
                return true;
            }
        });

        // Action: Stop Browser
        ctx.actions.registerAction({
            id: 'browser:stop',
            handler: async () => {
                await ctx.actions.runAction('core:log', { level: 'info', message: 'Stopping browser...' });
                const result = await ctx.actions.runAction('launcher:kill', null);
                return result;
            }
        });

        // Event: Update detected
        ctx.events.on('downloader:updated', async () => {
            if (isInitialized) {
                await ctx.actions.runAction('core:log', { level: 'info', message: 'Update detected. Syncing to staging...' });
                await ctx.actions.runAction('browser:start', {});
            }
        });

        // Event: Browser closed (from launcher)
        ctx.events.on('browser:closed', async (data: any) => {
            await ctx.actions.runAction('core:log', { level: 'info', message: `Browser closed with code ${data.code}` });
            // Emit event that can be picked up by other plugins (e.g., to notify backend)
            ctx.events.emit('session:terminated', { reason: 'browser_closed' });
        });
    }
};
