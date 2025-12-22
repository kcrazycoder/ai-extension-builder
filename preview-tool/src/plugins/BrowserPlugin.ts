import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import webExt from 'web-ext';
import path from 'path';
import { spawn, exec } from 'child_process';
import fs from 'fs-extra';

const CHROME_PATHS = [
    // Standard Windows Paths
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // WSL Mappings
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    // Git Bash / Unix-y Windows Environment Mappings
    '/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    // Linux
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

                    // Pre-flight check: Validating WSL Interop
                    // We try to run cmd.exe simply to check if the OS allows it.
                    try {
                        await new Promise((resolve, reject) => {
                            const check = spawn('cmd.exe', ['/c', 'ver'], { stdio: 'ignore' });
                            check.on('error', reject);
                            check.on('close', (code) => {
                                if (code === 0) resolve(true);
                                else reject(new Error(`Exit code ${code}`));
                            });
                        });
                    } catch (interopErr: any) {
                        await ctx.actions.runAction('core:log', { level: 'error', message: `[FATAL] WSL Interop is broken on this system.` });
                        await ctx.actions.runAction('core:log', { level: 'error', message: `Linux cannot launch Windows applications (cmd.exe failed).` });
                        await ctx.actions.runAction('core:log', { level: 'error', message: `PLEASE FIX: Open PowerShell as Admin and run 'wsl --shutdown', then restart.` });
                        return false;
                    }

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

            // If WSL, use a batch file to handle the launch robustly
            if (isWSL) {
                const driveLetter = chromePath.match(/\/mnt\/([a-z])\//)?.[1] || 'c';
                const winChromePath = chromePath
                    .replace(new RegExp(`^/mnt/${driveLetter}/`), `${driveLetter.toUpperCase()}:\\`)
                    .replace(/\//g, '\\');

                await ctx.actions.runAction('core:log', { level: 'info', message: `WSL: Creating launch script...` });

                // Use backslashes for Windows paths in the batch file
                const winDist = 'C:\\Temp\\ai-ext-preview';
                const winProfile = 'C:\\Temp\\ai-ext-profile';

                // Create the batch file content
                const batContent = `@echo off
start "" "${winChromePath}" --load-extension="${winDist}" --user-data-dir="${winProfile}" --no-first-run --no-default-browser-check --disable-gpu about:blank
exit
`;
                const batPath = '/mnt/c/Temp/ai-ext-preview/launch.bat';
                const winBatPath = 'C:\\Temp\\ai-ext-preview\\launch.bat';

                try {
                    fs.writeFileSync(batPath, batContent);
                } catch (e: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Failed to write batch file: ${e.message}` });
                    return false;
                }

                await ctx.actions.runAction('core:log', { level: 'info', message: `EXEC: ${winBatPath}` });

                // Execute the batch file via cmd.exe using spawn + PATH lookup
                const cli = 'cmd.exe';

                await ctx.actions.runAction('core:log', { level: 'info', message: `SPAWN (WSL): ${cli} /c ${winBatPath}` });

                const subprocess = spawn(cli, ['/c', winBatPath], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: '/mnt/c'
                });
                subprocess.unref();

                return true;
            } else {
                // Standard Windows / Linux Launch (Git Bash / Native)

                // Normalize paths (stripping trailing slashes which Chrome hates)
                const safeDist = path.resolve(extensionPath);
                const safeProfile = path.resolve(userDataDir);

                await ctx.actions.runAction('core:log', { level: 'info', message: `SPAWN: ${executable}` });
                await ctx.actions.runAction('core:log', { level: 'info', message: `EXT PATH: ${safeDist}` });

                // Reconstruct args with safe paths
                const cleanArgs = [
                    `--load-extension=${safeDist}`,
                    `--user-data-dir=${safeProfile}`,
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-gpu',
                    'chrome://extensions' // Better for verifying if it loaded
                ];

                await ctx.actions.runAction('core:log', { level: 'info', message: `ARGS: ${cleanArgs.join(' ')}` });

                const subprocess = spawn(executable, cleanArgs, {
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
                // On Windows (including Git Bash), web-ext is unreliable for loading extensions correctly.
                // We force detached mode to ensure the extension loads.
                if (process.platform === 'win32') {
                    await ctx.actions.runAction('core:log', { level: 'warning', message: 'Windows detected: Forcing Detached Mode for reliability.' });
                    return await launchDetached();
                }

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
