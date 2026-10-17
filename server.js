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
                'User-Agent': 'SpeedTestPro/1.0 (+https://github.com/thanoojgithub/speedtest-pro)',
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
            // Primary provider
            const res = await fetchJson('https://ipwho.is/');
            if (res && res.success !== false) {
                data = {
                    isp: res.connection?.isp || res.isp || "Unknown ISP",
                    org: res.connection?.org || res.org || "Unknown Organization",
                    city: res.city || "Unknown City",
                    country: res.country || "Unknown Country",
                    as: res.connection?.asn ? `AS${res.connection.asn}` : (res.as || "Unknown AS"),
                    query: res.ip || "Unknown IP"
                };
            }
        } catch (err1) {
            // Secondary fallback
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

// Simple in-memory per-IP rate limiter for proxy endpoints (sliding window)
const ipCounters = new Map();
function checkRateLimit(ip, limit = 20, windowMs = 60_000) {
    const now = Date.now();
    let entry = ipCounters.get(ip);
    if (!entry) {
        entry = { count: 1, first: now };
        ipCounters.set(ip, entry);
        return true;
    }
    if (now - entry.first > windowMs) {
        entry.count = 1;
        entry.first = now;
        return true;
    }
    entry.count++;
    return entry.count <= limit;
}

function setSecurityHeaders(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Timing-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('X-Frame-Options', 'DENY');
    // Minimal CSP allowing required connections and fonts
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://speed.cloudflare.com; script-src 'self' https://fonts.googleapis.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:;");
    // HSTS only when TLS is detected (best enforced at reverse proxy)
    const proto = (req.headers['x-forwarded-proto'] || (req.connection && req.connection.encrypted ? 'https' : 'http'));
    if (proto === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
}

function streamRandomBytes(res, totalBytes) {
    const chunkSize = 64 * 1024; // 64KB
    let sent = 0;

    // Ensure Content-Length is set so clients can compute progress
    res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(totalBytes),
        'Cache-Control': 'no-store, no-cache, must-revalidate'
    });

    function sendChunk() {
        if (sent >= totalBytes) {
            res.end();
            return;
        }
        const remaining = Math.min(chunkSize, totalBytes - sent);
        const buf = Buffer.allocUnsafe(remaining);
        crypto.randomFill(buf, (err, filled) => {
            if (err) {
                res.end();
                return;
            }
            const ok = res.write(filled);
            sent += remaining;
            if (!ok) {
                res.once('drain', () => setImmediate(sendChunk));
            } else {
                setImmediate(sendChunk);
            }
        });
    }

    sendChunk();
}

