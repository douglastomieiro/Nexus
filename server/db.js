// SQLite: guarda a resposta CRUA de cada endpoint (raw first). Telas consultam com json_extract.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './ml.js';

const DATA = path.join(DATA_DIR, 'data');
fs.mkdirSync(DATA, { recursive: true });
export const db = new Database(path.join(DATA, 'ml.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS raw (
  loja TEXT NOT NULL, recurso TEXT NOT NULL, chave TEXT NOT NULL,
  url TEXT, status INTEGER, body TEXT, coletado_em INTEGER NOT NULL,
  PRIMARY KEY (loja, recurso, chave)
);
CREATE INDEX IF NOT EXISTS raw_rec ON raw (loja, recurso, status);
CREATE TABLE IF NOT EXISTS coleta_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, loja TEXT, modulo TEXT, inicio INTEGER, fim INTEGER,
  chamadas INTEGER, ok INTEGER, erros INTEGER, obs TEXT
);
`);

const up = db.prepare(`INSERT INTO raw (loja,recurso,chave,url,status,body,coletado_em) VALUES (?,?,?,?,?,?,?)
  ON CONFLICT(loja,recurso,chave) DO UPDATE SET url=excluded.url,status=excluded.status,body=excluded.body,coletado_em=excluded.coletado_em
  WHERE (excluded.status BETWEEN 200 AND 299) OR (raw.status NOT BETWEEN 200 AND 299)`); // falha nunca apaga um dado bom
const get = db.prepare('SELECT status, body, coletado_em FROM raw WHERE loja=? AND recurso=? AND chave=?');

export const saveRaw = (loja, recurso, chave, url, status, body) =>
  up.run(loja, recurso, String(chave), url, status, typeof body === 'string' ? body : JSON.stringify(body), Date.now());
export const getRaw = (loja, recurso, chave) => {
  const r = get.get(loja, recurso, String(chave));
  return r && { ...r, body: r.body ? safeParse(r.body) : null };
};
const safeParse = s => { try { return JSON.parse(s); } catch { return s; } };
export const logColeta = (row) => db.prepare(
  'INSERT INTO coleta_log (loja,modulo,inicio,fim,chamadas,ok,erros,obs) VALUES (@loja,@modulo,@inicio,@fim,@chamadas,@ok,@erros,@obs)').run(row);
export const listRaw = (loja, recurso) => db.prepare('SELECT chave, body FROM raw WHERE loja=? AND recurso=? AND status=200').all(loja, recurso)
  .map(r => ({ chave: r.chave, body: safeParse(r.body) }));
