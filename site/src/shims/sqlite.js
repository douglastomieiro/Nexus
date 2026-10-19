// Faz o SQLite em WebAssembly (guardado no navegador, em OPFS) responder como o `better-sqlite3` que o servidor usa.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const sqlite3 = await sqlite3InitModule({ locateFile: f => new URL(f, self.location.href).href, print() {}, printErr: m => console.warn('[sqlite]', m) });

export let persistente = false;
let raw;
if (navigator.storage?.getDirectory) {
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'nexus', initialCapacity: 8 });
    raw = new pool.OpfsSAHPoolDb('/nexus.db');
    persistente = true;
  } catch (e) {
    // Sem acesso ao armazenamento = outra aba do Nexus já está com o banco aberto.
    throw Object.assign(new Error('O Nexus já está aberto em outra aba deste navegador.'), { codigo: 'ocupado', causa: String(e) });
  }
} else {
  console.warn('[sqlite] armazenamento privado indisponível: os dados ficam só na memória desta aba.');
  raw = new sqlite3.oo1.DB(':memory:');
}

const ehObjeto = a => a && typeof a === 'object' && !Array.isArray(a) && !(a instanceof Uint8Array);
const valor = v => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v);
const ligacoes = args => {
  if (args.length === 1 && ehObjeto(args[0])) return Object.fromEntries(Object.entries(args[0]).map(([k, v]) => ['@' + k, valor(v)]));
  const l = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return l.length ? l.map(valor) : null;
};

class Stmt {
  constructor(bd, sql) { this.bd = bd; this.sql = sql; }
  _s() { let s = this.bd.cache.get(this.sql); if (!s) { s = raw.prepare(this.sql); this.bd.cache.set(this.sql, s); } return s; }
  _passos(args, fn) {
    const s = this._s(); s.reset(true);
    try { const l = ligacoes(args); if (l) s.bind(l); return fn(s); } finally { s.reset(true); }
  }
  run(...args) { return this._passos(args, s => { while (s.step()); return { changes: raw.changes(), get lastInsertRowid() { return raw.selectValue('SELECT last_insert_rowid()'); } }; }); }
  get(...args) { return this._passos(args, s => (s.step() ? s.get({}) : undefined)); }
  all(...args) { return this._passos(args, s => { const o = []; while (s.step()) o.push(s.get({})); return o; }); }
  *iterate(...args) {
    const s = raw.prepare(this.sql); // própria (não a do cache): o laço pode consultar o banco enquanto itera
    try { const l = ligacoes(args); if (l) s.bind(l); while (s.step()) yield s.get({}); } finally { s.finalize(); }
  }
}

export default class Database {
  constructor() { this.cache = new Map(); }
  pragma(p) { try { raw.exec('PRAGMA ' + p); } catch { /* alguns (ex.: WAL) não se aplicam aqui */ } }
  exec(sql) { raw.exec(sql); return this; }
  prepare(sql) { return new Stmt(this, sql); }
  transaction(fn) {
    return (...a) => {
      raw.exec('BEGIN');
      try { const r = fn(...a); raw.exec('COMMIT'); return r; } catch (e) { try { raw.exec('ROLLBACK'); } catch { /* já desfeito */ } throw e; }
    };
  }
}
