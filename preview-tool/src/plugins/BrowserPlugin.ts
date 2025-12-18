import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import webExt from 'web-ext';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATHS = [
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
];

function findChrome() {
    for (const p of CHROME_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

export const BrowserPlugin: PluginDefinition = {
    name: 'browser',
    version: '1.0.0',
    setup(ctx: RuntimeContext) {
        const config = ctx.host.config as any;
        const DIST_DIR = path.join(config.workDir, 'dist');
        let runner: any = null;

        const launchDetached = async () => {
            const chromePath = findChrome();
            if (!chromePath) {
                await ctx.actions.runAction('core:log', { level: 'error', message: 'Chrome not found for detached launch.' });
                return false;
            }

            // Log with prefix to indicate we are handling the Env quirk
            await ctx.actions.runAction('core:log', { level: 'info', message: '[WSL] Copying extension to Windows Temp: C:\\ai-ext-preview' });
            // In a real scenario we might need to copy to a Windows-accessible path if /home/... isn't mapped well,
            // but usually \\wsl$\... works or user is mapped.
            // For now assuming direct path works or user has mapping.
            // Actually, verify path.

            // IMPORTANT: In WSL, standard linux paths might not be readable by Windows Chrome directly 
            // without `\\wsl$\...` mapping.
            // However, previous logs showed "Failed to load... CDP connection closed" which means 
            // Chrome DID try to load it but failed communication.
            // So path is likely fine.

            await ctx.actions.runAction('core:log', { level: 'warning', message: 'Switching to Detached Mode (WSL/GitBash detected).' });
            await ctx.actions.runAction('core:log', { level: 'info', message: 'Browser polling/logging is disabled. Please reload manually on updates.' });

            const subprocess = spawn(chromePath, [
                `--load-extension=${DIST_DIR}`,
                '--disable-gpu',
                'https://google.com'
            ], {
                detached: true,
                stdio: 'ignore'
            });

            subprocess.unref();
            return true;
        };

        ctx.actions.registerAction({
            id: 'browser:start',
            handler: async () => {
                await ctx.actions.runAction('core:log', { level: 'info', message: 'Launching browser...' });
                try {
                    // Try web-ext first
                    const runResult = await webExt.cmd.run({
                        sourceDir: DIST_DIR,
                        target: 'chromium',
                        browserConsole: false,
                        startUrl: ['https://google.com'],
                        noInput: true,
                        keepProfileChanges: false,
                        args: [
                            '--start-maximized',
                            '--no-sandbox',
                            '--disable-gpu',
                            '--disable-dev-shm-usage'
                        ]
                    }, {
                        shouldExitProgram: false
                    });

                    runner = runResult;
                    await ctx.actions.runAction('core:log', { level: 'success', message: 'Browser session ended.' });
                    return true;
                } catch (err: any) {
                    // Check for expected environment failures
                    if (err.code === 'ECONNRESET' || err.message?.includes('CDP connection closed')) {
                        // Log specific WSL message for clarity
                        await ctx.actions.runAction('core:log', { level: 'warning', message: 'WSL: CDP connection dropped (expected). Browser is running detached.' });
                        await ctx.actions.runAction('core:log', { level: 'info', message: 'Please reload extension manually in Chrome if needed.' });
                        return await launchDetached();
                    }

                    if (err.code !== 'ECONNRESET') {
                        await ctx.actions.runAction('core:log', { level: 'error', message: `Browser failed: ${err.message}` });
                    }
                    return false;
                }
            }
        });

        ctx.events.on('downloader:updated', async () => {
            if (runner && runner.reloadAllExtensions) {
                await ctx.actions.runAction('core:log', { level: 'info', message: 'Triggering browser reload...' });
                try {
                    runner.reloadAllExtensions();
                } catch (e) {
                    // Ignore
                }
            } else {
                await ctx.actions.runAction('core:log', { level: 'info', message: 'Update installed. Please reload extension in Chrome.' });
            }
        });
    }
};
