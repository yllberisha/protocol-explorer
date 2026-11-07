import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

export function createStaticServer(directory) {
  const root = resolve(directory);
  return createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => part.startsWith('.'))) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      let file = resolve(root, `.${path}`);
      if (relative(root, file).startsWith(`..${sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      if (path.endsWith('/')) file = resolve(file, 'index.html');
      const info = await stat(file);
      if (!info.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
      const bytes = await readFile(file);
      const etag = `"${createHash('sha256').update(bytes).digest('hex')}"`;
      const headers = {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', ETag: etag,
      };
      if (request.headers['if-none-match'] === etag) {
        response.writeHead(304, headers).end();
        return;
      }
      response.writeHead(200, { ...headers, 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      const status = error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500;
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(status === 404 ? 'Not found' : 'Unable to serve request');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const directory = process.argv[2] ?? 'public';
  const portFlag = process.argv.indexOf('--port');
  const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT ?? 3000);
  const hostFlag = process.argv.indexOf('--host');
  const host = hostFlag >= 0 ? process.argv[hostFlag + 1] : '127.0.0.1';
  const server = createStaticServer(directory);
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Protocol Explorer\n  Local: http://${host}:${server.address().port}/\n  Serving: ${resolve(directory)}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
