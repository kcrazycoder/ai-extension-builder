import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import path from 'path';
import fs from 'fs-extra';
import { findExtensionRoot, validateExtension } from '../../utils/browserUtils.js';
import { PreviewContext, PreviewConfig } from '../../types.js';
import { SandboxRunner } from '../../utils/sandbox.js';

export const BrowserManagerPlugin: PluginDefinition<PreviewConfig> = {
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
            const STAGING_DIR = isWSL
                ? '/mnt/c/Temp/ai-ext-preview'
                : (isWin ? 'C:\\Temp\\ai-ext-preview' : path.join(config.workDir, '../staging'));
            return { DIST_DIR, STAGING_DIR };
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

                await ctx.actions.runAction('core:log', { level: 'info', message: `Synced code to Staging` });

                // Emit staged event (optional)
                ctx.events.emit('browser:staged', { path: STAGING_DIR });
            } catch (err: any) {
                await ctx.actions.runAction('core:log', { level: 'error', message: `Failed to sync to staging: ${err.message}` });
            }
        };



        const launchBrowser = async () => {
            const { STAGING_DIR } = getPaths();
            // Resolve proper root AFTER sync
            const extensionRoot = findExtensionRoot(STAGING_DIR) || STAGING_DIR;

            // 1. Static Validation
            const validation = validateExtension(extensionRoot);
            if (!validation.valid) {
                await ctx.actions.runAction('core:log', { level: 'error', message: `[CRITICAL] Extension validation failed: ${validation.error} in ${extensionRoot}` });
            } else if (extensionRoot !== STAGING_DIR) {
                await ctx.actions.runAction('core:log', { level: 'info', message: `Detected nested extension at: ${path.basename(extensionRoot)}` });
            }

            // 2. Runtime Verification (Diagnostic) - SKIPPED FOR PERFORMANCE
            // The SandboxRunner spins up a separate headless chrome which is slow and prone to WSL networking issues.
            // Since we have static analysis in the backend, we skip this blocking step to give the user immediate feedback.
            /*
            await ctx.actions.runAction('core:log', { level: 'info', message: 'Running diagnostic verification...' });
            const diagResult = await SandboxRunner.validateExtensionRuntime(extensionRoot);

            if (diagResult.success) {
                await ctx.actions.runAction('core:log', { level: 'info', message: '✅ Diagnostic Verification Passed.' });
            } else {
                await ctx.actions.runAction('core:log', { level: 'error', message: `❌ Diagnostic Verification Failed: ${diagResult.error}` });
            }
            */

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
                await ctx.actions.runAction('core:log', { level: 'info', message: 'Update detected. Restarting browser...' });
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
            await ctx.actions.runAction('core:log', { level: 'info', message: `Browser closed with code ${data.code}` });
            // Emit event that can be picked up by other plugins (e.g., to notify backend)
            ctx.events.emit('session:terminated', { reason: 'browser_closed' });
        });
    }
};
