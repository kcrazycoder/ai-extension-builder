#!/usr/bin/env node
import 'dotenv/config'; // Load .env
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import os from 'os';
import { Runtime } from 'skeleton-crew-runtime';

import { PreviewConfig, PreviewContext } from './types.js'; // [NEW] Typed Context
import { ConfigPlugin } from './plugins/ConfigPlugin.js'; // [NEW] Config Plugin
import { CorePlugin } from './plugins/CorePlugin.js';
import { DownloaderPlugin } from './plugins/DownloaderPlugin.js';
import { BrowserManagerPlugin } from './plugins/browser/BrowserManagerPlugin.js';
import { WSLLauncherPlugin } from './plugins/browser/WSLLauncherPlugin.js';
import { NativeLauncherPlugin } from './plugins/browser/NativeLauncherPlugin.js';
import { ServerPlugin } from './plugins/ServerPlugin.js';

import axios from 'axios';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function authenticate(host: string, port: number): Promise<{ jobId: string; userId: string; token: string }> {
    try {
        // 1. Init Session with port
        console.log('[DEBUG] Sending port to backend:', port);
        const initRes = await axios({
            method: 'post',
            url: `${host}/preview/init`,
            data: { port },
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('[DEBUG] Init response:', initRes.data);
        const { code, sessionId } = initRes.data;

        console.log('\n' + chalk.bgBlue.bold(' DETACHED PREVIEW MODE ') + '\n');
        console.log('To connect, please go to your Extension Dashboard and click "Connect Preview".');
        console.log('Enter the following code:');
        console.log('\n' + chalk.green.bold(`  ${code}  `) + '\n');
        console.log('Waiting for connection...');

        // 2. Poll for Status
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                const statusRes = await axios.get(`${host}/preview/status/${sessionId}`);
                const data = statusRes.data;

                if (data.status === 'linked') {
                    console.log(chalk.green('✔ Connected!'));
                    if (!data.jobId) {
                        console.error('Error: No Job ID associated with this connection.');
                        process.exit(1);
                    }
                    console.log('[DEBUG] Received userId:', data.userId);
                    console.log('[DEBUG] Received jobId:', data.jobId);
                    return {
                        jobId: data.jobId,
                        userId: data.userId,
                        token: data.token || ''
                    };
                }
                if (data.status === 'expired') {
                    console.error(chalk.red('Code expired. Please restart.'));
                    process.exit(1);
                }
            } catch (err) {
                // Ignore poll errors, keep trying
            }
        }
    } catch (error: any) {
        console.error('Authentication failed:', error);
        throw error;
    }
}

// Use os.homedir() to ensure we have write permissions
// Git Bash sometimes defaults cwd to C:\Program Files\Git which causes EPERM
const HOME_DIR = os.homedir();
const WORK_DIR = path.join(HOME_DIR, '.ai-extension-preview', options.job || 'default'); // Use default if job not provided yet

(async () => {
    const { job: initialJobId, host, token, user: userId } = options;

    // 1. Initialize Runtime with Partial Config (JobId might be missing)
    const runtime = new Runtime({
        hostContext: {
            config: {
                host,
                token: token || '',
                user: userId || '',
                jobId: initialJobId || '', // Might be empty initially
                workDir: WORK_DIR
            }
        }
    });

    // Register Plugins
    runtime.logger.info('Registering plugins...');
    runtime.registerPlugin(CorePlugin);
    runtime.registerPlugin(ConfigPlugin); // [NEW]
    runtime.registerPlugin(DownloaderPlugin);
    runtime.registerPlugin(BrowserManagerPlugin);
    runtime.registerPlugin(WSLLauncherPlugin);
    runtime.registerPlugin(NativeLauncherPlugin);
    runtime.registerPlugin(ServerPlugin);

    runtime.logger.info('Initializing runtime...');
    await runtime.initialize();

    const ctx = runtime.getContext() as PreviewContext; // [NEW] Typed Context

    // Get allocated port from ServerPlugin
    const allocatedPort = (ctx as any).hotReloadPort;
    if (!allocatedPort) {
        console.error('Failed to allocate server port');
        process.exit(1);
    }

    // 2. Authenticate if necessary
    let finalJobId = initialJobId;
    let finalUserId = userId;
    let finalToken = token;

    if (!initialJobId || !userId) {
        const authData = await authenticate(host, allocatedPort);
        finalJobId = authData.jobId;
        finalUserId = authData.userId;
        finalToken = authData.token;

        // Update runtime config with auth data
        ctx.host.config.jobId = finalJobId;
        ctx.host.config.user = finalUserId;
        ctx.host.config.token = finalToken;
        ctx.host.config.workDir = path.join(HOME_DIR, '.ai-extension-preview', finalJobId); // Update WorkDir with correct JobID
    }

    // 3. Validate Configuration [NEW]
    try {
        await ctx.actions.runAction('config:validate', null);
    } catch (e) {
        console.error(chalk.red('Configuration Error:'), (e as any).message);
        process.exit(1);
    }

    // 4. Start LifeCycle
    await ctx.actions.runAction('core:log', { level: 'info', message: 'Initializing Local Satellite...' });

    // Ensure work dir exists (using updated config)
    await fs.ensureDir(ctx.host.config.workDir);

    // Initial Check
    const success = await ctx.actions.runAction('downloader:check', null);
    if (!success) {
        await ctx.actions.runAction('core:log', { level: 'error', message: 'Initial check failed. Could not verify job or download extension.' });
        process.exit(1);
    }

    // Wait for Extension files (Manifest)
    const manifestPath = path.join(ctx.host.config.workDir, 'dist', 'manifest.json');
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes

    console.log('[DEBUG] Waiting for extension files...');
    while (!fs.existsSync(manifestPath) && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
        if (attempts % 5 === 0) console.log(`Waiting for extension generation... (${attempts * 2}s)`);
    }

    if (!fs.existsSync(manifestPath)) {
        await ctx.actions.runAction('core:log', { level: 'error', message: 'Timed out waiting for extension files. Status check succeeded but files are missing.' });
        process.exit(1);
    }

    // Launch Browser
    await ctx.actions.runAction('browser:start', {});

    // Keep process alive
    process.on('SIGINT', async () => {
        await ctx.actions.runAction('core:log', { level: 'info', message: 'Shutting down...' });
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
        // Ignore pipe errors frequently caused by web-ext/chrome teardown
        return;
    }
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});
