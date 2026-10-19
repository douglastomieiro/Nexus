// Serve site/dist para testar o site no seu computador: `npm run site && npm run site:servir` → http://127.0.0.1:4173/
// (O login real só funciona no endereço publicado: o intermediário só devolve o ML para o endereço configurado em WEB_URL.)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.css': 'text/css', '.svg': 'image/svg+xml' };
const PORTA = Number(process.env.PORT) || 4173;

http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const arq = path.resolve(DIST, rel);
  if (!arq.startsWith(DIST + path.sep) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(arq).pipe(res);
}).listen(PORTA, '127.0.0.1', () => console.log(`Site em http://127.0.0.1:${PORTA}/`));