const server = http.createServer((req, res) => {
    try {
        setSecurityHeaders(req, res);

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Parse URL safely
        let parsedUrl;
        try {
            parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad Request');
            return;
        }
        const pathname = parsedUrl.pathname;

        if (pathname === '/server-info' && req.method === 'GET') {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            });
            res.end(JSON.stringify({ ...serverMetadata, platform: os.platform(), arch: os.arch() }));
            return;
        }

        if (pathname === '/ping' && req.method === 'GET') {
            res.writeHead(200, {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            });
            res.end('pong');
            return;
        }

        if (pathname === '/download' && req.method === 'GET') {
            // Accept query param: bytes (number of bytes) or mb (MB)
            const bytesParam = parsedUrl.searchParams.get('bytes');
            const mbParam = parsedUrl.searchParams.get('mb');
            let sizeBytes = 25 * 1024 * 1024; // default 25MB
            if (bytesParam && !Number.isNaN(parseInt(bytesParam, 10))) {
                sizeBytes = parseInt(bytesParam, 10);
            } else if (mbParam && !Number.isNaN(parseFloat(mbParam))) {
                sizeBytes = Math.max(0, Math.floor(parseFloat(mbParam) * 1024 * 1024));
            }
            // Clamp
            const MIN = 1 * 1024 * 1024;
            const MAX = 100 * 1024 * 1024;
            sizeBytes = Math.max(MIN, Math.min(MAX, sizeBytes));

            streamRandomBytes(res, sizeBytes);
            return;
        }

        if (pathname === '/proxy-download' && req.method === 'GET') {
            const ip = req.socket.remoteAddress || 'unknown';
            if (!checkRateLimit(ip, 20, 60_000)) {
                res.writeHead(429, { 'Content-Type': 'text/plain' });
                res.end('Too Many Requests');
                return;
            }

            const bytesParam = parsedUrl.searchParams.get('bytes');
            let sizeBytes = 25 * 1024 * 1024; // default 25MB
            if (bytesParam && !Number.isNaN(parseInt(bytesParam, 10))) {
                sizeBytes = parseInt(bytesParam, 10);
            }
            sizeBytes = Math.max(10 * 1024 * 1024, Math.min(100 * 1024 * 1024, sizeBytes));

            const targetUrl = `https://speed.cloudflare.com/__down?bytes=${sizeBytes}`;

            const proxyReq = https.get(targetUrl, (proxyRes) => {
                const status = proxyRes.statusCode || 200;
                const headers = {
                    'Content-Type': 'application/octet-stream',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                    'Access-Control-Allow-Origin': '*',
                    'Timing-Allow-Origin': '*'
                };
                res.writeHead(status, headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                // Fallback to locally generated stream
                streamRandomBytes(res, sizeBytes);
            });
            return;
        }

        if (pathname === '/proxy-upload' && req.method === 'POST') {
            const ip = req.socket.remoteAddress || 'unknown';
            if (!checkRateLimit(ip, 30, 60_000)) {
                res.writeHead(429, { 'Content-Type': 'text/plain' });
                res.end('Too Many Requests');
                return;
            }

            // Stream request body to external endpoint but guard total size
            const MAX = 200 * 1024 * 1024; // 200MB
            let received = 0;
            const proxyReq = https.request('https://speed.cloudflare.com/__up', {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' }
            }, (proxyRes) => {
                proxyRes.on('data', () => {});
                proxyRes.on('end', () => {
                    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
                    res.end('OK');
                });
            });

            proxyReq.on('error', () => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('OK (Local)');
            });

            req.on('data', chunk => {
                received += chunk.length;
                if (received > MAX) {
                    res.writeHead(413, { 'Content-Type': 'text/plain' });
                    res.end('Payload too large');
                    req.destroy();
                    proxyReq.destroy();
                } else {
                    proxyReq.write(chunk);
                }
            });
            req.on('end', () => {
                try { proxyReq.end(); } catch (_) {}
            });
            req.on('error', () => {
                try { proxyReq.destroy(); } catch (_) {}
            });
            return;
        }

        if (pathname === '/upload' && req.method === 'POST') {
            const MAX_UPLOAD = 200 * 1024 * 1024; // 200MB
            let receivedBytes = 0;
            req.on('data', chunk => {
                receivedBytes += chunk.length;
                if (receivedBytes > MAX_UPLOAD) {
                    res.writeHead(413, { 'Content-Type': 'text/plain' });
                    res.end('Payload too large');
                    req.destroy();
                }
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
            return;
        }

        if (req.method === 'GET') {
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
            return;
        }

        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('405 Method Not Allowed');
    } catch (err) {
        console.error('Unhandled request error', err);
        try {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        } catch (_) {}
    }
});

// Graceful shutdown
function shutdown(signal) {
    console.log(`Received ${signal}. Shutting down...`);
    try { clearInterval(metadataInterval); } catch (_) {}
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
    // Force exit if not closed
    setTimeout(() => {
        console.error('Forcing shutdown');
        process.exit(1);
    }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Only listen if run directly (allows tests to import the module without starting duplicate servers)
if (require.main === module) {
    server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
}

module.exports = { server, updateServerMetadata, metadataInterval };
