const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const { server, updateServerMetadata, metadataInterval } = require('../server');

// Health and readiness checks
test('health: /healthz returns status and metrics', async () => {
  // Warm metadata
  try { await updateServerMetadata(); } catch (_) {}

  const port = await new Promise((resolve, reject) => {
    const s = server.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      if (!addr || typeof addr === 'string') return reject(new Error('Failed to get address'));
      resolve(addr.port);
    });
  });

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

  const health = await get('/healthz');
  assert.strictEqual(health.status, 200);
  const healthJson = JSON.parse(health.body);
  assert.ok(healthJson.status === 'ok');
  assert.ok(typeof healthJson.uptimeSeconds === 'number' || typeof healthJson.uptimeSeconds === 'string');

  // readiness: may be warming; allow a short retry window
  let readyResp = null;
  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      readyResp = await get('/ready');
      if (readyResp.status === 200) break;
    } catch (e) {
      // ignore and retry
    }
    await new Promise(r => setTimeout(r, 300));
  }

  assert.ok(readyResp, 'No /ready response');
  const readyJson = JSON.parse(readyResp.body);
  assert.ok(readyJson.status === 'ready' || readyJson.status === 'warming');

  await new Promise((resolve) => server.close(() => resolve()));
  try { clearInterval(metadataInterval); } catch (_) {}
});
