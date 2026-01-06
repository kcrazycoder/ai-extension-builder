import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import fs from 'fs-extra';
import path from 'path';
import { PreviewConfig } from '../types.js';

export const AppPlugin: PluginDefinition<PreviewConfig> = {
    name: 'app',
    version: '1.0.0',
    dependencies: ['auth', 'config', 'downloader', 'browser-manager', 'server'],
    setup(ctx: RuntimeContext<PreviewConfig>) {
        ctx.actions.registerAction({
            id: 'app:start',
            handler: async () => {
                await ctx.logger.info('Initializing Local Satellite...');

                // 1. Authenticate (if needed)
                // AuthPlugin will automatically skip if already config'd, or prompt if needed
                // It will also update config via config:set
                await ctx.actions.runAction('auth:login');

                // 2. Validate Configuration (Now that we have potential Auth data)
                try {
                    await ctx.actions.runAction('config:validate', null);
                } catch (e: any) {
                    throw new Error(`Configuration Invalid: ${e.message}`);
                }

                // 3. Get Updated Config
                const workDir = ctx.config.workDir;

                // 3. Ensure Work Directory
                await fs.ensureDir(workDir);

                // 4. Initial Download/Check
                const success = await ctx.actions.runAction('downloader:check', null);
                if (!success) {
                    await ctx.logger.error('Initial check failed. Could not verify job or download extension.');
                    // We don't exit process here, but we might throw to stop flow
                    throw new Error('Initial check failed');
                }

                // 5. Wait for Extension Manifest
                const manifestPath = path.join(workDir, 'dist', 'manifest.json');
                let attempts = 0;
                const maxAttempts = 60; // 2 minutes

                // This logic could be in a 'watcher' plugin but fits here for now as part of "Startup Sequence"
                if (!fs.existsSync(manifestPath)) {
                    await ctx.logger.info('[DEBUG] Waiting for extension files...');
                    while (!fs.existsSync(manifestPath) && attempts < maxAttempts) {
                        await new Promise(r => setTimeout(r, 2000));
                        attempts++;
                        if (attempts % 5 === 0) {
                            await ctx.logger.info(`Waiting for extension generation... (${attempts * 2}s)`);
                        }
                    }
                }

                if (!fs.existsSync(manifestPath)) {
                    await ctx.logger.error('Timed out waiting for extension files. Status check succeeded but files are missing.');
                    throw new Error('Timeout waiting for files');
                }

                // 6. Launch Browser
                await ctx.actions.runAction('browser:start', {});
            }
        });
    }
};

export default AppPlugin;
