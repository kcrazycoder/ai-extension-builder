#!/usr/bin/env node
import { Command } from 'commander';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';
import webExt from 'web-ext';
import ora from 'ora';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
    .name('preview')
    .description('Live preview companion for AI Extension Builder')
    .requiredOption('--job <job>', 'Job ID to preview')
    .option('--host <host>', 'API Host URL', 'http://localhost:3000/api')
    .option('--token <token>', 'Auth Token (if required)')
    .option('--user <user>', 'User ID (if required)')
    .parse(process.argv);

const options = program.opts();

const WORK_DIR = path.join(process.cwd(), '.preview', options.job);
const DIST_DIR = path.join(WORK_DIR, 'dist');
const DOWNLOAD_PATH = path.join(WORK_DIR, 'extension.zip');

const client = axios.create({
    baseURL: options.host,
    headers: {
        'Authorization': options.token ? `Bearer ${options.token}` : undefined,
        'X-User-Id': options.user
    }
});

let currentVersion = '';
let lastModified = '';
let isRunning = false;
let checkInterval: NodeJS.Timeout;

async function setup() {
    await fs.ensureDir(DIST_DIR);
}

async function downloadAndExtract(jobId: string) {
    const spinner = ora('Downloading new version...').start();
    try {
        const response = await client.get(`/download/${jobId}`, {
            responseType: 'arraybuffer'
        });

        await fs.writeFile(DOWNLOAD_PATH, response.data);

        // Clear dist dir but keep it existing
        await fs.emptyDir(DIST_DIR);

        const zip = new AdmZip(DOWNLOAD_PATH);
        zip.extractAllTo(DIST_DIR, true);

        spinner.succeed(chalk.green('Updated extension code!'));
        return true;
    } catch (error: any) {
        spinner.fail(chalk.red(`Failed to download: ${error.message}`));
        return false;
    }
}

async function checkStatus() {
    try {
        const res = await client.get(`/jobs/${options.job}`);
        const job = res.data;

        // Check if we need update
        // Logic: If status is completed AND (version changed OR timestamp changed)
        const newVersion = job.version || '0.0.0';
        const newModified = job.completedAt || job.timestamp;

        if (job.status === 'completed') {
            if (newModified !== lastModified) {
                // Found update!
                if (isRunning) {
                    console.log(chalk.blue('\nDetected new version! Updating...'));
                }

                const success = await downloadAndExtract(options.job);
                if (success) {
                    lastModified = newModified;
                    currentVersion = newVersion;

                    // If web-ext is running, it should auto-detect file changes in DIST_DIR
                }
            }
        } else if (job.status === 'failed') {
            if (isRunning && lastModified !== newModified) {
                console.log(chalk.red(`\nBuild failed: ${job.error}`));
                lastModified = newModified; // Mark seen
            }
        }
    } catch (error) {
        // console.error('Error polling:', error.message);
    }
}

async function run() {
    console.log(chalk.bold.cyan('AI Extension Preview Tool 🚀'));
    console.log(`Target Job: ${options.job}`);
    console.log(`Working Dir: ${WORK_DIR}\n`);

    await setup();

    // Initial Fetch
    await checkStatus();

    // Start Polling
    checkInterval = setInterval(checkStatus, 2000);

    // Start web-ext
    console.log(chalk.gray('Launching browser...'));

    try {
        await webExt.cmd.run({
            sourceDir: DIST_DIR,
            target: 'chromium',
            // firefox: 'firefox', // Optional: support firefox
            browserConsole: true,
            startUrl: ['https://google.com'], // Open google by default to test
            noInput: true, // Don't block
            keepProfileChanges: false,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'] // maximized for better exp
        }, {
            shouldExitProgram: false
        });
    } catch (err: any) {
        if (err.code === 'ECONNRESET') {
            console.error(chalk.red('Error: Browser connection lost. (ECONNRESET)'));
            console.error(chalk.yellow('Tip: Ensure you have a valid Chromium/Chrome installed.'));
        } else {
            console.error(chalk.red('Web-Ext Error:'), err);
        }
        // Don't exit immediately, allow polling to continue potentially or cleanup
        // process.exit(1);
    }
}

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
    if ((err as any).code === 'ECONNRESET') {
        // Ignore ECONNRESET from web-ext stream
        return;
    }
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    if ((reason as any)?.code === 'ECONNRESET') return;
    console.error('Unhandled Rejection:', reason);
});

// Cleanup
process.on('SIGINT', () => {
    console.log('\nStopping...');
    clearInterval(checkInterval);
    process.exit(0);
});

run();
