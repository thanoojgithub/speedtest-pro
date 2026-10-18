const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testsDir = path.join(__dirname, '..', 'tests');
let files = [];
try {
  files = fs.readdirSync(testsDir)
    .filter(f => f.endsWith('.js'))
    .sort()
    .map(f => path.join(testsDir, f));
} catch (e) {
  console.error('Failed to read tests directory', e);
  process.exit(1);
}

if (files.length === 0) {
  console.error('No test files found in tests/');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
