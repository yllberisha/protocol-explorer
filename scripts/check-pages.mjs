import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createStaticServer } from './serve.mjs';

const root = resolve(process.argv[2] ?? 'public');
const manifest = JSON.parse(await readFile('verification/reference-manifest.json', 'utf8'));
const known = new Set(manifest.files.map(file => file.path));

// Serve the actual files at a project prefix. Any accidental request to the
// domain root gets a 404, just as it would on a GitHub Pages project site.
for (const mount of ['/', '/protocol-explorer/', '/classes/networking/']) {
  const files = createStaticServer(root);
  const server = createServer((request, response) => {
    if (!request.url.startsWith(mount)) {
      response.writeHead(404).end();
      return;
    }
    request.url = request.url.slice(mount.length - 1);
    files.emit('request', request, response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}${mount}`;
  const checked = new Set();
  async function checkAsset(reference, parent) {
    const url = new URL(reference, parent);
    if (url.origin !== new URL(base).origin || url.hash) return;
    assert.ok(url.pathname.startsWith(mount), `${reference} escapes project path ${mount}`);
    const local = `/${url.pathname.slice(mount.length)}`;
    assert.ok(known.has(local), `Missing deployed asset ${local}`);
    if (checked.has(url.href)) return;
    checked.add(url.href);
    const response = await fetch(url);
    assert.equal(response.status, 200, `${url}: HTTP error`);
  }
  try {
    assert.equal((await fetch(base)).status, 200);
    for (const file of manifest.files) {
      const parent = new URL(file.path.slice(1), base).href;
      const text = await readFile(resolve(root, `.${file.path}`), 'utf8');
      if (file.path.endsWith('.html')) {
        for (const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
          await checkAsset(match[1], parent);
        }
      } else if (file.path.endsWith('.css')) {
        for (const match of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
          await checkAsset(match[1], parent);
        }
      } else if (file.path.endsWith('.js')) {
        for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+\.js)["']/g)) {
          await checkAsset(match[1], parent);
        }
        // Exercise the production Vite preload URL function itself. Static
        // import checks alone miss the root-relative URLs in its dependency map.
        const dependencies = text.match(/m\.f=\[([^\]]+)\]/);
        if (dependencies) {
          const helper = text.match(/Cf=(function\(e\)\{return[^}]+\})/);
          assert.ok(helper, 'Expected the production preload URL helper');
          const preloadURL = runInNewContext(`(${helper[1].replaceAll('import.meta.url', JSON.stringify(parent))})`, { URL });
          for (const dependency of JSON.parse(`[${dependencies[1]}]`)) {
            await checkAsset(preloadURL(dependency), parent);
          }
        }
      } else if (file.path.endsWith('.webmanifest')) {
        const data = JSON.parse(text);
        assert.equal(new URL(data.start_url, parent).href, base);
        assert.equal(new URL(data.scope, parent).href, base);
        for (const icon of data.icons ?? []) await checkAsset(icon.src, parent);
      }
    }
    assert.equal(checked.size, 54, 'Expected every runtime module, font and icon to be reachable');
    console.log(`PASS: ${checked.size} runtime assets, language preloads and manifest resolve under ${mount}`);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
