import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Capture a fixed, local copy of the public frontend, including lazy imports.
const origin = 'https://protocol-explorer-alpha.vercel.app';
const root = resolve('public');
const pending = new Set(['/', '/og.png']);
const captured = new Map();
const download = promisify(execFile);

export function references(text, pathname) {
  const found = new Set();
  const patterns = [
    /(?:src|href)=["']([^"']+)["']/g,
    /url\(\s*["']?([^\s"')]+)["']?\s*\)/g,
    /["']((?:\.?\.?\/)?assets\/[^"'\s]+)["']/g,
    /(?:from\s*|import\s*\()\s*["']([^"']+\.(?:js|css))["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const reference = match[1].startsWith('assets/') ? `/${match[1]}` : match[1];
      const url = new URL(reference, `${origin}${pathname}`);
      if (url.origin === origin && !url.hash && /\.(?:js|css|woff2?|ttf|svg|png|ico|webmanifest|json|jpe?g|webp)$/i.test(url.pathname)) {
        found.add(url.pathname);
      }
    }
  }
  return [...found];
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await mkdir(root, { recursive: true });
  while (pending.size) {
    const batch = [...pending].slice(0, 6);
    batch.forEach(path => pending.delete(path));
    await Promise.all(batch.map(async pathname => {
      if (captured.has(pathname)) return;
      const target = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
      if (relative(root, target).startsWith(`..${sep}`)) throw new Error('Path escapes public directory');
      await mkdir(dirname(target), { recursive: true });
      await download('curl.exe', ['--location', '--fail', '--silent', '--show-error', '--retry', '2', '--max-time', '60', `${origin}${pathname}`, '--output', target]);
      const bytes = await readFile(target);
      captured.set(pathname, { path: pathname === '/' ? '/index.html' : pathname, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      console.log(`Captured ${pathname} (${bytes.length} bytes)`);
      if (/\.(?:js|css|webmanifest|json)$/.test(pathname) || pathname === '/') {
        const text = bytes.toString('utf8');
        for (const dependency of references(text, pathname)) {
          if (!captured.has(dependency)) pending.add(dependency);
        }
        if (pathname.endsWith('.webmanifest')) {
          for (const icon of JSON.parse(text).icons ?? []) {
            pending.add(new URL(icon.src, `${origin}${pathname}`).pathname);
          }
        }
      }
    }));
  }
  await mkdir('verification', { recursive: true });
  await writeFile('verification/reference-manifest.json', JSON.stringify({ origin, capturedAt: new Date().toISOString(), files: [...captured.values()].sort((a,b) => a.path.localeCompare(b.path)) }, null, 2) + '\n');
  console.log(`Captured ${captured.size} files. Original frontend files are unmodified.`);
}
