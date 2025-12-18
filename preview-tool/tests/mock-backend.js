"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var http_1 = __importDefault(require("http"));
var adm_zip_1 = __importDefault(require("adm-zip"));
var PORT = 3001;
var server = http_1.default.createServer(function (req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, Authorization');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    var url = new URL(req.url || '', "http://localhost:".concat(PORT));
    var path = url.pathname;
    console.log("".concat(req.method, " ").concat(path));
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
        var zip = new adm_zip_1.default();
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
        var buffer = zip.toBuffer();
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
server.listen(PORT, function () {
    console.log("Mock Backend running on http://localhost:".concat(PORT));
});
