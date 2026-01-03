
import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export class SandboxRunner {
    /**
     * Materializes files to a temp directory and validates them.
     */
    static async validateFiles(files: Record<string, any>): Promise<{ success: boolean; logs: string[]; error?: string }> {
        const runId = uuidv4();
        const tmpDir = path.join(os.tmpdir(), `ai-ext-test-${runId}`);

        try {
            // 1. Write files
            fs.mkdirSync(tmpDir, { recursive: true });

            for (const [filename, content] of Object.entries(files)) {
                if (!content) continue;

                const filePath = path.join(tmpDir, filename);
                const fileDir = path.dirname(filePath);

                if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

                if (Buffer.isBuffer(content) || typeof content === 'object') { // handle buffers/uint8array
                    // simpler check for binary
                    if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
                        fs.writeFileSync(filePath, content);
                    } else {
                        // Fallback for objects (stringify? or skip?)
                        // Usually string or buffer.
                        fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
                    }
                } else {
                    fs.writeFileSync(filePath, String(content));
                }
            }

            // 2. Validate
            return await this.validateExtension(tmpDir);

        } catch (error) {
            return { success: false, logs: [], error: `Setup failed: ${error}` };
        } finally {
            // 3. Cleanup
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (e) { /* ignore */ }
        }
    }

    /**
     * Launch a headless browser with the extension loaded.
     * @param extensionPath Absolute path to the unpacked extension directory
     */
    static async validateExtension(extensionPath: string): Promise<{ success: boolean; logs: string[]; error?: string }> {
        let browser;
        const logs: string[] = [];

        try {
            console.log(`[Sandbox] Launching Check for: ${extensionPath}`);

            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    `--disable-extensions-except=${extensionPath}`,
                    `--load-extension=${extensionPath}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });

            // We need to wait a bit for the background worker to initialize
            await new Promise(r => setTimeout(r, 2000));

            // Check if we can find the background page/worker target
            const targets = await browser.targets();
            const backgroundTarget = targets.find(t => t.type() === 'service_worker' || t.type() === 'background_page');

            if (!backgroundTarget) {
                return { success: false, logs, error: 'Background Service Worker failed to start.' };
            }

            return { success: true, logs: ['Background worker started successfully.'] };

        } catch (error) {
            console.error('[Sandbox] Error:', error);
            return {
                success: false,
                logs,
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            if (browser) await browser.close();
        }
    }
}
