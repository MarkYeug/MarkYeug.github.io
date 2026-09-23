import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshChapters, CATALOG } from './update-chapters.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8000);

async function sendJSON(res, payload, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const fsPath = path.join(root, safePath.replace(/^\/+/, ''));
  const resolved = path.resolve(fsPath);
  if (!resolved.startsWith(root)) {
    res.writeHead(403); res.end('Forbidden');
    return;
  }
  try {
    const stats = await stat(resolved);
    if (stats.isDirectory()) {
      const indexFile = path.join(resolved, 'index.html');
      const indexStats = await stat(indexFile).catch(() => null);
      if (!indexStats) {
        res.writeHead(404); res.end('Not found');
        return;
      }
      createReadStream(indexFile).pipe(res);
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const type = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain; charset=utf-8'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    createReadStream(resolved).pipe(res);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/chapters') {
    try {
      const result = await refreshChapters({ outputPath: null, mode: 'http', force: false, writeFile: false });
      await sendJSON(res, { source: result.source || CATALOG, updated: result.updated, volumes: result.volumes });
    } catch (error) {
      res.writeHead(503, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Access-Control-Allow-Origin': '*'
      });
      res.end('failed to load chapters');
    }
    return;
  }

  if (url.pathname === '/api/health') {
    await sendJSON(res, { ok: true, port, source: CATALOG, time: new Date().toISOString() });
    return;
  }

  await serveStatic(req, res, url.pathname);
});

server.listen(port, () => {
  console.log(`Live chapter server running at http://localhost:${port}`);
});
