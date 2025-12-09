/* eslint-disable no-restricted-globals */
import { createChromeMock } from './bridge';

// This file is compiled by Vite and imported as a raw string
const ctx: Worker = self as any;

let chromeMock: any;
let storageFn = {}; // Simple in-memory mock until init

ctx.onmessage = (e) => {
    const { type, code } = e.data;

    if (type === 'INIT') {
        // Initialize the Chrome Mock
        chromeMock = createChromeMock(
            (msg) => ctx.postMessage(msg),
            'background',
            storageFn
        );

        // Assign global `chrome`
        (self as any).chrome = chromeMock;

        // Log
        ctx.postMessage({ type: 'log', content: 'Host Worker Initialized' });
    }

    if (type === 'LOAD_CODE') {
        try {
            // For simple scripts (non-module) or legacy
            const runUserCode = new Function('chrome', code);
            runUserCode(chromeMock);
            ctx.postMessage({ type: 'log', content: 'User Code Executed (Script Mode)' });
        } catch (err: any) {
            ctx.postMessage({ type: 'log', content: `Error running background script: ${err.message}` });
        }
    }

    if (type === 'LOAD_MODULE') {
        const { url } = e.data;
        try {
            // For ES Modules (supports import/export)
            // We use dynamic import which treats the blob as a module
            import(url)
                .then(() => {
                    ctx.postMessage({ type: 'log', content: 'User Code Executed (Module Mode)' });
                })
                .catch((err) => {
                    ctx.postMessage({ type: 'log', content: `Module Import Error: ${err.message}` });
                    console.error('Module Import Error details:', err);
                });
        } catch (err: any) {
            ctx.postMessage({ type: 'log', content: `Error initiating import: ${err.message}` });
        }
    }
};
