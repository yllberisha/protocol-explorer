import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { references } from './capture-reference.mjs';
import { createStaticServer } from './serve.mjs';

const root = resolve(process.argv[2] ?? 'public');
const manifest = JSON.parse(await readFile('verification/reference-manifest.json', 'utf8'));
const overrides = JSON.parse(await readFile('verification/local-overrides.json', 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '{}';
  throw error;
}));
const known = new Set(manifest.files.map(file => file.path));
let modules = 0;
let fonts = 0;
for (const file of manifest.files) {
  const path = resolve(root, `.${file.path}`);
  const bytes = await readFile(path);
  const expected = overrides[file.path] ?? file;
  assert.equal(bytes.length, expected.bytes, `${file.path}: size differs from verified version`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `${file.path}: differs from verified version`);
  if (/\.(html|css|js)$/.test(path)) {
    for (const dependency of references(bytes.toString('utf8'), file.path)) {
      assert.ok(known.has(dependency), `${file.path}: missing dependency ${dependency}`);
    }
  }
  if (path.endsWith('.js')) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
    modules++;
  }
  if (path.endsWith('.woff2')) fonts++;
}
assert.ok(modules >= 21, 'Missing translated lesson modules');
assert.ok(fonts >= 24, 'Missing font weights or language subsets');
console.log(`PASS: ${manifest.files.length} files verified against the reference and ${Object.keys(overrides).length} documented local customization(s).`);
console.log(`PASS: dependency graph complete; ${modules} JavaScript modules parse; ${fonts} fonts present.`);

const server = createStaticServer(root);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const file of manifest.files) {
    const response = await fetch(`${base}${file.path}`);
    assert.equal(response.status, 200, `${file.path}: HTTP error`);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), (overrides[file.path] ?? file).sha256, `${file.path}: HTTP body differs`);
    if (file.path.endsWith('.js')) assert.match(response.headers.get('content-type'), /javascript/);
    if (file.path.endsWith('.css')) assert.match(response.headers.get('content-type'), /text\/css/);
    if (file.path.endsWith('.woff2')) assert.equal(response.headers.get('content-type'), 'font/woff2');
  }
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.equal((await fetch(base, { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(base, { headers: { 'If-None-Match': home.headers.get('etag') } })).status, 304);
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/.git/config`)).status, 403);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  console.log('PASS: all assets served intact with correct MIME types; HTTP behavior and hidden-file protection verified.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
