// Cliente do ML para ESCRITA (descontos): tokens próprios (renovados aqui) + requisições com erro no formato que o motor espera.
// Contas conectadas pelo app usam os tokens de ../contas.js; contas legadas renovam aqui (data/descontos/tokens-<id>.json).
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../ml.js';
import { listarContas, tokenConta, temTokenConta } from '../contas.js';

export const DIR = path.join(DATA_DIR, 'data', 'descontos');
fs.mkdirSync(DIR, { recursive: true });
export const API = 'https://api.mercadolibre.com';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

const env = Object.fromEntries(
  (fs.existsSync(path.join(DATA_DIR, '.env')) ? fs.readFileSync(path.join(DATA_DIR, '.env'), 'utf8') : '').split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

// contas: [{ id (seller_id), nickname, loja ('loja1'|'loja2'|...) }]
// Fonte principal: as contas conectadas pelo app (mesmos tokens da leitura — um só dono do refresh_token).
// Legado: data/descontos/contas.json + tokens-<id>.json renovados com ML_CLIENT_ID/ML_CLIENT_SECRET do .env.
const contasFile = path.join(DIR, 'contas.json');
const conectadas = () => listarContas().filter(c => c.tipo === 'ml').map(c => ({ id: c.user_id, nickname: c.nickname || c.nome, loja: `loja${c.n}`, conectada: true }));
export const contas = () => {
  let legado = []; try { legado = JSON.parse(fs.readFileSync(contasFile, 'utf8')); } catch { /* nenhuma */ }
  const c = conectadas(); return [...c, ...legado.filter(l => !c.some(x => x.id === String(l.id)))];
};
export const conta = id => contas().find(c => c.id === String(id)) || null;

// ───────── tokens (renovação com trava: duas chamadas simultâneas compartilham o mesmo refresh) ─────────
class TokenManager {
  constructor(id) { this.file = path.join(DIR, `tokens-${id}.json`); this.pending = null; }
  load() { return JSON.parse(fs.readFileSync(this.file, 'utf8')); }
  save(t) { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(t, null, 2)); fs.renameSync(tmp, this.file); }
  async refresh() {
    const t = this.load();
    if (!(t.client_id || env.ML_CLIENT_ID) || !(t.client_secret || env.ML_CLIENT_SECRET)) throw new Error('ML_CLIENT_ID/ML_CLIENT_SECRET ausentes no .env do Nexus');
    const res = await fetch(API + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: t.client_id || env.ML_CLIENT_ID, client_secret: t.client_secret || env.ML_CLIENT_SECRET, refresh_token: t.refresh_token }).toString() });
    const d = await res.json().catch(() => ({}));
    if (!d.access_token) throw new Error('Falha ao renovar token ML: ' + (d.message || d.error || res.status));
    this.save({ ...t, access_token: d.access_token, refresh_token: d.refresh_token || t.refresh_token, expires_in: d.expires_in, updated_at: Date.now() });
    return d.access_token;
  }
  async get() {
    const t = this.load();
    if (Date.now() < t.updated_at + t.expires_in * 1000 - 60_000) return t.access_token;
    return this.pending ||= this.refresh().finally(() => { this.pending = null; });
  }
}
const mgrs = new Map();
const ehConectada = id => listarContas().some(c => c.tipo === 'ml' && c.user_id === String(id));
export const tokenDe = id => {
  const k = String(id);
  if (ehConectada(k)) return tokenConta(k);
  if (!mgrs.has(k)) mgrs.set(k, new TokenManager(k)); return mgrs.get(k).get();
};
export const temToken = id => (ehConectada(id) ? temTokenConta(id) : fs.existsSync(path.join(DIR, `tokens-${id}.json`)));

// ───────── requisição ─────────
// Em erro, lança Error com .response = { status, data, headers } (como o axios), que é o que classifyError() do motor lê.
export async function req(getToken, method, pathOrUrl, { data, params, timeout = 30000 } = {}) {
  let url = pathOrUrl.startsWith('http') ? pathOrUrl : API + pathOrUrl;
  if (params) { const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString(); if (q) url += (url.includes('?') ? '&' : '?') + q; }
  let res;
  try {
    res = await fetch(url, { method, signal: AbortSignal.timeout(timeout),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'AppMercadoLivre/1.0', Authorization: `Bearer ${await getToken()}` }, body: data !== undefined ? JSON.stringify(data) : undefined });
  } catch (e) {
    if (e.response) throw e;
    const err = new Error(e.name === 'TimeoutError' ? 'timeout' : (e.cause?.code || e.message)); err.code = e.name === 'TimeoutError' ? 'ETIMEDOUT' : (e.cause?.code || 'ECONNRESET'); throw err;
  }
  const text = await res.text(); let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!res.ok) {
    const err = new Error(body?.message || `HTTP ${res.status}`);
    err.response = { status: res.status, data: body, headers: { 'retry-after': res.headers.get('retry-after') } }; throw err;
  }
  return { status: res.status, data: body };
}

export function createLogger(ctx) {
  const log = (lvl, fn, msg, meta) => {
    const m = meta ? ' | ' + Object.entries(meta).filter(([, v]) => v != null).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | ') : '';
    console[fn](`[${new Date().toLocaleString('sv', { timeZone: 'America/Sao_Paulo' })}] [${lvl.padEnd(5)}] [${ctx}] ${msg}${m}`);
  };
  return { info: (m, x) => log('INFO', 'log', m, x), warn: (m, x) => log('WARN', 'warn', m, x), error: (m, x) => log('ERROR', 'error', m, x) };
}
