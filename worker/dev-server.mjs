// Local test proxy: runs worker.js under Node. Usage: XAI_API_KEY=... node worker/dev-server.mjs [port]
// Serves ../fire_chattest.html at / so the page origin is http://localhost:PORT, and POST /chat through the Worker code.
// The key is read from the environment and never printed.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import worker from './worker.js';
if (process.env.MOCK === '1') { (await import('./mock-upstream.mjs')).installMock(); console.log('MOCK upstream (no real xAI calls)'); }
const port = +(process.argv[2] || 8787), dir = path.dirname(fileURLToPath(import.meta.url));
const env = { XAI_API_KEY: process.env.XAI_API_KEY, ALLOWED_ORIGIN: `http://localhost:${port}`, MODEL: process.env.MODEL || 'grok-4.20-0309-non-reasoning' };
if (!env.XAI_API_KEY) { console.error('XAI_API_KEY is not set'); process.exit(1); }
http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?') || req.url.startsWith('/#'))) {
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(dir, '..', 'fire_chattest.html')));
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers,
    body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  console.log(req.method, req.url, r.status); // no bodies logged
}).listen(port, () => console.log('dev proxy on http://localhost:' + port));
