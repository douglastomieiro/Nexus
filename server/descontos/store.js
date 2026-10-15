// Persistência dos descontos cadastrados e das categorias (SQLite do dashboard, tabelas desc_*).
import crypto from 'node:crypto';
import { db } from '../db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS desc_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT, seller TEXT NOT NULL, mlb TEXT NOT NULL, name TEXT, price REAL, color TEXT,
  processing INTEGER NOT NULL DEFAULT 0, last_attempt_failed INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT, last_error_code TEXT, last_raw_error TEXT, last_success_at TEXT, last_attempt_at TEXT, promotion_finish_at TEXT,
  UNIQUE (seller, mlb)
);
CREATE INDEX IF NOT EXISTS desc_itens_falha ON desc_itens (seller, last_attempt_failed);
CREATE TABLE IF NOT EXISTS desc_categorias (
  id TEXT PRIMARY KEY, seller TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (seller, name)
);
CREATE TABLE IF NOT EXISTS desc_categoria_itens (
  categoria_id TEXT NOT NULL REFERENCES desc_categorias(id) ON DELETE CASCADE, mlb TEXT NOT NULL, PRIMARY KEY (categoria_id, mlb)
);
`);
db.pragma('foreign_keys = ON');

const STATUS = { processing: ['processing', true], lastAttemptFailed: ['last_attempt_failed', true], lastErrorMessage: ['last_error_message'], lastErrorCode: ['last_error_code'],
  lastRawError: ['last_raw_error'], lastSuccessAt: ['last_success_at'], lastAttemptAt: ['last_attempt_at'], promotionFinishAt: ['promotion_finish_at'] };

function rowToItem(r) {
  if (!r) return null;
  const it = { mlb: r.mlb, name: r.name, price: r.price };
  if (r.color != null) it.color = r.color;
  if (r.processing === 1) it.processing = true;
  if (r.last_attempt_failed === 1) it.lastAttemptFailed = true;
  for (const [k, c] of [['lastErrorMessage', 'last_error_message'], ['lastErrorCode', 'last_error_code'], ['lastRawError', 'last_raw_error'], ['lastSuccessAt', 'last_success_at'],
    ['lastAttemptAt', 'last_attempt_at'], ['promotionFinishAt', 'promotion_finish_at']]) if (r[c] != null) it[k] = r[c];
  return it;
}

export class DiscountStore {
  constructor(seller, logger) { this.seller = String(seller); this.logger = logger; }
  getAll() { return db.prepare('SELECT * FROM desc_itens WHERE seller=? ORDER BY id').all(this.seller).map(rowToItem); }
  findByMlb(mlb) { return rowToItem(db.prepare('SELECT * FROM desc_itens WHERE seller=? AND mlb=?').get(this.seller, mlb)); }
  upsert({ name, mlb, price, color, promotionFinishAt }) {
    if (typeof price === 'string') price = parseFloat(price.replace(',', '.'));
    const ex = db.prepare('SELECT id FROM desc_itens WHERE seller=? AND mlb=?').get(this.seller, mlb);
    if (ex) {
      const sets = ['name=?', 'price=?', 'color=?'], vals = [name ?? null, price, color ?? null];
      if (promotionFinishAt !== undefined) { sets.push('promotion_finish_at=?'); vals.push(promotionFinishAt ?? null); }
      db.prepare(`UPDATE desc_itens SET ${sets.join(',')} WHERE seller=? AND mlb=?`).run(...vals, this.seller, mlb);
    } else db.prepare('INSERT INTO desc_itens (seller,mlb,name,price,color,promotion_finish_at) VALUES (?,?,?,?,?,?)').run(this.seller, mlb, name ?? null, price, color ?? null, promotionFinishAt ?? null);
    return this.findByMlb(mlb);
  }
  remove(mlb) { return db.prepare('DELETE FROM desc_itens WHERE seller=? AND mlb=?').run(this.seller, mlb).changes > 0; }
  // undefined vira NULL (limpa o campo)
  updateStatus(mlb, up) {
    const sets = [], vals = [];
    for (const [k, [col, bool]] of Object.entries(STATUS)) { if (!(k in up)) continue; sets.push(`${col}=?`); vals.push(bool ? (up[k] ? 1 : 0) : (up[k] ?? null)); }
    if (!sets.length) return false;
    return db.prepare(`UPDATE desc_itens SET ${sets.join(',')} WHERE seller=? AND mlb=?`).run(...vals, this.seller, mlb).changes > 0;
  }
  getFailedItems() { return db.prepare('SELECT * FROM desc_itens WHERE seller=? AND last_attempt_failed=1 ORDER BY id').all(this.seller).map(rowToItem); }
}

// itens que ficaram "processando" por queda/reinício do servidor
export function limparTravados() {
  return db.prepare(`UPDATE desc_itens SET processing=0, last_attempt_failed=1, last_error_message='Processamento interrompido por reinício do servidor.', last_error_code='INTERRUPTED' WHERE processing=1`).run().changes;
}

const mlbsDe = id => db.prepare('SELECT mlb FROM desc_categoria_itens WHERE categoria_id=? ORDER BY rowid').all(id).map(r => r.mlb);
const toCat = r => r && { id: r.id, name: r.name, mlbs: mlbsDe(r.id), createdAt: r.created_at };

export class CategoriesStore {
  list(seller) { return db.prepare('SELECT * FROM desc_categorias WHERE seller=? ORDER BY created_at, rowid').all(String(seller)).map(toCat); }
  find(seller, id) { return toCat(db.prepare('SELECT * FROM desc_categorias WHERE seller=? AND id=?').get(String(seller), id)); }
  create(seller, { name, mlbs }) {
    if (!name || typeof name !== 'string') throw new Error('Nome obrigatório');
    const id = 'cat_' + crypto.randomBytes(5).toString('hex');
    db.prepare('INSERT INTO desc_categorias (id,seller,name) VALUES (?,?,?)').run(id, String(seller), name.trim().slice(0, 60));
    const ins = db.prepare('INSERT OR IGNORE INTO desc_categoria_itens (categoria_id,mlb) VALUES (?,?)');
    for (const m of new Set(Array.isArray(mlbs) ? mlbs : [])) ins.run(id, m);
    return this.find(seller, id);
  }
  update(seller, id, { name, mlbs, addMlbs, removeMlbs }) {
    if (!db.prepare('SELECT id FROM desc_categorias WHERE seller=? AND id=?').get(String(seller), id)) return null;
    if (name !== undefined) db.prepare('UPDATE desc_categorias SET name=? WHERE id=?').run(String(name).trim().slice(0, 60), id);
    const ins = db.prepare('INSERT OR IGNORE INTO desc_categoria_itens (categoria_id,mlb) VALUES (?,?)');
    if (Array.isArray(mlbs)) { db.prepare('DELETE FROM desc_categoria_itens WHERE categoria_id=?').run(id); for (const m of new Set(mlbs)) ins.run(id, m); }
    else {
      for (const m of Array.isArray(addMlbs) ? addMlbs : []) ins.run(id, m);
      const del = db.prepare('DELETE FROM desc_categoria_itens WHERE categoria_id=? AND mlb=?');
      for (const m of Array.isArray(removeMlbs) ? removeMlbs : []) del.run(id, m);
    }
    return this.find(seller, id);
  }
  remove(seller, id) { return db.prepare('DELETE FROM desc_categorias WHERE seller=? AND id=?').run(String(seller), id).changes > 0; }
}
