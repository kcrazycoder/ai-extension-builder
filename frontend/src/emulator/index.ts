/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Extension } from '../types';
import type { EmulatorMessage } from './bridge';

// Use Vite's inline worker features to bundle dependencies (bridge.ts) correctly
import HostWorker from './host.worker?worker&inline';

export class EmulatorEngine {
    private extension: Extension;
    private backgroundWorker: Worker | null = null;
    private logCallback: (log: string) => void;

    // In-memory storage for the simulation
    private storage: Record<string, any> = {};

    constructor(extension: Extension, onLog: (log: string) => void) {
        this.extension = extension;
        this.logCallback = onLog;
    }

    public start() {
        this.logCallback('🚀 Starting Emulator...');
        this.setupBackground();
    }

    public stop() {
        if (this.backgroundWorker) {
            this.backgroundWorker.terminate();
            this.backgroundWorker = null;
        }
        this.logCallback('🛑 Emulator Stopped.');
    }

    public getExtensionId() {
        return this.extension.id;
    }

    // --- Background Service Worker ---

    private setupBackground() {
        this.logCallback('⚙️ Initializing Background Worker...');

        // Initialize the worker using the bundled class from Vite
        this.backgroundWorker = new HostWorker();

        this.backgroundWorker.onmessage = (e) => {
            this.handleMessageFromWorker(e.data);
        };

        // Initialize the worker
        this.backgroundWorker.postMessage({ type: 'INIT', extensionId: this.extension.id });
    }

    public injectBackgroundCode(code: string) {
        if (this.backgroundWorker) {
            // Check if code looks like a module (has import/export) or default to module for modern Vite apps
            // It's safer to always try module if we control the environment, but let's just use module for everything.
            // Exception: classic scripts that rely on global var scope sharing might strictly need 'script'.
            // But since we are mocking a "Service Worker" (Manifest V3), it IS a module by default usually.

            const blob = new Blob([code], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);

            this.backgroundWorker.postMessage({ type: 'LOAD_MODULE', url });
            this.logCallback('✅ Background Module Loading...');
        }
    }

    // --- Message Routing ---

    private handleMessageFromWorker(data: EmulatorMessage | any) {
        if (data.type === 'log') {
            this.logCallback(`[Background] ${data.content}`);
            return;
        }

        if (data.type === 'runtime.sendMessage') {
            const { message } = data;
            this.logCallback(`[Bus] Message: ${JSON.stringify(message)}`);

            // Route to Popup (if exists)
            // Implementation TODO: Need reference to Iframe
        }

        // Handle Storage updates
        if (data.type === 'storage.set') {
            Object.assign(this.storage, data.items);
            this.logCallback(`[Storage] Updated: ${JSON.stringify(data.items)}`);
        }
    }
}
