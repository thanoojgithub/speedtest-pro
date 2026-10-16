const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Test that core files exist and are valid
test('Core application files exist and are non-empty', () => {
    const requiredFiles = [
        'server.js',
        'public/index.html',
        'public/script.js',
        'public/style.css',
        'public/favicon.svg',
        'README.md'
    ];

    for (const relPath of requiredFiles) {
        const fullPath = path.resolve(__dirname, '..', relPath);
        assert.ok(fs.existsSync(fullPath), `Missing file: ${relPath}`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 0, `File is empty: ${relPath}`);
    }
});

// Test that HTML contains necessary element IDs and links
test('index.html contains expected elements and assets', () => {
    const htmlPath = path.resolve(__dirname, '..', 'public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('id="start-btn"'), 'Missing start-btn in index.html');
    assert.ok(html.includes('id="main-dl"'), 'Missing main-dl in index.html');
    assert.ok(html.includes('id="main-ul"'), 'Missing main-ul in index.html');
    assert.ok(html.includes('id="technical-section"'), 'Missing technical-section in index.html');
    assert.ok(html.includes('id="server-details"'), 'Missing server-details in index.html');
    assert.ok(html.includes('favicon.svg'), 'Missing favicon.svg reference in index.html');
});

// Test that script.js contains zero-data-retention cleanup and standard sliding-window methods
test('script.js implements enterprise sliding-window and cleanup routines', () => {
    const scriptPath = path.resolve(__dirname, '..', 'public', 'script.js');
    const script = fs.readFileSync(scriptPath, 'utf8');

    assert.ok(script.includes('cleanupBrowserResources'), 'Missing cleanupBrowserResources function');
    assert.ok(script.includes('clearResourceTimings'), 'Missing clearResourceTimings call');
    assert.ok(script.includes('caches.delete'), 'Missing caches.delete call');
    assert.ok(script.includes('sessionStorage.clear'), 'Missing sessionStorage.clear call');
    assert.ok(script.includes('localStorage.clear'), 'Missing localStorage.clear call');
    assert.ok(script.includes('runParallelDownload'), 'Missing runParallelDownload function');
    assert.ok(script.includes('runParallelUpload'), 'Missing runParallelUpload function');
});

// Test that server.js exports valid endpoints and Timing-Allow-Origin headers
test('server.js defines timing-allow-origin and security headers', () => {
    const serverPath = path.resolve(__dirname, '..', 'server.js');
    const serverCode = fs.readFileSync(serverPath, 'utf8');

    assert.ok(serverCode.includes('Timing-Allow-Origin'), 'Missing Timing-Allow-Origin header');
    assert.ok(serverCode.includes('Cache-Control'), 'Missing Cache-Control header');
    assert.ok(serverCode.includes('/server-info'), 'Missing /server-info endpoint');
    assert.ok(serverCode.includes('/ping'), 'Missing /ping endpoint');
    assert.ok(serverCode.includes('/proxy-download'), 'Missing /proxy-download endpoint');
    assert.ok(serverCode.includes('/proxy-upload'), 'Missing /proxy-upload endpoint');
});
