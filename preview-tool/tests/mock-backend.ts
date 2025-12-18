
import http from 'http';
import AdmZip from 'adm-zip';

const PORT = 3001;

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const path = url.pathname;

    console.log(`${req.method} ${path}`);

    // 1. Auth Init
    if (path === '/api/preview/init' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'TEST', sessionId: 'sess-1' }));
        return;
    }

    // 2. Auth Status
    if (path.match(/\/api\/preview\/status\/.*/) && req.method === 'GET') {
        // Immediately return linked
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'linked',
            jobId: 'test-job',
            userId: 'user-1',
            token: 'mock-token'
        }));
        return;
    }

    // 3. Job Status
    if (path === '/api/jobs/test-job' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            id: 'test-job',
            status: 'completed',
            version: '1.0.0',
            timestamp: Date.now()
        }));
        return;
    }

    // 4. Download
    if (path === '/api/download/test-job' && req.method === 'GET') {
        const zip = new AdmZip();
        zip.addFile('manifest.json', Buffer.from(JSON.stringify({
            manifest_version: 3,
            name: "Test Extension",
            version: "1.0.0",
            description: "Loaded via Preview Tool",
            action: {
                default_popup: "popup.html"
            }
        })));
        zip.addFile('popup.html', Buffer.from('<h1>Hello Verification</h1>'));

        const buffer = zip.toBuffer();
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Length': buffer.length
        });
        res.end(buffer);
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Mock Backend running on http://localhost:${PORT}`);
});
