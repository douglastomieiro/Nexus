// Backup dos custos (e das configurações) digitados à mão — o único dado que não dá para recoletar da API. Versão do site web.
// A cada alteração guarda uma cópia no IndexedDB (separada do banco SQLite: se ele for apagado ou corromper, os custos voltam sozinhos).
// Para o usuário: exportar/importar um arquivo .json (rotas /api/backup/*), a proteção contra limpar os dados do navegador.
import { db } from '../../../server/db.js';
import { kvGet, kvSet } from './idb.js';

export const BACKUP_DIR = '/backup-custos';
const MAX_HIST = 20;

let atual = await kvGet('backup-custos'), hist = (await kvGet('backup-custos-historico')) || [];

export const montar = (motivo = 'alteração') => ({
  salvo_em: new Date().toISOString(), motivo,
  custos: db.prepare('SELECT sku, custo, atualizado_em FROM custos ORDER BY sku').all(),
  custos_hist: (() => { try { return db.prepare('SELECT sku, desde, custo, atualizado_em FROM custos_hist ORDER BY sku, desde').all(); } catch { return []; } })(),
  config: db.prepare('SELECT chave, valor FROM config ORDER BY chave').all(),
});

export function fazerBackup(motivo = 'alteração') {
  try {
    const p = montar(motivo); p.total = p.custos.length;
    // proteção: nunca troca um backup com custos por um vazio (ex.: banco apagado/corrompido)
    if (!p.custos.length && atual?.custos?.length) { console.warn('[backup] tabela de custos vazia — backup anterior preservado'); return false; }
    atual = p;
    const hora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 13); // hora de Brasília
    hist = [...hist.filter(h => h.hora !== hora), { hora, ...p }].slice(-MAX_HIST);
    kvSet('backup-custos', p).catch(() => {}); kvSet('backup-custos-historico', hist).catch(() => {});
    return true;
  } catch (e) { console.error('[backup] falhou:', e.message); return false; }
}

let timer;
export const agendarBackup = motivo => { clearTimeout(timer); timer = setTimeout(() => fazerBackup(motivo), 1500); }; // junta várias edições seguidas

// Restaura custos/config de um backup quando a tabela está vazia. `forcar` sobrescreve (uso manual). `arquivo` = objeto do backup.
export function restaurar({ arquivo = atual, forcar = false } = {}) {
  try {
    const b = arquivo; if (!b) return { restaurado: 0, motivo: 'sem backup' };
    const n = db.prepare('SELECT COUNT(*) n FROM custos').get().n;
    if (n && !forcar) return { restaurado: 0, motivo: 'tabela já tem custos' };
    const ins = db.prepare('INSERT INTO custos (sku, custo, atualizado_em) VALUES (?,?,?) ON CONFLICT(sku) DO UPDATE SET custo=excluded.custo, atualizado_em=excluded.atualizado_em');
    const cfg = db.prepare('INSERT INTO config (chave, valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor');
    db.transaction(() => { for (const c of b.custos || []) ins.run(c.sku, c.custo, c.atualizado_em); if (forcar || !n) for (const c of b.config || []) cfg.run(c.chave, c.valor);
      // histórico de vigência: volta junto (substitui o dos SKUs do backup); backup antigo, sem ele, vira o custo base de cada SKU
      const hist = b.custos_hist?.length ? b.custos_hist : (b.custos || []).map(c => ({ sku: c.sku, desde: '0000-00-00', custo: c.custo, atualizado_em: c.atualizado_em }));
      const delH = db.prepare('DELETE FROM custos_hist WHERE sku=?'), insH = db.prepare('INSERT OR REPLACE INTO custos_hist (sku, desde, custo, atualizado_em) VALUES (?,?,?,?)');
      for (const sku of new Set(hist.map(h => h.sku))) delH.run(sku);
      for (const h of hist) insH.run(h.sku, h.desde, h.custo, h.atualizado_em ?? null); })();
    return { restaurado: (b.custos || []).length, de: b.salvo_em };
  } catch (e) { return { restaurado: 0, motivo: e.message }; }
}
