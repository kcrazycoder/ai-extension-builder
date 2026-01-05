import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import http from 'http';
import { PreviewContext, PreviewConfig } from '../types.js';

export const ServerPlugin: PluginDefinition<PreviewConfig> = {
    name: 'server',
    version: '1.0.0',
    dependencies: ['config'],
    async setup(ctx: RuntimeContext<PreviewConfig>) {
        // const context = ctx as PreviewContext; // No longer needed
        let currentVersion = '0.0.0';

        // Try to bind to a port, retrying with incremented ports on failure
        const startPort = 3500;
        const maxAttempts = 100;
        let allocatedPort: number | null = null;
        let server: http.Server | null = null;

        // Listen for version updates
        ctx.events.on('downloader:updated', (data: any) => {
            if (data && data.version) {
                currentVersion = data.version;
                ctx.actions.runAction('core:log', { level: 'info', message: `Server: Reporting version ${currentVersion}` });
            }
        });

        // Create server with request handler
        const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
            // CORS Headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Access-Control-Allow-Private-Network', 'true');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }


            if (req.url === '/status') {
                const currentJobId = ctx.config.jobId;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    version: currentVersion,
                    jobId: currentJobId,
                    port: allocatedPort
                }));
            } else if (req.url === '/refresh' && req.method === 'POST') {
                // Collect body
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    let newJobId = null;
                    try {
                        if (body) {
                            const data = JSON.parse(body);
                            if (data.jobId) {
                                newJobId = data.jobId;
                                ctx.getRuntime().updateConfig({ jobId: newJobId });
                                ctx.actions.runAction('core:log', { level: 'info', message: `[API] Switched to new Job ID: ${newJobId}` });
                            }
                        }
                    } catch (e) {
                        // Ignore parse error
                    }

                    // Trigger manual check
                    ctx.actions.runAction('core:log', { level: 'info', message: '[API] Refresh request received' });
                    ctx.actions.runAction('downloader:check', null).then((result) => {
                        ctx.actions.runAction('core:log', { level: 'info', message: `[API] Check result: ${result}` });
                    }).catch((err) => {
                        ctx.actions.runAction('core:log', { level: 'error', message: `[API] Check failed: ${err.message}` });
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, jobId: ctx.config.jobId }));
                });
                return; // Return because we handle response in 'end' callback
            } else if (req.url === '/disconnect' && req.method === 'POST') {
                // Trigger browser stop
                ctx.actions.runAction('core:log', { level: 'info', message: '[API] Disconnect request received' });
                ctx.actions.runAction('browser:stop', null).then((result) => {
                    ctx.actions.runAction('core:log', { level: 'info', message: `[API] Browser stop result: ${result}` });
                }).catch((err) => {
                    ctx.actions.runAction('core:log', { level: 'error', message: `[API] Browser stop failed: ${err.message}` });
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        };

        // Try to bind to ports sequentially
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const port = startPort + attempt;

            try {
                server = http.createServer(requestHandler);

                // Wrap listen in a promise to handle async properly
                await new Promise<void>((resolve, reject) => {
                    server!.once('error', (err: any) => {
                        if (err.code === 'EADDRINUSE') {
                            reject(err);
                        } else {
                            reject(err);
                        }
                    });

                    server!.once('listening', () => {
                        resolve();
                    });

                    server!.listen(port);
                });

                // Success! Port is allocated
                allocatedPort = port;
                await ctx.actions.runAction('core:log', { level: 'info', message: `Hot Reload Server running on port ${allocatedPort}` });
                break;

            } catch (err: any) {
                if (err.code === 'EADDRINUSE') {
                    // Port busy, try next one
                    if (server) {
                        server.removeAllListeners();
                        server = null;
                    }
                    continue;
                } else {
                    // Other error, fail immediately
                    await ctx.actions.runAction('core:log', { level: 'error', message: `Server error: ${err.message}` });
                    return;
                }
            }
        }

        if (!allocatedPort || !server) {
            await ctx.actions.runAction('core:log', { level: 'error', message: `Failed to allocate port after ${maxAttempts} attempts (ports ${startPort}-${startPort + maxAttempts - 1})` });
            return;
        }

        // Store port in context for DownloaderPlugin to use
        ctx.getRuntime().updateConfig({ hotReloadPort: allocatedPort });

        // Store server instance to close later
        (ctx as any)._serverInstance = server;
    },
    dispose(ctx) {
        const server = (ctx as any)._serverInstance;
        if (server) {
            server.close();
        }
    }
};
