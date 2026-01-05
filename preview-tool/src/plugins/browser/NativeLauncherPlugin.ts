import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import path from 'path';
import fs from 'fs-extra';
import { spawn, ChildProcess } from 'child_process';
import { findChrome, normalizePathToWindows } from '../../utils/browserUtils.js';
import { PreviewContext, PreviewConfig } from '../../types.js';

let chromeProcess: ChildProcess | null = null;

export const NativeLauncherPlugin: PluginDefinition<PreviewConfig> = {
    name: 'native-launcher',
    version: '1.0.0',
    dependencies: ['config'],
    setup(ctx: RuntimeContext<PreviewConfig>) {
        // Only active if NOT in WSL
        const isWSL = fs.existsSync('/mnt/c');
        if (isWSL) return;

        ctx.actions.registerAction({
            id: 'launcher:launch',
            handler: async (payload: { extensionPath: string, stagingDir: string }) => {
                const config = ctx.config;
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
                    // Use C:\\Temp profile to avoid permissions issues
                    safeProfile = 'C:\\\\Temp\\\\ai-ext-profile';
                }

                await ctx.actions.runAction('core:log', { level: 'info', message: `Native Launch Executable: ${executable} ` });
                await ctx.actions.runAction('core:log', { level: 'info', message: `Native Launch Target: ${safeDist} ` });

                const cleanArgs = [
                    `--load-extension=${safeDist}`,
                    `--user-data-dir=${safeProfile}`,
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-gpu',
                    'chrome://extensions'
                ];

                try {
                    // Kill existing process if any
                    if (chromeProcess) {
                        chromeProcess.kill();
                        chromeProcess = null;
                    }

                    chromeProcess = spawn(executable, cleanArgs, {
                        detached: false,
                        stdio: 'ignore'
                    });

                    // Monitor process exit
                    chromeProcess.on('exit', async (code) => {
                        await ctx.actions.runAction('core:log', { level: 'info', message: `Chrome exited with code ${code} ` });
                        chromeProcess = null;
                        ctx.events.emit('browser:closed', { code });
                    });

                    await ctx.actions.runAction('core:log', { level: 'info', message: `Chrome launched with PID: ${chromeProcess.pid} ` });
                } catch (spawnErr: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Spawn Failed: ${spawnErr.message} ` });
                    return false;
                }
                return true;
            }
        });

        // Register kill action
        ctx.actions.registerAction({
            id: 'launcher:kill',
            handler: async () => {
                if (chromeProcess) {
                    await ctx.actions.runAction('core:log', { level: 'info', message: 'Terminating Chrome process...' });
                    chromeProcess.kill();
                    chromeProcess = null;
                    return true;
                }
                return false;
            }
        });
    },
    dispose(ctx) {
        if (chromeProcess) {
            chromeProcess.kill();
            chromeProcess = null;
        }
    }
};
