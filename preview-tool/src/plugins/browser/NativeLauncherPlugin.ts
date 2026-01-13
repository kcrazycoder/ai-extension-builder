import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import path from 'path';
import fs from 'fs-extra';
import { spawn, ChildProcess } from 'child_process';
import os from 'os';
import { findChrome, normalizePathToWindows } from '../../utils/browserUtils.js';
import { PreviewContext, PreviewConfig } from '../../types.js';

let chromeProcess: ChildProcess | null = null;

const NativeLauncherPlugin: PluginDefinition<PreviewConfig> = {
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
                    // Ensure backslashes are used everywhere
                    safeDist = normalizePathToWindows(safeDist).replace(/\//g, '\\');
                    // Use temp profile to avoid permissions issues
                    // If winStagingDir was passed (from BrowserManager), we could use its sibling
                    // But here we can just use os.tmpdir
                    safeProfile = path.join(os.tmpdir(), 'ai-ext-profile').replace(/\//g, '\\');
                }

                await ctx.logger.info(`[DEBUG] Native Chrome Extension Path: ${safeDist}`);
                await ctx.logger.info(`[DEBUG] Native Chrome Profile Path: ${safeProfile}`);

                await ctx.actions.runAction('core:log', { level: 'info', message: `Native Launch Executable: ${executable} ` });
                await ctx.actions.runAction('core:log', { level: 'info', message: `Native Launch Target: ${safeDist} ` });

                const cleanArgs = [
                    `--load-extension=${safeDist}`,
                    `--user-data-dir=${safeProfile}`,
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-gpu',
                    '--remote-debugging-port=9222', // Enable CDP
                    'chrome://extensions'
                ];

                // --- Developer Debug UI ---
                console.log('\n' + '─'.repeat(50));
                console.log(' 🛠️  DEBUG: NATIVE LAUNCH CONFIGURATION');
                console.log('─'.repeat(50));
                console.log(`Executable: ${executable}`);
                console.log('Arguments:');
                cleanArgs.forEach(arg => console.log(`  ${arg}`));
                console.log('─'.repeat(50) + '\n');
                // ---------------------------

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
                        ctx.logger.info(`[NativeLauncher] Chrome exited with code ${code}`);
                        chromeProcess = null;
                        ctx.events.emit('browser:closed', { code });
                    });

                    ctx.logger.info('[NativeLauncher] Chrome started with PID: ' + chromeProcess.pid);
                } catch (spawnErr: any) {
                    ctx.logger.error(`[NativeLauncher] Spawn Failed: ${spawnErr.message}`);
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
                    ctx.logger.info('[NativeLauncher] Chrome process force killed.');
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

export default NativeLauncherPlugin;
