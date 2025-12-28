#!/usr/bin/env node
import 'dotenv/config'; // Load .env
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import os from 'os';
import { Runtime } from 'skeleton-crew-runtime';

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
    const { job: jobId, host, token, user: userId } = options;

    // 1. Initialize Runtime first to allocate port
    const runtime = new Runtime({
        hostContext: {
            config: {
                host,
                token: token || '',
                user: userId || '',
                jobId: jobId || '',
                workDir: WORK_DIR
            }
        }
    });

    runtime.logger.info('Registering plugins...');
    runtime.registerPlugin(CorePlugin);
    runtime.registerPlugin(DownloaderPlugin);
    runtime.registerPlugin(BrowserManagerPlugin);
    runtime.registerPlugin(WSLLauncherPlugin);
    runtime.registerPlugin(NativeLauncherPlugin);
    runtime.registerPlugin(ServerPlugin);

    runtime.logger.info('Initializing runtime...');
    await runtime.initialize();

    const ctx = runtime.getContext();

    // Get allocated port from ServerPlugin
    const allocatedPort = (ctx as any).hotReloadPort;
    if (!allocatedPort) {
        console.error('Failed to allocate server port');
        process.exit(1);
    }

    // 2. Now authenticate with the allocated port
    let finalJobId = jobId;
    let finalUserId = userId;
    let finalToken = token;

    if (!jobId || !userId) {
        const authData = await authenticate(host, allocatedPort);
        finalJobId = authData.jobId;
        finalUserId = authData.userId;
        finalToken = authData.token;

        // Update runtime config with auth data
        (ctx.host.config as any).jobId = finalJobId;
        (ctx.host.config as any).user = finalUserId;
        (ctx.host.config as any).token = finalToken;
    }

    // 3. Start LifeCycle
    await ctx.actions.runAction('core:log', { level: 'info', message: 'Initializing Local Satellite...' });

    // Ensure work dir exists
    await fs.ensureDir(WORK_DIR);

    // Initial Check - Must succeed to continue
    const success = await ctx.actions.runAction('downloader:check', null);
    if (!success) {
        await ctx.actions.runAction('core:log', { level: 'error', message: 'Initial check failed. Could not verify job or download extension.' });
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
