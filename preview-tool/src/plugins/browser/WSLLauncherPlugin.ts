import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { findChrome } from '../../utils/browserUtils.js';
import { PreviewConfig } from '../../types.js';

let chromePid: number | null = null;

const WSLLauncherPlugin: PluginDefinition<PreviewConfig> = {
    name: 'wsl-launcher',
    version: '1.0.0',
    dependencies: ['config'],
    setup(ctx: RuntimeContext<PreviewConfig>) {
        // Only active in WSL
        const isWSL = fs.existsSync('/mnt/c');
        if (!isWSL) return;

        ctx.actions.registerAction({
            id: 'launcher:launch',
            handler: async (payload: { extensionPath: string, stagingDir: string }) => {
                const chromePath = findChrome();
                if (!chromePath) {
                    await ctx.logger.error('Chrome not found for detached launch.');
                    return false;
                }

                // Hardcoded Safe Paths for WSL Strategy
                const winStagingDir = 'C:\\\\Temp\\\\ai-ext-preview';
                const winProfile = 'C:\\\\Temp\\\\ai-ext-profile';

                // Calculate Final Windows Extension Path
                // We assume payload.extensionPath starts with /mnt/c/Temp/ai-ext-preview
                // But simplified: We know we sync to STAGING_DIR.
                // If extensionPath is nested, we handle it relative to STAGING_DIR.

                let finalWinExtensionPath = winStagingDir;
                if (payload.extensionPath !== payload.stagingDir) {
                    const relative = path.relative(payload.stagingDir, payload.extensionPath);
                    // Join with backslashes
                    finalWinExtensionPath = path.posix.join(winStagingDir.replace(/\\\\/g, '/'), relative).replace(/\//g, '\\\\');
                }

                const driveLetter = 'c';
                const winChromePath = chromePath
                    .replace(new RegExp(`^/mnt/${driveLetter}/`), `${driveLetter.toUpperCase()}:\\\\`)
                    .replace(/\//g, '\\\\');

                await ctx.logger.info(`WSL Launch Target (Win): ${finalWinExtensionPath}`);

                // Create PowerShell Launch Script with PID capture
                const psContent = `
$chromePath = "${winChromePath}"
$extPath = "${finalWinExtensionPath}"
$profilePath = "${winProfile}"

# Verify Paths
if (-not (Test-Path -Path $extPath)) {
    Write-Host "ERROR: Extension Path NOT FOUND!"
    exit 1
}

# Create Profile Dir if needed
if (-not (Test-Path -Path $profilePath)) {
    New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
}

$argsList = @(
    "--load-extension=\`"$extPath\`"",
    "--user-data-dir=\`"$profilePath\`"",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "about:blank"
)

# Launch and capture PID
$process = Start-Process -FilePath $chromePath -ArgumentList $argsList -PassThru
Write-Host "CHROME_PID:$($process.Id)"
`;
                // Write ps1 to STAGING_DIR/launch.ps1
                const psPath = path.join(payload.stagingDir, 'launch.ps1');
                try {
                    await fs.writeFile(psPath, psContent);
                } catch (e: any) {
                    await ctx.logger.error(`WSL Write PS1 Failed: ${e.message}`);
                    return false;
                }

                // Execute via PowerShell
                const psPathWin = `${winStagingDir}\\\\launch.ps1`;
                const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPathWin], {
                    detached: false,
                    stdio: ['ignore', 'pipe', 'pipe']
                });

                // Capture PID from output
                if (child.stdout) {
                    child.stdout.on('data', async (chunk) => {
                        const msg = chunk.toString();
                        const pidMatch = msg.match(/CHROME_PID:(\d+)/);
                        if (pidMatch) {
                            chromePid = parseInt(pidMatch[1], 10);
                            await ctx.logger.info(`Chrome launched with PID: ${chromePid}`);

                            // Start monitoring the process
                            monitorProcess(ctx, chromePid);
                        }
                        await ctx.logger.info(`[PS1] ${msg.trim()}`);
                    });
                }
                if (child.stderr) {
                    child.stderr.on('data', async (chunk) => {
                        const msg = chunk.toString();
                        // Ignore minor PS noise unless critical
                        if (msg.includes('Exec format error')) {
                            await ctx.logger.error(`CRITICAL: WSL Interop broken.`);
                        } else if (msg.trim()) {
                            await ctx.logger.error(`Launch Error: ${msg}`);
                        }
                    });
                }

                return true;
            }
        });

        // Register kill action
        ctx.actions.registerAction({
            id: 'launcher:kill',
            handler: async () => {
                if (chromePid) {
                    await ctx.logger.info(`Terminating Chrome process (PID: ${chromePid})...`);
                    try {
                        // 1. Try Stop-Process first (Graceful)
                        const killCmd = `
                            $targetPid = ${chromePid}
                            try { 
                                Stop-Process -Id $targetPid -Force -ErrorAction Stop
                                Write-Host "STOPPED"
                            } catch {
                                try {
                                    taskkill.exe /F /PID $targetPid
                                    Write-Host "TASKKILLED"
                                } catch {
                                    Write-Host "FAILED: $_" 
                                    exit 1
                                }
                            }
                        `;

                        const killChild = spawn('powershell.exe', ['-Command', killCmd], { stdio: 'pipe' });

                        // Capture output to debug why it might fail
                        if (killChild.stdout) {
                            killChild.stdout.on('data', d => ctx.logger.debug(`[KillParams] ${d}`));
                        }
                        if (killChild.stderr) {
                            killChild.stderr.on('data', d => ctx.logger.warn(`[KillMsg] ${d}`));
                        }

                        await new Promise<void>((resolve) => {
                            killChild.on('exit', (code) => {
                                resolve();
                            });
                        });

                        await ctx.logger.info('Chrome process termination signal sent.');
                        chromePid = null;
                        return true;
                    } catch (err: any) {
                        await ctx.logger.error(`Kill failed: ${err.message}`);
                        return false;
                    }
                }
                return false;
            }
        });

        // Helper function to monitor process
        function monitorProcess(ctx: RuntimeContext<PreviewConfig>, pid: number) {
            const checkInterval = setInterval(async () => {
                try {
                    const checkChild = spawn('powershell.exe', ['-Command', `Get-Process -Id ${pid} -ErrorAction SilentlyContinue`], {
                        stdio: 'pipe'
                    });

                    let output = '';
                    if (checkChild.stdout) {
                        checkChild.stdout.on('data', (chunk) => {
                            output += chunk.toString();
                        });
                    }

                    checkChild.on('exit', async (code) => {
                        if (!output.trim() || code !== 0) {
                            // Process no longer exists
                            clearInterval(checkInterval);
                            await ctx.logger.info('Chrome process exited.');
                            chromePid = null;
                            ctx.events.emit('browser:closed', { code: 0 });
                        }
                    });
                } catch (err) {
                    clearInterval(checkInterval);
                }
            }, 2000); // Check every 2 seconds
        }
    },
    dispose(ctx) {
        if (chromePid) {
            // Attempt to kill on cleanup
            spawn('powershell.exe', ['-Command', `Stop-Process -Id ${chromePid} -Force`], { stdio: 'ignore' });
            chromePid = null;
        }
    }
};

export default WSLLauncherPlugin;
