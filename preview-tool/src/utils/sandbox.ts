
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs-extra';
import { spawn, execSync } from 'child_process';
import axios from 'axios';
import { findChrome } from './browserUtils.js';

export interface VerificationResult {
    success: boolean;
    logs: string[];
    error?: string;
}

export class SandboxRunner {
    /**
     * Launch a headless browser with the extension loaded to verify it can initialize.
     * @param extensionPath Absolute path to the unpacked extension directory
     * @param chromePath Optional path to Chrome executable. If not provided, attempts to auto-detect.
     */
    static async validateExtensionRuntime(extensionPath: string, chromePath?: string): Promise<VerificationResult> {
        const logs: string[] = [];
        const executablePath = chromePath || findChrome();

        if (!executablePath) {
            return {
                success: false,
                logs,
                error: 'Chrome executable not found. Cannot run verification.'
            };
        }

        const isWSL = executablePath.startsWith('/mnt/');

        if (isWSL) {
            logs.push('[Sandbox] WSL Environment detected. Using "Spawn & Connect" strategy.');
            return this.runWSLCheck(extensionPath, executablePath, logs);
        } else {
            return this.runStandardCheck(extensionPath, executablePath, logs);
        }
    }

    private static async runStandardCheck(extensionPath: string, executablePath: string, logs: string[]): Promise<VerificationResult> {
        let browser;
        try {
            logs.push(`[Sandbox] Launching standard verification for: ${extensionPath}`);
            logs.push(`[Sandbox] Using Chrome at: ${executablePath}`);

            browser = await puppeteer.launch({
                headless: true,
                executablePath: executablePath,
                args: [
                    `--disable-extensions-except=${extensionPath}`,
                    `--load-extension=${extensionPath}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });

            return await this.performChecks(browser, extensionPath, logs);
        } catch (error) {
            console.error('[Sandbox] Standard Launch Error:', error);
            return { success: false, logs, error: error instanceof Error ? error.message : String(error) };
        } finally {
            if (browser) await browser.close();
        }
    }

    private static async runWSLCheck(extensionPath: string, linuxChromePath: string, logs: string[]): Promise<VerificationResult> {
        let browser;
        let chromePid: number | null = null;

        try {
            // 1. Path Conversion (Linux -> Windows)
            const driveMatch = linuxChromePath.match(/^\/mnt\/([a-z])\//);
            if (!driveMatch) throw new Error(`Could not parse drive letter from ${linuxChromePath}`);
            const driveLetter = driveMatch[1];

            const winChromePath = linuxChromePath
                .replace(new RegExp(`^/mnt/${driveLetter}/`), `${driveLetter.toUpperCase()}:\\`)
                .replace(/\//g, '\\');

            // 1b. Detect Host IP (WSL DNS Resolver IP)
            let hostIp = '127.0.0.1';
            try {
                const resolveConf = fs.readFileSync('/etc/resolv.conf', 'utf-8');
                const match = resolveConf.match(/nameserver\s+([\d.]+)/);
                if (match) hostIp = match[1];
                logs.push(`[Sandbox] Host IP detected: ${hostIp}`);
            } catch (e) {
                logs.push(`[Sandbox] Failed to detect Host IP, fallback to 127.0.0.1: ${e}`);
            }

            let winExtensionPath = extensionPath;
            const extDriveMatch = extensionPath.match(/^\/mnt\/([a-z])\//);
            if (extDriveMatch) {
                winExtensionPath = extensionPath
                    .replace(new RegExp(`^/mnt/${extDriveMatch[1]}/`), `${extDriveMatch[1].toUpperCase()}:\\`)
                    .replace(/\//g, '\\');
            } else {
                logs.push('[Sandbox] WARNING: Extension path is not in /mnt/. Windows Chrome might not see it.');
            }

            // 2. Spawn Chrome via PowerShell
            const port = 9222;
            const winProfile = `C:\\Temp\\ai-ext-sandbox-${Date.now()}`;

            const args = [
                `--headless=new`,
                `--disable-extensions-except="${winExtensionPath}"`,
                `--load-extension="${winExtensionPath}"`,
                `--user-data-dir="${winProfile}"`,
                '--no-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-default-browser-check',
                `--remote-debugging-port=${port}`,
                `--remote-debugging-address=0.0.0.0`, // Bind to all interfaces so WSL can see it
                `--remote-allow-origins=*` // Allow puppeteer connection
            ];

            const psCommand = `Start-Process -FilePath "${winChromePath}" -ArgumentList '${args.join(' ')}' -PassThru`;

            logs.push(`[Sandbox] Spawning Chrome via PowerShell on port ${port}...`);
            logs.push(`[Sandbox] Profile: ${winProfile}`);

            const child = spawn('powershell.exe', ['-Command', psCommand], { stdio: 'pipe' });

            await new Promise<void>((resolve, reject) => {
                child.stdout.on('data', (data) => {
                    const output = data.toString();
                    const match = output.match(/\s+(\d+)\s+\d+\s+chrome/i) || output.match(/Id\s+:\s+(\d+)/);
                    if (match) {
                        chromePid = parseInt(match[1], 10);
                        logs.push(`[Sandbox] Chrome PID: ${chromePid}`);
                    }
                });
                child.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`PowerShell exited with code ${code}`));
                });
            });

            // 3. Wait for Port
            logs.push('[Sandbox] Waiting for Chrome to accept connections...');
            let connected = false;
            // Increased timeout to 15s (30 * 500ms)
            for (let i = 0; i < 30; i++) {
                try {
                    // Use hostIp, not localhost
                    await axios.get(`http://${hostIp}:${port}/json/version`, { timeout: 1000 });
                    connected = true;
                    break;
                } catch (e) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            if (!connected) throw new Error(`Timed out waiting for Chrome debug port ${port}`);

            // 4. Connect Puppeteer
            logs.push('[Sandbox] Connecting Puppeteer...');
            browser = await puppeteer.connect({
                browserURL: `http://${hostIp}:${port}`
            });

            // 5. Perform Checks
            const result = await this.performChecks(browser, extensionPath, logs);

            return result;

        } catch (error) {
            console.error('[Sandbox] WSL Check Error:', error);
            return { success: false, logs, error: error instanceof Error ? error.message : String(error) };
        } finally {
            if (browser) await browser.disconnect();

            if (chromePid) {
                logs.push(`[Sandbox] Killing Chrome PID ${chromePid}...`);
                try {
                    execSync(`powershell.exe -Command "Stop-Process -Id ${chromePid} -Force"`);
                } catch (e) { /* ignore */ }
            }
        }
    }

    private static async performChecks(browser: puppeteer.Browser, extensionPath: string, logs: string[]): Promise<VerificationResult> {
        await new Promise(r => setTimeout(r, 2000));

        const targets = await browser.targets();
        const backgroundTarget = targets.find(t => t.type() === 'service_worker' || t.type() === 'background_page');

        if (!backgroundTarget) {
            const manifestPath = path.join(extensionPath, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = await fs.readJson(manifestPath);
                if (manifest.background) {
                    return { success: false, logs, error: 'Background Service Worker defined in manifest but failed to start.' };
                } else {
                    logs.push('[Sandbox] No background script defined in manifest. Skipping worker check.');
                }
            }
        } else {
            logs.push('Background worker started successfully.');
        }

        return { success: true, logs };
    }
}
