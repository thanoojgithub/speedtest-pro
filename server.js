const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = 3000;
const DOWNLOAD_SIZE_MB = 50;
const DOWNLOAD_BUFFER = crypto.randomBytes(DOWNLOAD_SIZE_MB * 1024 * 1024);

let serverMetadata = {
    isp: "Detecting...", org: "Detecting...", city: "Detecting...",
    country: "Detecting...", as: "Detecting...", ip: "Detecting...",
    nodeName: "Initializing Node..."
};

async function updateServerMetadata() {
    try {
        const data = await new Promise((resolve, reject) => {
            https.get('https://ip-api.com/json/', (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(JSON.parse(body)));
            }).on('error', reject);
        });
        serverMetadata = {
            isp: data.isp || "Unknown", org: data.org || "Unknown",
            city: data.city || "Unknown", country: data.country || "Unknown",
            as: data.as || "Unknown", ip: data.query || "Unknown",
            nodeName: `Edge Node - ${data.city || 'Unknown'}, ${data.country || 'Unknown'}`
        };
        console.log(`🌍 Server Identity Confirmed: ${serverMetadata.nodeName}`);
    } catch (e) {
        console.error("❌ ISP lookup failed. Check internet connection.");
        serverMetadata.nodeName = "Generic Edge Node (Offline)";
    }
}
updateServerMetadata();
setInterval(updateServerMetadata, 3600000);

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.url.startsWith('/server-info')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...serverMetadata, platform: os.platform(), arch: os.arch() }));
    }
    else if (req.url.startsWith('/ping')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
    }
    else if (req.url.startsWith('/download')) {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': DOWNLOAD_BUFFER.length, 'Cache-Control': 'no-cache' });
        res.end(DOWNLOAD_BUFFER);
    }
    else if (req.url.startsWith('/upload') && req.method === 'POST') {
        let receivedBytes = 0;
        req.on('data', chunk => receivedBytes += chunk.length);
        req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`OK: ${receivedBytes}`);
        });
    }
    else {
        let urlPath = req.url === '/' ? 'index.html' : req.url;
        const fullPath = path.join(__dirname, 'public', urlPath);
        fs.readFile(fullPath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                const ext = path.extname(fullPath);
                const contentType = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'text/plain';
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    }
});

server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
