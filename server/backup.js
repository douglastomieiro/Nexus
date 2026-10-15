// Backup dos custos (e das configurações) digitados à mão — o único dado que não dá para recoletar da API.
// A cada alteração grava, em ../backup-custos/ (fora de data/, para poder ser sincronizado):
//   custos-atual.json / custos-atual.csv  → sempre o último estado
//   historico/custos-AAAA-MM-DD_HH.json   → um instantâneo por hora com alteração (guarda os últimos 200)
// Se a tabela `custos` estiver vazia ao iniciar e houver backup, restaura sozinho.
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { DATA_DIR } from './ml.js';

export const BACKUP_DIR = path.join(DATA_DIR, 'backup-custos');
const HIST = path.join(BACKUP_DIR, 'historico');
const ATUAL = path.join(BACKUP_DIR, 'custos-atual.json');
const MAX_HIST = 200;

const lerAtual = () => { try { return JSON.parse(fs.readFileSync(ATUAL, 'utf8')); } catch { return null; } };
const grava = (arq, txt) => { const tmp = arq + '.tmp'; fs.writeFileSync(tmp, txt); fs.renameSync(tmp, arq); }; // gravação atômica

export function fazerBackup(motivo = 'alteração') {
  try {
    const custos = db.prepare('SELECT sku, custo, atualizado_em FROM custos ORDER BY sku').all();
    const config = db.prepare('SELECT chave, valor FROM config ORDER BY chave').all();
    const antes = lerAtual();
    // proteção: nunca troca um backup com custos por um vazio (ex.: banco apagado/corrompido) — guarda o anterior como "suspeito"
    if (!custos.length && antes?.custos?.length) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      grava(path.join(BACKUP_DIR, 'custos-anterior-ao-vazio.json'), JSON.stringify(antes, null, 1));
      console.warn('[backup] tabela de custos vazia — backup anterior preservado em custos-anterior-ao-vazio.json');
      return false;
    }
    fs.mkdirSync(HIST, { recursive: true });
    const payload = { salvo_em: new Date().toISOString(), motivo, total: custos.length, custos, config };
    const json = JSON.stringify(payload, null, 1);
    grava(ATUAL, json);
    grava(path.join(BACKUP_DIR, 'custos-atual.csv'), 'sku;custo\n' + custos.map(c => `${c.sku};${String(c.custo).replace('.', ',')}`).join('\n') + '\n');
    const hora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 13).replace('T', '_'); // hora de Brasília
    grava(path.join(HIST, `custos-${hora}.json`), json);
    const arqs = fs.readdirSync(HIST).filter(f => f.endsWith('.json')).sort();
    for (const f of arqs.slice(0, Math.max(arqs.length - MAX_HIST, 0))) fs.unlinkSync(path.join(HIST, f));
    return true;
  } catch (e) { console.error('[backup] falhou:', e.message); return false; }
}

let timer;
export const agendarBackup = motivo => { clearTimeout(timer); timer = setTimeout(() => fazerBackup(motivo), 1500); }; // junta várias edições seguidas

// Restaura custos/config do backup quando a tabela está vazia. `forcar` sobrescreve (uso manual).
export function restaurar({ arquivo = ATUAL, forcar = false } = {}) {
  try {
    const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const n = db.prepare('SELECT COUNT(*) n FROM custos').get().n;
    if (n && !forcar) return { restaurado: 0, motivo: 'tabela já tem custos' };
    const ins = db.prepare('INSERT INTO custos (sku, custo, atualizado_em) VALUES (?,?,?) ON CONFLICT(sku) DO UPDATE SET custo=excluded.custo, atualizado_em=excluded.atualizado_em');
    const cfg = db.prepare('INSERT INTO config (chave, valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor');
    db.transaction(() => { for (const c of b.custos || []) ins.run(c.sku, c.custo, c.atualizado_em); if (forcar || !n) for (const c of b.config || []) cfg.run(c.chave, c.valor); })();
    return { restaurado: (b.custos || []).length, de: b.salvo_em };
  } catch (e) { return { restaurado: 0, motivo: e.code === 'ENOENT' ? 'sem backup' : e.message }; }
}
