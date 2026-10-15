import fs from 'node:fs';
const mod = p => { const s = p.split('/').filter(Boolean); return s[0] === 'advertising' ? 'advertising' : s[0] === 'post-purchase' ? 'post-purchase' : s[0]; };
import { LOJAS } from '../server/ml.js';
const arq = l => `data/probe/${l}/results.json`;
const R = Object.fromEntries(Object.keys(LOJAS).filter(l => fs.existsSync(arq(l))).map(l => [l, JSON.parse(fs.readFileSync(arq(l)))])), ref = Object.keys(R)[0]; // 1ª conta = referência
const g = {};
for (const [l, rows] of Object.entries(R)) for (const r of rows) {
  const m = mod(r.path); g[m] ??= { total: 0, ok: 0, auth: 0, nf: 0, skip: 0, outro: 0, okPaths: new Set() };
  const x = g[m]; if (l === ref) x.total++;
  if (r.status === 200 || r.status === 204) { x.okPaths.add(r.path); if (l === ref) x.ok++; }
  else if (l === ref) { if (r.status === 401 || r.status === 403) x.auth++; else if (r.status === 404) x.nf++; else if (r.status === 'SKIP') x.skip++; else x.outro++; }
}
let md = '# Cobertura da API (GET) — teste real nas contas conectadas\n\n| Módulo | GETs doc | 200 OK (1ª conta) | OK em qualquer loja | 401/403 | 404 | sem ID p/ testar | outros |\n|---|---|---|---|---|---|---|---|\n';
for (const [m, x] of Object.entries(g).sort((a, b) => b[1].total - a[1].total)) md += `| ${m} | ${x.total} | ${x.ok} | ${x.okPaths.size} | ${x.auth} | ${x.nf} | ${x.skip} | ${x.outro} |\n`;
const okAll = new Set(); Object.values(R).forEach(rows => rows.filter(r => r.status === 200).forEach(r => okAll.add(r.path)));
md += `\n**Endpoints GET que responderam 200 (união das contas): ${okAll.size}**\n\n## Lista\n` + [...okAll].sort().map(p => '- ' + p).join('\n');
fs.writeFileSync('data/COBERTURA.md', md); console.log(md.split('\n## Lista')[0]);
