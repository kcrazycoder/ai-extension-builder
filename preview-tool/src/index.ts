#!/usr/bin/env node
import 'dotenv/config'; // Load .env
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { Runtime } from 'skeleton-crew-runtime';

import { PreviewConfig, PreviewContext } from './types.js';


import chalk from 'chalk';

const DEFAULT_HOST: string = process.env.API_HOST || 'https://ai-extension-builder.01kb6018z1t9tpaza4y5f1c56w.lmapp.run/api';

const program = new Command();

program
    .name('preview')
    .description('Live preview companion for AI Extension Builder')
    .option('--job <job>', 'Job ID to preview')
    .option('--host <host>', 'API Host URL', DEFAULT_HOST)
    .option('--token <token>', 'Auth Token (if required)')
    .option('--user <user>', 'User ID (if required)')
    .parse(process.argv);

const options = program.opts<{ job: string; host: string; token?: string; user?: string }>();

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use os.homedir() to ensure we have write permissions
const HOME_DIR = os.homedir();
// Initial workdir based on options, or specific 'default' if not yet known.
// AuthPlugin will update this if job changes.
const WORK_DIR = path.join(HOME_DIR, '.ai-extension-preview', options.job || 'default');

(async () => {
    const { job: initialJobId, host, token, user: userId } = options;

    // 1. Initialize Runtime with Config
    // Fix for Windows: Glob patterns in SCR DirectoryLoader require forward slashes
    const pluginDir = path.join(__dirname, 'plugins').replace(/\\/g, '/');

    const runtime = new Runtime<PreviewConfig>({
        config: {
            host,
            token: token || '',
            user: userId || '',
            jobId: initialJobId || '',
            workDir: WORK_DIR
        },
        hostContext: {}, // Clear hostContext config wrapping
        pluginPaths: [pluginDir] // [NEW] Auto-discovery
    });

    // Register Plugins
    runtime.logger.info(`Loading plugins from: ${pluginDir}`);
    runtime.logger.info('Initializing runtime...');
    await runtime.initialize();

    const ctx = runtime.getContext();

    // 2. Start App Flow
    try {
        await ctx.actions.runAction('app:start', null);
    } catch (error: any) {
        console.error(chalk.red('App Error:'), error.message);
        await runtime.shutdown();
        process.exit(1);
    }

    // Keep process alive handled by Node event loop because ServerPlugin has an open server
    // and Browser processes might be attached. 

    // Graceful Shutdown
    process.on('SIGINT', async () => {
        await ctx.actions.runAction('core:log', { level: 'info', message: 'Shutting down...' });
        await runtime.shutdown();
        process.exit(0);
    });

    runtime.logger.info('Press Ctrl+C to exit.');
})().catch((err: any) => {
    console.error(chalk.red('Fatal Error:'), err.message || err);
    process.exit(1);
});

// Handle global errors
process.on('uncaughtException', (err: any) => {
    if (err.code === 'ECONNRESET' || err.message?.includes('ECONNRESET')) {
        return;
    }
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});
