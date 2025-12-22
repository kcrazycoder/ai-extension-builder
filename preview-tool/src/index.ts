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
import { BrowserPlugin } from './plugins/BrowserPlugin.js';

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

async function authenticate(host: string): Promise<{ jobId: string; userId: string; token: string }> {
    try {
        // 1. Init Session
        const initRes = await axios.post(`${host}/preview/init`);
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
                    return {
                        jobId: data.jobId,
                        userId: data.userId,
                        token: 'session:' + sessionId // Use session ID as token for now
                    };
                }
                if (data.status === 'expired') {
                    console.error(chalk.red('Code expired. Please restart.'));
                    process.exit(1);
                }
            } catch (e) {
                // Ignore transient network errors
            }
        }
    } catch (error: any) {
        console.error(chalk.red(`Failed to initialize session: ${error.message}`));
        process.exit(1);
    }
}

async function main() {
    let jobId = options.job;
    let userId = options.user;
    let token = options.token;
    const host = options.host;

    // Interactive Auth Flow if no Job ID provided
    if (!jobId) {
        const authData = await authenticate(host);
        jobId = authData.jobId;
        userId = authData.userId || userId;
        token = authData.token || token;
    }

    // Use os.homedir() to ensure we have write permissions
    // Git Bash sometimes defaults cwd to C:\Program Files\Git which causes EPERM
    const HOME_DIR = os.homedir();
    const WORK_DIR = path.join(HOME_DIR, '.ai-extension-preview', jobId);

    // 1. Initialize Runtime
    const runtime = new Runtime({
        hostContext: {
            config: {
                host,
                token,
                user: userId,
                jobId,
                workDir: WORK_DIR
            }
        }
    });


    // 2. Register Plugins
    // Note: In a real dynamic system we might load these from a folder
    runtime.logger.info('Registering plugins...');
    runtime.registerPlugin(CorePlugin);
    runtime.registerPlugin(DownloaderPlugin);
    runtime.registerPlugin(BrowserPlugin);

    runtime.logger.info('Initializing runtime...');
    await runtime.initialize();

    const ctx = runtime.getContext();

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

    // Start Browser (This will block until browser is closed OR return immediately if detached)
    const browserSessionResult = await ctx.actions.runAction('browser:start', null);

    // If detached launch (result=true) or web-ext blocked and finished...
    // We should ONLY exit if the loop is also done (which it never is unless disposed).
    // Actually, if web-ext finishes (e.g. user closed browser), we might want to exit?
    // But for Detached Mode, we MUST stay open to poll updates.

    // If browser:start returned, it means either:
    // 1. Browser closed (web-ext mode) -> we arguably should exit.
    // 2. Detached mode started -> we MUST NOT exit.

    // Changing logic: rely on SIGINT to exit.
    runtime.logger.info('Press Ctrl+C to exit.');
}

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

main().catch(err => {
    console.error(chalk.red('Fatal Error:'), err.message || err);
    process.exit(1);
});
