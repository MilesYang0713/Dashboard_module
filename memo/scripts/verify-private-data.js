const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const publishedFiles = manifest.files || [];

if (publishedFiles.some((entry) => entry === 'data' || entry.startsWith('data/'))) {
  throw new Error('Privacy guard failed: package.json must never publish data/.');
}

try {
  const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: packageRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const tracked = execFileSync('git', ['ls-files', '--', 'memo/data'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  if (tracked) throw new Error(`Privacy guard failed: private data is tracked by Git:\n${tracked}`);
} catch (error) {
  if (/Privacy guard failed/.test(error.message)) throw error;
  // A downloaded release may not contain Git metadata. Its package whitelist above still applies.
}

console.log('Privacy guard passed: data/ is local-only and excluded from releases.');
