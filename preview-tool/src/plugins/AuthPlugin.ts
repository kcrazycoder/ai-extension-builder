import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import { PreviewConfig } from '../types.js';
import axios from 'axios';
import chalk from 'chalk';
import path from 'path';
import os from 'os';

const AuthPlugin: PluginDefinition<PreviewConfig> = {
    name: 'auth',
    version: '1.0.0',
    dependencies: ['config', 'server'],
    setup(ctx: RuntimeContext<PreviewConfig>) {
        ctx.actions.registerAction({
            id: 'auth:login',
            handler: async () => {
                const hostContext = ctx.config;

                // If we already have JobID and UserID, we might skip, but let's assume we need to verify or start fresh if missing
                if (hostContext.jobId && hostContext.user) {
                    await ctx.logger.info('Auth: Job ID and User ID present. Skipping login.');
                    return { jobId: hostContext.jobId, user: hostContext.user, token: hostContext.token };
                }

                // We need the port from ServerPlugin
                // We need the port from ServerPlugin
                const allocatedPort = ctx.config.hotReloadPort;
                if (!allocatedPort) {
                    throw new Error('Server port not found. Ensure ServerPlugin is loaded before AuthPlugin logic runs.');
                }

                const host = hostContext.host;
                await ctx.logger.info(`Auth: Initiating login flow on ${host} with port ${allocatedPort}`);

                try {
                    // 1. Init Session with port
                    const initRes = await axios({
                        method: 'post',
                        url: `${host}/preview/init`,
                        data: { port: allocatedPort },
                        headers: { 'Content-Type': 'application/json' }
                    });

                    const { code, sessionId } = initRes.data;

                    console.log('\n' + chalk.bgBlue.bold(' DETACHED PREVIEW MODE ') + '\n');
                    console.log('To connect, please go to your Extension Dashboard and click "Connect Preview".');
                    console.log('Enter the following code:');
                    console.log('\n' + chalk.green.bold(`  ${code}  `) + '\n');
                    console.log('Waiting for connection...');

                    // 2. Poll for Status
                    let attempts = 0;
                    while (true) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        attempts++;

                        // Check if we should abort (e.g. from a cancel signal? unimplemented for now)

                        try {
                            const statusRes = await axios.get(`${host}/preview/status/${sessionId}`);
                            const data = statusRes.data;

                            if (data.status === 'linked') {
                                console.log(chalk.green('✔ Connected!'));
                                if (!data.jobId) {
                                    throw new Error('No Job ID associated with this connection.');
                                }

                                const authData = {
                                    jobId: data.jobId,
                                    user: data.userId,
                                    token: data.token || ''
                                };
                                // UPGRADE CONFIG
                                await ctx.actions.runAction('config:set', {
                                    jobId: authData.jobId,
                                    user: authData.user,
                                    token: authData.token,
                                    workDir: path.join(os.homedir(), '.ai-extension-preview', authData.jobId)
                                });

                                return authData;
                            }
                            if (data.status === 'expired') {
                                throw new Error('Code expired. Please restart.');
                            }
                        } catch (err: any) {
                            if (err.message && (err.message.includes('expired') || err.message.includes('No Job ID'))) {
                                throw err;
                            }
                            // Ignore poll errors
                        }
                    }

                } catch (error: any) {
                    await ctx.logger.error(`Authentication failed: ${error.message}`);
                    throw error;
                }
            }
        });
    }
};

export default AuthPlugin;
