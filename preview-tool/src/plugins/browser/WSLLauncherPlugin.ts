import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { findChrome } from '../../utils/browserUtils.js';

export const WSLLauncherPlugin: PluginDefinition = {
    name: 'wsl-launcher',
    version: '1.0.0',
    setup(ctx: RuntimeContext) {
        // Only active in WSL
        const isWSL = fs.existsSync('/mnt/c');
        if (!isWSL) return;

        ctx.actions.registerAction({
            id: 'launcher:launch',
            handler: async (payload: { extensionPath: string, stagingDir: string }) => {
                const chromePath = findChrome();
                if (!chromePath) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: 'Chrome not found for detached launch.' });
                    return false;
                }

                // Hardcoded Safe Paths for WSL Strategy
                const winStagingDir = 'C:\\Temp\\ai-ext-preview';
                const winProfile = 'C:\\Temp\\ai-ext-profile';

                // Calculate Final Windows Extension Path
                // We assume payload.extensionPath starts with /mnt/c/Temp/ai-ext-preview
                // But simplified: We know we sync to STAGING_DIR.
                // If extensionPath is nested, we handle it relative to STAGING_DIR.

                let finalWinExtensionPath = winStagingDir;
                if (payload.extensionPath !== payload.stagingDir) {
                    const relative = path.relative(payload.stagingDir, payload.extensionPath);
                    // Join with backslashes
                    finalWinExtensionPath = path.posix.join(winStagingDir.replace(/\\/g, '/'), relative).replace(/\//g, '\\');
                }

                const driveLetter = 'c';
                const winChromePath = chromePath
                    .replace(new RegExp(`^/mnt/${driveLetter}/`), `${driveLetter.toUpperCase()}:\\`)
                    .replace(/\//g, '\\');

                await ctx.actions.runAction('core:log', { level: 'info', message: `WSL Launch Target (Win): ${finalWinExtensionPath}` });

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
                // Write ps1 to STAGING_DIR/launch.ps1
                const psPath = path.join(payload.stagingDir, 'launch.ps1');
                try {
                    await fs.writeFile(psPath, psContent);
                } catch (e: any) {
                    await ctx.actions.runAction('core:log', { level: 'error', message: `WSL Write PS1 Failed: ${e.message}` });
                    return false;
                }

                // Execute via PowerShell (Spawn detached)
                const psPathWin = `${winStagingDir}\\launch.ps1`;
                const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPathWin], {
                    detached: true,
                    stdio: ['ignore', 'pipe', 'pipe']
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
                        // Ignore minor PS noise unless critical
                        if (msg.includes('Exec format error')) {
                            await ctx.actions.runAction('core:log', { level: 'error', message: `CRITICAL: WSL Interop broken.` });
                        } else {
                            await ctx.actions.runAction('core:log', { level: 'error', message: `Launch Error: ${msg}` });
                        }
                    });
                }
                child.unref();

                return true;
            }
        });
    }
};
