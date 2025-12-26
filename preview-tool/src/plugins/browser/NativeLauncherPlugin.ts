import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { findChrome, normalizePathToWindows } from '../../utils/browserUtils.js';

export const NativeLauncherPlugin: PluginDefinition = {
    name: 'native-launcher',
    version: '1.0.0',
    setup(ctx: RuntimeContext) {
        // Only active if NOT in WSL
        const isWSL = fs.existsSync('/mnt/c');
        if (isWSL) return;

        ctx.actions.registerAction({
            id: 'launcher:launch',
            handler: async (payload: { extensionPath: string, stagingDir: string }) => {
                const config = ctx.host.config as any;
                const chromePath = findChrome();

                if (!chromePath) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: 'Chrome not found.' });
                    return false;
                }

                let executable = chromePath;
                if (process.platform === 'win32') {
                    executable = normalizePathToWindows(chromePath);
                }

                // Native Windows / Linux
                let safeDist = path.resolve(payload.extensionPath);
                // Default Profile
                let safeProfile = path.join(path.dirname(config.workDir), 'profile');

                if (process.platform === 'win32') {
                    safeDist = normalizePathToWindows(safeDist);
                    // Use C:\Temp profile to avoid permissions issues
                    safeProfile = 'C:\\Temp\\ai-ext-profile';
                }

                await ctx.actions.runAction('core:log', { level: 'info', message: `Native Launch Executable: ${executable}` });
                await ctx.actions.runAction('core:log', { level: 'info', message: `Native Launch Target: ${safeDist}` });

                const cleanArgs = [
                    `--load-extension=${safeDist}`,
                    `--user-data-dir=${safeProfile}`,
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-gpu',
                    'chrome://extensions'
                ];

                try {
                    const subprocess = spawn(executable, cleanArgs, {
                        detached: true,
                        stdio: 'ignore'
                    });
                    subprocess.unref();
                } catch (spawnErr: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Spawn Failed: ${spawnErr.message}` });
                }
                return true;
            }
        });
    }
};
