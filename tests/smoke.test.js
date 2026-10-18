const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const { server, updateServerMetadata, metadataInterval } = require('../server');

// Start server on ephemeral port and run basic smoke checks
test('smoke: server responds to /ping and /server-info', async (t) => {
  // Ensure metadata is initialized (allow the async metadata fetch to run)
  await updateServerMetadata();

  let listenPromise;
  const port = await new Promise((resolve, reject) => {
    const s = server.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      if (!addr || typeof addr === 'string') return reject(new Error('Failed to get address'));
      resolve(addr.port);
    });
  });

  // Helper to make HTTP GET
  function get(path) {
    return new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port, path, timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
    });
  }

  // ping
  const ping = await get('/ping');
  assert.strictEqual(ping.status, 200);
  assert.strictEqual(ping.body, 'pong');

  // server-info
  const info = await get('/server-info');
  assert.strictEqual(info.status, 200);
  const parsed = JSON.parse(info.body);
  assert.ok(parsed.nodeName);
  assert.ok(parsed.ip);

  await new Promise((resolve) => {
    server.close(() => resolve());
  });

  // clear interval if present
  try { clearInterval(metadataInterval); } catch (_) {}
});
