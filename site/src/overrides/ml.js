// Cliente ML (leitura) — versão do site web. As contas vêm do login (overrides/contas.js); as chamadas passam pelo intermediário (overrides/proxy.js).
import { listarContas, tokenConta } from './contas.js';
import { fetchApi } from './proxy.js';

export const ROOT = '/';
export const DATA_DIR = '/';
export const env = {};
export const MAX_LOJAS = 20;
export const nomeLoja = n => `Loja ${n}`;

export const LOJAS = {};
for (const c of [...listarContas()].filter(c => c.tipo === 'ml').sort((a, b) => a.n - b.n)) LOJAS[`loja${c.n}`] = { nome: c.nome || `Loja ${c.n}`, conta: c.user_id };

export const API = 'https://api.mercadolibre.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function readToken() { throw new Error('Modo avançado (.env) não existe no site web.'); }

const lastCalls = {};
export async function mlGet(loja, pathOrUrl, { retries = 4, minGap = 40, headers = {} } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : API + pathOrUrl;
  for (let i = 0; i <= retries; i++) {
    const last = lastCalls[loja] || 0; const wait = last + minGap - Date.now(); lastCalls[loja] = Math.max(Date.now(), last + minGap);
    if (wait > 0) await sleep(wait);
    let res;
    try { res = await fetchApi(url, { headers: { Authorization: `Bearer ${await tokenConta(LOJAS[loja].conta)}`, ...headers } }); }
    catch (e) { if (i === retries) return { status: 0, error: String(e) }; await sleep(1000 * (i + 1)); continue; }
    if (res.status === 429 || res.status >= 500) { if (i < retries) { await sleep(1500 * (i + 1)); continue; } }
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body, bytes: text.length, ctype: res.headers.get('content-type') };
  }
}
