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

            const isWin = process.platform === 'win32';
            const STAGING_DIR = isWSL
                ? '/mnt/c/Temp/ai-ext-preview'
                : (isWin ? 'C:\\Temp\\ai-ext-preview' : path.join(config.workDir, '../staging'));

            // On Windows (Native or WSL host), Chrome sees:
            const EXTENSION_PATH = (isWSL || isWin) ? 'C:\\Temp\\ai-ext-preview' : STAGING_DIR;
            // Clean profile path for everyone
            const WIN_PROFILE_DIR = 'C:\\Temp\\ai-ext-profile';

            // --- SYNC FUNCTION ---
            const syncToStaging = async () => {
                try {
                    if (fs.existsSync(STAGING_DIR)) {
                        fs.emptyDirSync(STAGING_DIR);
                    }
                    fs.ensureDirSync(STAGING_DIR);
                    fs.copySync(DIST_DIR, STAGING_DIR);

                    await ctx.actions.runAction('core:log', { level: 'info', message: `Synced code to Staging` });


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

                // 1. Setup Safe Paths (C:\Temp)
                // We use the same path that syncToStaging() used (/mnt/c/Temp/ai-ext-preview)
                const winStagingDir = 'C:\\Temp\\ai-ext-preview';
                const winProfile = 'C:\\Temp\\ai-ext-profile';
                let userProfileWin = 'C:\\Temp'; // Legacy variable support


                const driveLetter = 'c';

                // Calculate final paths
                let finalWinExtensionPath = winStagingDir;

                // Handle nested extension root
                if (extensionRoot !== STAGING_DIR) {
                    const relative = path.relative(STAGING_DIR, extensionRoot);
                    finalWinExtensionPath = path.posix.join(winStagingDir.replace(/\\/g, '/'), relative).replace(/\//g, '\\');
                }

                const winChromePath = chromePath
                    .replace(new RegExp(`^/mnt/${driveLetter}/`), `${driveLetter.toUpperCase()}:\\`)
                    .replace(/\//g, '\\');


                await ctx.actions.runAction('core:log', { level: 'info', message: `WSL Launch Target (Win): ${finalWinExtensionPath}` });
                // await ctx.actions.runAction('core:log', { level: 'info', message: `WSL Profile (Win): ${winProfile}` });

                // Create PowerShell Launch Script
                const psContent = `
$chromePath = "${winChromePath}"
$extPath = "${finalWinExtensionPath}"
$profilePath = "${winProfile}"

Write-Host "DEBUG: ChromePath: $chromePath"
Write-Host "DEBUG: ExtPath: $extPath"
Write-Host "DEBUG: ProfilePath: $profilePath"

# Verify Paths
if (-not (Test-Path -Path $extPath)) {
    Write-Host "ERROR: Extension Path NOT FOUND!"
} else {
    Write-Host "DEBUG: Extension Path Exists."
}

# Create Profile Dir if needed
if (-not (Test-Path -Path $profilePath)) {
    New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
}

$argsList = @(
    "--load-extension=""$extPath""",
    "--user-data-dir=""$profilePath""",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "about:blank"
)

# Convert to single string to ensure Start-Process handles it safely
$argStr = $argsList -join " "
Write-Host "DEBUG: Args: $argStr"

Write-Host "DEBUG: Launching Chrome..."
Start-Process -FilePath $chromePath -ArgumentList $argStr
`;
                // Write ps1 to /mnt/c/Temp/ai-ext-preview/launch.ps1 (Same as STAGING_DIR)
                const psPath = path.join(STAGING_DIR, 'launch.ps1');

                try {
                    await fs.writeFile(psPath, psContent);
                } catch (e: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `WSL Write PS1 Failed: ${e.message}` });
                }

                // Execute via PowerShell (Spawn detached)
                // psPathWin is C:\\Temp\\ai-ext-preview\\launch.ps1
                const psPathWin = `${winStagingDir}\\launch.ps1`;
                const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPathWin], {
                    detached: true,
                    stdio: ['ignore', 'pipe', 'pipe'] // Pipe stderr AND stdout to catch launch errors/debug
                });

                if (child.stdout) {
                    child.stdout.on('data', async (chunk) => {
                        const msg = chunk.toString();
                        await ctx.actions.runAction('core:log', { level: 'info', message: `[PS1] ${msg.trim()}` });
                    });
                }

                if (child.stderr) {
                    child.stderr.on('data', async (chunk) => {
                        const msg = chunk.toString();
                        await ctx.actions.runAction('core:log', { level: 'error', message: `Launch Error (Stderr): ${msg}` });

                        if (msg.includes('Exec format error')) {
                            await ctx.actions.runAction('core:log', { level: 'error', message: `CRITICAL: WSL Interop is broken. Cannot launch Chrome.` });
                            await ctx.actions.runAction('core:log', { level: 'error', message: `FIX: Open PowerShell as Admin and run: wsl --shutdown` });
                            ctx.events.emit('browser:launch-failed', { reason: 'WSL_INTEROP_BROKEN' });
                        }
                    });
                }

                child.on('error', async (err) => {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Launch Failed: ${err.message}` });
                    ctx.events.emit('browser:launch-failed', { reason: err.message });
                });

                child.unref();
                return true;
            } else {
                // Native Windows / Linux
                // Use extensionRoot which points to the detected subfolder or root
                let safeDist = path.resolve(extensionRoot);
                let safeProfile = path.join(path.dirname(config.workDir), 'profile'); // Default Linux/Mac



                // FIX: On Git Bash (win32), ensure paths are C:\Style for Chrome
                if (process.platform === 'win32') {
                    safeDist = normalizePathToWindows(safeDist);
                    // Use C:\Temp profile to avoid permissions issues, matching WSL strategy
                    safeProfile = WIN_PROFILE_DIR;
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
