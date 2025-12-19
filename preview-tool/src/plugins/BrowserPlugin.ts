import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import webExt from 'web-ext';
import path from 'path';
import { spawn, exec } from 'child_process';
import fs from 'fs-extra';

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

            // WSL Detection & Handling
            let extensionPath = DIST_DIR;
            const isWSL = fs.existsSync('/mnt/c'); // Simple check for WSL

            if (isWSL) {
                try {
                    const WIN_TEMP_DIR = '/mnt/c/Temp/ai-ext-preview';
                    const WIN_PATH_FOR_CHROME = 'C:/Temp/ai-ext-preview';

                    await ctx.actions.runAction('core:log', { level: 'info', message: `[WSL] Copying extension to Windows Temp: ${WIN_PATH_FOR_CHROME}` });

                    // Ensure Windows temp dir exists and is clean
                    if (fs.existsSync(WIN_TEMP_DIR)) {
                        fs.removeSync(WIN_TEMP_DIR);
                    }
                    fs.ensureDirSync(WIN_TEMP_DIR);

                    // Copy dist content
                    fs.copySync(DIST_DIR, WIN_TEMP_DIR);

                    extensionPath = WIN_PATH_FOR_CHROME;
                } catch (copyErr: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Failed to copy to Windows Temp: ${copyErr.message}` });
                    // Fallback to original path (might fail if not mapped)
                }
            }

            await ctx.actions.runAction('core:log', { level: 'warning', message: 'Switching to Detached Mode (WSL/GitBash detected).' });
            await ctx.actions.runAction('core:log', { level: 'info', message: 'Browser polling/logging is disabled. Please reload manually on updates.' });

            const userDataDir = 'C:/Temp/ai-ext-profile';

            // Convert Chrome path to Windows format if in WSL
            // /mnt/c/Program Files/... -> C:\Program Files\...
            let executable = chromePath;
            let args = [
                `--load-extension=${extensionPath}`,
                `--user-data-dir=${userDataDir}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-gpu',
                'about:blank'
            ];

            // If WSL, use exec with cmd.exe /c start for robust handling
            if (isWSL) {
                const driveLetter = chromePath.match(/\/mnt\/([a-z])\//)?.[1] || 'c';
                const winChromePath = chromePath
                    .replace(new RegExp(`^/mnt/${driveLetter}/`), `${driveLetter.toUpperCase()}:\\`)
                    .replace(/\//g, '\\');

                await ctx.actions.runAction('core:log', { level: 'info', message: `WSL: Delegating launch to cmd.exe` });

                // Construct secure command string: start "" "Chrome Path" --arg="val" ...
                const safeArgs = args.map(arg => {
                    // If arg has =, quote the value part
                    if (arg.includes('=')) {
                        const [key, val] = arg.split('=');
                        return `${key}="${val}"`;
                    }
                    return arg;
                }).join(' ');

                const command = `cmd.exe /c start "" "${winChromePath}" ${safeArgs}`;

                await ctx.actions.runAction('core:log', { level: 'info', message: `EXEC: ${command}` });

                // Use exec instead of spawn for WSL
                exec(command, (error: any) => {
                    if (error) {
                        console.error('Failed to launch chrome via cmd:', error);
                    }
                });
                return true; // Return immediately
            } else {
                await ctx.actions.runAction('core:log', { level: 'info', message: `SPAWN: ${chromePath}` });
                await ctx.actions.runAction('core:log', { level: 'info', message: `ARGS: ${args.join(' ')}` });

                const subprocess = spawn(executable, args, {
                    detached: true,
                    stdio: 'ignore'
                });
                subprocess.unref();
                return true;
            }
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
