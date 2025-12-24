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

// --- Helper to find actual extension root (handle nested folder in zip) ---
export const findExtensionRoot = (dir: string): string | null => {
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;

    // Check immediate subdirectories (depth 1)
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                if (fs.existsSync(path.join(fullPath, 'manifest.json'))) {
                    return fullPath;
                }
            }
        }
    } catch (e) {
        // Dir might be empty or invalid
    }
    return null;
};

export const normalizePathToWindows = (p: string) => {
    // Handle Git Bash /c/ style
    const gitBashMatch = p.match(/^\/([a-z])\/(.*)/i);
    if (gitBashMatch) {
        return `${gitBashMatch[1].toUpperCase()}:\\${gitBashMatch[2].replace(/\//g, '\\')}`;
    }
    // Handle Forward slashes
    return p.replace(/\//g, '\\');
};

export const stripTrailingSlash = (p: string) => {
    return p.replace(/[\\\/]+$/, '');
};

// --- Helper to validate extension directory existence and structure ---
export const validateExtension = (dir: string): { valid: boolean; error?: string } => {
    if (!fs.existsSync(dir)) {
        return { valid: false, error: 'Directory does not exist' };
    }
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) {
        return { valid: false, error: 'Path is not a directory' };
    }
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        return { valid: false, error: 'manifest.json missing' };
    }
    // Basic JSON validity check
    try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        JSON.parse(content);
    } catch (e) {
        return { valid: false, error: 'manifest.json is invalid JSON' };
    }
    return { valid: true };
};

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

            const isWSL = fs.existsSync('/mnt/c');
            let executable = chromePath;

            // Normalize Executable for Native Windows (Git Bash)
            if (!isWSL && process.platform === 'win32') {
                executable = normalizePathToWindows(chromePath);
            }

            const STAGING_DIR = isWSL ? '/mnt/c/Temp/ai-ext-preview' : path.join(config.workDir, '../staging');
            const WIN_PROFILE_DIR = 'C:/Temp/ai-ext-profile';
            // For native windows/linux, use local staging path
            // Note: We will evaluate actual extension root later, but base is STAGING_DIR
            const EXTENSION_PATH = isWSL ? 'C:/Temp/ai-ext-preview' : STAGING_DIR;

            // --- SYNC FUNCTION ---
            const syncToStaging = async () => {
                try {
                    if (fs.existsSync(STAGING_DIR)) {
                        fs.emptyDirSync(STAGING_DIR);
                    }
                    fs.ensureDirSync(STAGING_DIR);
                    fs.copySync(DIST_DIR, STAGING_DIR);

                    await ctx.actions.runAction('core:log', { level: 'info', message: `Synced code to Staging` });

                    // DEBUG: Log contents of staging
                    try {
                        const files = fs.readdirSync(STAGING_DIR);
                        await ctx.actions.runAction('core:log', { level: 'info', message: `Staging Contents: ${files.join(', ')}` });
                    } catch (e) { }

                    // Emit staged event for ServerPlugin (optional for now, but good practice)
                    ctx.events.emit('browser:staged', { path: STAGING_DIR });
                } catch (err: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Failed to sync to staging: ${err.message}` });
                }
            };

            // Initial Sync
            await syncToStaging();

            // Resolve proper root AFTER sync
            let extensionRoot = findExtensionRoot(STAGING_DIR) || STAGING_DIR;

            // Check if we found a valid root
            const validation = validateExtension(extensionRoot);
            if (!validation.valid) {
                await ctx.actions.runAction('core:log', { level: 'error', message: `[CRITICAL] Extension validation failed: ${validation.error} in ${extensionRoot}` });
                await ctx.actions.runAction('core:log', { level: 'info', message: `Checked Path: ${extensionRoot}` });
                // We proceed anyway? Or should we stop? 
                // Previous logic proceeded but logged critical error. 
                // Let's keep it logging critical but maybe return false if we wanted to be strict.
                // However, user might fix it live.
            } else if (extensionRoot !== STAGING_DIR) {
                await ctx.actions.runAction('core:log', { level: 'info', message: `Detected nested extension at: ${path.basename(extensionRoot)}` });
            }

            // Listen for updates and re-sync
            ctx.events.on('downloader:updated', async (data: any) => {
                await ctx.actions.runAction('core:log', { level: 'info', message: 'Update detected. Syncing to staging...' });
                await syncToStaging();

                // Re-validate on update? 
                // const newRoot = findExtensionRoot(STAGING_DIR) || STAGING_DIR;
                // const newValidation = validateExtension(newRoot);
                // if (!newValidation.valid) ...
            });

            await ctx.actions.runAction('core:log', { level: 'info', message: 'Browser running in Detached Mode.' });

            // Launch Logic
            // Launch Logic
            if (isWSL) {
                // -------------------------------------------------------------------------
                // WSL STRATEGY (Validated 2025-12-24)
                // 1. Use Windows User Profile for staging to avoid Permission/Path issues
                // 2. Use PowerShell script to launch Chrome to reliably pass arguments
                // -------------------------------------------------------------------------

                // 1. Get Windows User Profile Path
                let userProfileWin = '';
                try {
                    // Use async exec to avoid blocking
                    const { exec } = await import('child_process');
                    const util = await import('util');
                    const execAsync = util.promisify(exec);

                    const { stdout } = await execAsync('cmd.exe /c echo %USERPROFILE%', { encoding: 'utf8' });
                    userProfileWin = stdout.trim();
                } catch (e) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: 'Failed to detect Windows User Profile. Defaulting to C:\\Temp' });
                    userProfileWin = 'C:\\Temp';
                }

                const stagingDirName = '.ai-extension-preview';
                const stagingDirWin = path.posix.join(userProfileWin.replace(/\\/g, '/'), stagingDirName).replace(/\//g, '\\');

                // Map Win Path -> WSL Path for copying
                const driveMatch = userProfileWin.match(/^([a-zA-Z]):/);
                const driveLetter = driveMatch ? driveMatch[1].toLowerCase() : 'c';
                const userProfileRoute = userProfileWin.substring(3).replace(/\\/g, '/'); // Users/Name
                const wslStagingBase = `/mnt/${driveLetter}/${userProfileRoute}`;
                const wslStagingDir = path.posix.join(wslStagingBase, stagingDirName);

                try {
                    if (await fs.pathExists(wslStagingDir)) await fs.remove(wslStagingDir);
                    // Use async copy to prevent blocking event loop (Fixes 25s lag)
                    await fs.copy(STAGING_DIR, wslStagingDir);
                } catch (copyErr: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `WSL Staging Copy Failed: ${copyErr.message}` });
                }

                // Calculate final paths
                let finalWinExtensionPath = stagingDirWin;

                // Handle nested extension root
                if (extensionRoot !== STAGING_DIR) {
                    const relative = path.relative(STAGING_DIR, extensionRoot);
                    finalWinExtensionPath = path.posix.join(stagingDirWin.replace(/\\/g, '/'), relative).replace(/\//g, '\\');
                }

                const winChromePath = chromePath
                    .replace(new RegExp(`^/mnt/${driveLetter}/`), `${driveLetter.toUpperCase()}:\\`)
                    .replace(/\//g, '\\');

                const winProfile = path.posix.join(userProfileWin.replace(/\\/g, '/'), '.ai-extension-profile').replace(/\//g, '\\');

                await ctx.actions.runAction('core:log', { level: 'info', message: `WSL Launch Target (Win): ${finalWinExtensionPath}` });
                // await ctx.actions.runAction('core:log', { level: 'info', message: `WSL Profile (Win): ${winProfile}` });

                // Create PowerShell Launch Script
                const psContent = `
$chromePath = "${winChromePath}"
$extPath = "${finalWinExtensionPath}"
$profilePath = "${winProfile}"

# Create Profile Dir if needed
if (-not (Test-Path -Path $profilePath)) {
    New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
}

$argsList = @(
    "--load-extension=$extPath",
    "--user-data-dir=$profilePath",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "chrome://extensions"
)

Start-Process -FilePath $chromePath -ArgumentList $argsList
`;
                const psPath = path.join(wslStagingDir, 'launch.ps1');
                const winPsPath = path.posix.join(stagingDirWin.replace(/\\/g, '/'), 'launch.ps1').replace(/\//g, '\\');

                try {
                    await fs.writeFile(psPath, psContent);
                } catch (e: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `WSL Write PS1 Failed: ${e.message}` });
                }

                // Execute PowerShell
                const cli = 'powershell.exe';
                try {
                    const subprocess = spawn(cli, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', winPsPath], {
                        detached: true, // We still detach the PowerShell process itself
                        stdio: 'ignore',
                        cwd: `/mnt/${driveLetter}`
                    });
                    subprocess.unref();
                } catch (spawnErr: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `WSL Spawn Error: ${spawnErr.message}` });
                }
                return true;
            } else {
                // Native Windows / Linux
                // Use extensionRoot which points to the detected subfolder or root
                const safeDist = path.resolve(extensionRoot);
                const safeProfile = path.join(path.dirname(config.workDir), 'profile'); // ~/.ai-extension-preview/profile

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
        };

        ctx.actions.registerAction({
            id: 'browser:start',
            handler: async () => {
                // Force Detached Mode for Reliability on ALL platforms
                // This creates the stable "Staging" workflow we want.
                return await launchDetached();
            }
        });
    }
};
