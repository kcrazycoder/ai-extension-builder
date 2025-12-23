import { PluginDefinition, RuntimeContext } from 'skeleton-crew-runtime';
import http from 'http';

export const ServerPlugin: PluginDefinition = {
    name: 'server',
    version: '1.0.0',
    setup(ctx: RuntimeContext) {
        let currentVersion = '0.0.0';
        const PORT = 3500;

        // Listen for version updates
        ctx.events.on('downloader:updated', (data: any) => {
            if (data && data.version) {
                currentVersion = data.version;
                ctx.actions.runAction('core:log', { level: 'info', message: `Server: Reporting version ${currentVersion}` });
            }
        });

        const server = http.createServer((req, res) => {
            // CORS Headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            if (req.url === '/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ version: currentVersion }));
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        server.listen(PORT, () => {
            ctx.actions.runAction('core:log', { level: 'info', message: `Hot Reload Server running on port ${PORT}` });
        });

        server.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                ctx.actions.runAction('core:log', { level: 'error', message: `Port ${PORT} is busy. Hot reload may fail.` });
            } else {
                ctx.actions.runAction('core:log', { level: 'error', message: `Server error: ${err.message}` });
            }
        });

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
