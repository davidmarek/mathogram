import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve('dist');
let release = 1;
const originalIndex = await readFile(resolve(root, 'index.html'), 'utf8');
const nextIndex = originalIndex.replace(
  '</head>',
  '<meta name="mathogram-release" content="2"></head>',
);
const revision = createHash('md5').update(nextIndex).digest('hex');
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

// Loopback-only acceptance fixture: a real new precache revision, not an app test hook.
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4174');
  if (url.pathname === '/__release' && request.method === 'POST') {
    release = Number(url.searchParams.get('version')) === 2 ? 2 : 1;
    response.writeHead(204).end();
    return;
  }
  if (!url.pathname.startsWith('/mathogram/')) {
    response.writeHead(404).end();
    return;
  }
  const relative =
    decodeURIComponent(url.pathname.slice('/mathogram/'.length)) ||
    'index.html';
  const path = resolve(root, relative);
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    let content = await readFile(path);
    if (release === 2 && relative === 'index.html')
      content = Buffer.from(nextIndex);
    if (release === 2 && relative === 'sw.js') {
      const original = content.toString();
      const updated = original.replace(
        /(\{url:"index\.html",revision:")[^"]+("})/,
        `$1${revision}$2`,
      );
      if (updated === original)
        throw new Error('Index precache revision was not found.');
      content = Buffer.from(updated);
    }
    response.writeHead(200, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
}).listen(4174, '127.0.0.1', () =>
  console.log('PWA update fixture on http://127.0.0.1:4174/mathogram/'),
);
