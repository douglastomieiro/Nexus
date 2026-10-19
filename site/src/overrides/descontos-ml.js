// Cliente do ML para ESCRITA (descontos) — versão do site web: usa as contas/tokens do login (overrides/contas.js) e passa pelo intermediário.
// Requisições com erro no formato que o motor de descontos espera.
import { listarContas, tokenConta, temTokenConta } from './contas.js';
import { fetchApi } from './proxy.js';

export const DIR = '/descontos';
export const API = 'https://api.mercadolibre.com';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// contas: [{ id (seller_id), nickname, loja ('loja1'|'loja2'|...) }]
export const contas = () => listarContas().filter(c => c.tipo === 'ml').map(c => ({ id: c.user_id, nickname: c.nickname || c.nome, loja: `loja${c.n}`, conectada: true }));
export const conta = id => contas().find(c => c.id === String(id)) || null;
export const tokenDe = id => tokenConta(String(id));
export const temToken = id => temTokenConta(id);

// Em erro, lança Error com .response = { status, data, headers } (como o axios), que é o que classifyError() do motor lê.
export async function req(getToken, method, pathOrUrl, { data, params, timeout = 30000 } = {}) {
  let url = pathOrUrl.startsWith('http') ? pathOrUrl : API + pathOrUrl;
  if (params) { const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString(); if (q) url += (url.includes('?') ? '&' : '?') + q; }
  let res;
  try {
    res = await fetchApi(url, { method, signal: AbortSignal.timeout(timeout),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` }, body: data !== undefined ? JSON.stringify(data) : undefined });
  } catch (e) {
    if (e.response) throw e;
    const err = new Error(e.name === 'TimeoutError' ? 'timeout' : e.message); err.code = e.name === 'TimeoutError' ? 'ETIMEDOUT' : 'ECONNRESET'; throw err;
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
    console[fn](`[${lvl.padEnd(5)}] [${ctx}] ${msg}${m}`);
  };
  return { info: (m, x) => log('INFO', 'log', m, x), warn: (m, x) => log('WARN', 'warn', m, x), error: (m, x) => log('ERROR', 'error', m, x) };
}
