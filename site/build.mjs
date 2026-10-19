// Gera o site estático (site/dist) para o GitHub Pages: a interface (web/), o Worker que roda o código de server/ no navegador e o SQLite em WebAssembly.
//   node site/build.mjs                  → usa o endereço do intermediário de app-config.json (ou NEXUS_BROKER)
//   NEXUS_BROKER=https://... node site/build.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'site/src'), DIST = path.join(RAIZ, 'site/dist');
const lerJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const BROKER = (process.env.NEXUS_BROKER || lerJson(path.join(RAIZ, 'app-config.json')).broker || '').replace(/\/+$/, '');
if (!BROKER) console.warn('⚠ Sem endereço do intermediário (NEXUS_BROKER ou app-config.json): o site abre, mas não consegue conectar contas.');
const VERSAO = lerJson(path.join(RAIZ, 'package.json')).version;

// Troca, no Worker, os módulos que só existem no Node (ou que mudam no navegador) pelas versões de site/src.
const trocas = new Map([
  ['server/ml.js', 'overrides/ml.js'], ['server/contas.js', 'overrides/contas.js'], ['server/contas-rotas.js', 'overrides/contas-rotas.js'],
  ['server/backup.js', 'overrides/backup.js'], ['server/descontos/ml.js', 'overrides/descontos-ml.js'],
  ['server/shopee.js', 'overrides/shopee.js'], ['server/shopee-coleta.js', 'overrides/shopee.js'], ['server/shopee-rotas.js', 'overrides/shopee.js'], ['server/shopee-margem.js', 'overrides/shopee.js'],
].map(([a, b]) => [path.join(RAIZ, a), path.join(SRC, b)]));
const shims = { express: 'express.js', 'better-sqlite3': 'sqlite.js', 'node-cron': 'cron.js', 'node:fs': 'fs.js', 'node:path': 'path.js', 'node:crypto': 'crypto.js', 'node:module': 'module.js' };

const plugin = {
  name: 'nexus-web',
  setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (shims[args.path]) return { path: path.join(SRC, 'shims', shims[args.path]) };
      if (args.path.startsWith('.') && args.resolveDir) {
        const alvo = path.resolve(args.resolveDir, args.path), troca = trocas.get(alvo);
        if (troca) return { path: troca };
      }
    });
  },
};

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'vendor'), { recursive: true });

const comum = { bundle: true, format: 'esm', target: 'es2022', logLevel: 'info', legalComments: 'none', minify: !process.env.NEXUS_SEM_MINIFICAR };
await build({
  ...comum, entryPoints: [path.join(SRC, 'worker-entry.js')], outfile: path.join(DIST, 'worker.js'), plugins: [plugin],
  define: { __BROKER__: JSON.stringify(BROKER) },
});
await build({ ...comum, format: 'iife', entryPoints: [path.join(SRC, 'client/boot.js')], outfile: path.join(DIST, 'boot.js'), define: { __VERSAO__: JSON.stringify(VERSAO) } });

// SQLite em WebAssembly + Chart.js
fs.copyFileSync(path.join(RAIZ, 'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm'), path.join(DIST, 'sqlite3.wasm'));
fs.copyFileSync(path.join(RAIZ, 'node_modules/chart.js/dist/chart.umd.js'), path.join(DIST, 'vendor/chart.umd.js'));

// Interface: a mesma de web/. O index.html ganha o boot (antes de qualquer script) e a marca de "versão web".
for (const f of fs.readdirSync(path.join(RAIZ, 'web'))) {
  if (f === 'index.html') continue;
  fs.copyFileSync(path.join(RAIZ, 'web', f), path.join(DIST, f));
}
let html = fs.readFileSync(path.join(RAIZ, 'web/index.html'), 'utf8');
if (!html.includes('<script src="vendor/chart.umd.js"></script>')) throw new Error('index.html mudou: não achei o <script> do Chart.js para injetar o boot antes dele.');
html = html.replace('<script src="vendor/chart.umd.js"></script>', '<script src="boot.js"></script>\n<script src="vendor/chart.umd.js"></script>');
// Política de conteúdo: só código do próprio site, só conversa com o próprio site e o intermediário (nada de scripts/estilos de terceiros).
// 'unsafe-inline' é necessário porque as telas têm script e estilo dentro do index.html; 'wasm-unsafe-eval' é do SQLite em WebAssembly.
const origemBroker = BROKER ? new URL(BROKER).origin : '';
const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:",
  `connect-src 'self' ${origemBroker}`.trim(), "worker-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'"].join('; ');
if (!html.includes('<head>')) throw new Error('index.html mudou: não achei <head> para injetar a política de conteúdo.');
html = html.replace('<head>', `<head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">`);
fs.writeFileSync(path.join(DIST, 'index.html'), html);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`Site gerado em site/dist (versão ${VERSAO}, intermediário: ${BROKER || 'não configurado'})`);
