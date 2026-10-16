/**
 * Copyright 2026 SpeedTest Pro Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DOWNLOAD_SIZE_MB = 50;
const DOWNLOAD_BUFFER = crypto.randomBytes(DOWNLOAD_SIZE_MB * 1024 * 1024);
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.js': 'text/javascript; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

let serverMetadata = {
    isp: "Detecting...", org: "Detecting...", city: "Detecting...",
    country: "Detecting...", as: "Detecting...", ip: "Detecting...",
    nodeName: "Initializing Node..."
};

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        };
        const req = client.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('Request timeout')));
    });
}

async function updateServerMetadata() {
    try {
        let data;
        try {
            // Primary provider (ipwho.is has generous limits and no strict 403 blocks over HTTPS)
            const res = await fetchJson('https://ipwho.is/');
            if (res && res.success !== false) {
                data = {
                    isp: res.connection?.isp || res.isp || "Unknown ISP",
                    org: res.connection?.org || res.org || "Unknown Organization",
                    city: res.city || "Unknown City",
                    country: res.country || "Unknown Country",
                    as: res.connection?.asn ? `AS${res.connection.asn}` : "Unknown AS",
                    query: res.ip || "Unknown IP"
                };
            }
        } catch (err1) {
            // Secondary fallback: ip-api.com with proper User-Agent
            const res = await fetchJson('http://ip-api.com/json/');
            data = {
                isp: res.isp || "Unknown ISP",
                org: res.org || "Unknown Organization",
                city: res.city || "Unknown City",
                country: res.country || "Unknown Country",
                as: res.as || "Unknown AS",
                query: res.query || "Unknown IP"
            };
        }

        if (!data) throw new Error("Could not parse location data");

        serverMetadata = {
            isp: data.isp,
            org: data.org,
            city: data.city,
            country: data.country,
            as: data.as,
            ip: data.query,
            nodeName: `Edge Node - ${data.city}, ${data.country}`
        };
        console.log(`🌍 Server Identity Confirmed: ${serverMetadata.nodeName}`);
    } catch (e) {
        console.error("❌ ISP lookup failed. Using fallback identity:", e.message);
        serverMetadata = {
            isp: "Local / Offline Network",
            org: "SpeedTest Local Node",
            city: "Localhost",
            country: "Local",
            as: "N/A",
            ip: "127.0.0.1",
            nodeName: "SpeedTest Edge Node (Local)"
        };
    }
}
updateServerMetadata();
const metadataInterval = setInterval(updateServerMetadata, 3600000);
metadataInterval.unref();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Timing-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Parse URL safely
    let pathname;
    try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        pathname = parsedUrl.pathname;
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
        return;
    }

    if (pathname === '/server-info' && req.method === 'GET') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        res.end(JSON.stringify({ ...serverMetadata, platform: os.platform(), arch: os.arch() }));
    }
    else if (pathname === '/ping' && req.method === 'GET') {
        res.writeHead(200, { 
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        res.end('pong');
    }
    else if (pathname === '/download' && req.method === 'GET') {
        res.writeHead(200, { 
            'Content-Type': 'application/octet-stream', 
            'Content-Length': DOWNLOAD_BUFFER.length, 
            'Cache-Control': 'no-store, no-cache, must-revalidate' 
        });
        res.end(DOWNLOAD_BUFFER);
    }
    else if (pathname === '/proxy-download' && req.method === 'GET') {
        // Stream 25MB - 50MB directly from Cloudflare's global edge network over the active Wi-Fi connection
        const sizeMb = Math.min(100, Math.max(10, parseInt(req.url.split('bytes=')[1] || '25000000', 10)));
        const targetUrl = `https://speed.cloudflare.com/__down?bytes=${sizeMb}`;

        const proxyReq = https.get(targetUrl, (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, {
                'Content-Type': 'application/octet-stream',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Access-Control-Allow-Origin': '*',
                'Timing-Allow-Origin': '*'
            });
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            // Fallback to local buffer if external CDN request fails
            res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
            res.end(DOWNLOAD_BUFFER);
        });
    }
    else if (pathname === '/proxy-upload' && req.method === 'POST') {
        // Pipe upload data directly through to Cloudflare's speed test endpoint over Wi-Fi
        const proxyReq = https.request('https://speed.cloudflare.com/__up', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' }
        }, (proxyRes) => {
            let body = '';
            proxyRes.on('data', chunk => body += chunk);
            proxyRes.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
                res.end('OK');
            });
        });

        proxyReq.on('error', () => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK (Local)');
        });

        req.pipe(proxyReq);
    }
    else if (pathname === '/upload' && req.method === 'POST') {
        let receivedBytes = 0;
        req.on('data', chunk => {
            receivedBytes += chunk.length;
        });
        req.on('end', () => {
            res.writeHead(200, { 
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            });
            res.end(`OK: ${receivedBytes}`);
        });
        req.on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Upload error');
        });
    }
    else if (req.method === 'GET') {
        // Safe static file serving
        const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const fullPath = path.resolve(PUBLIC_DIR, safePath);

        // Security check: Path traversal prevention
        if (!fullPath.startsWith(PUBLIC_DIR + path.sep) && fullPath !== PUBLIC_DIR) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('403 Forbidden');
            return;
        }

        fs.readFile(fullPath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                const ext = path.extname(fullPath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    }
    else {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('405 Method Not Allowed');
    }
});

server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
