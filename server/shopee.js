// Cliente Shopee Open API v2 — tokens SÓ LIDOS do sistema antigo (tv/SE/tokensSE*.json), que é quem renova (refresh_token é de uso único).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, env, nomeLoja, MAX_LOJAS } from './ml.js';

const HOST = 'https://partner.shopeemobile.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Contas: uma por SHOPEE_TOKENS_LOJA<n> no .env; shopee<n> = mesma empresa da conta ML loja<n>.
export const SHOPEE = {};
for (let n = 1; n <= MAX_LOJAS; n++) if (env[`SHOPEE_TOKENS_LOJA${n}`]) SHOPEE[`shopee${n}`] = {
  nome: `${nomeLoja(n)} (Shopee)`, n, file: path.resolve(DATA_DIR, env[`SHOPEE_TOKENS_LOJA${n}`]),
  partnerId: Number(env[`SHOPEE_PARTNER_ID_LOJA${n}`]), partnerKey: env[`SHOPEE_PARTNER_KEY_LOJA${n}`],
};
export const shopeeConfigurada = () => Object.values(SHOPEE).length > 0 && Object.values(SHOPEE).every(s => s.file && s.partnerId && s.partnerKey);

function readToken(loja) {
  const t = JSON.parse(fs.readFileSync(SHOPEE[loja].file, 'utf8'));
  const expiraEm = (t.last_refresh_time || 0) + (t.expire_in || 0) * 1000 - Date.now();
  return { token: t.access_token, shopId: t.shop_id, expiraEm };
}
// Aguarda o sistema antigo renová-lo (ele renova ~10 min antes de vencer)
async function token(loja) {
  for (let i = 0; i < 12; i++) {
    const t = readToken(loja);
    if (t.expiraEm > 30_000) return t;
    await sleep(5000);
  }
  throw new Error(`Token ${loja} vencido e não renovado pelo sistema antigo`);
}

const last = {};
// GET assinado. Retorna { status, body } (body.error preenchido em erro de negócio). Nunca escreve nos tokens.
export async function spGet(loja, apiPath, params = {}, { retries = 3, minGap = 150, body: payload } = {}) {
  const cfg = SHOPEE[loja];
  for (let i = 0; i <= retries; i++) {
    const wait = (last[loja] || 0) + minGap - Date.now(); last[loja] = Math.max(Date.now(), (last[loja] || 0) + minGap);
    if (wait > 0) await sleep(wait);
    const { token: at, shopId } = await token(loja);
    const ts = Math.floor(Date.now() / 1000);
    const sign = crypto.createHmac('sha256', cfg.partnerKey).update(`${cfg.partnerId}${apiPath}${ts}${at}${shopId}`).digest('hex');
    const qs = new URLSearchParams({ partner_id: cfg.partnerId, timestamp: ts, sign, shop_id: shopId, access_token: at,
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)])) });
    let res;
    try { res = await fetch(`${HOST}${apiPath}?${qs}`, { signal: AbortSignal.timeout(30_000), ...(payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}) }); }
    catch (e) { if (i === retries) return { status: 0, body: { error: String(e) } }; await sleep(1000 * (i + 1)); continue; }
    const text = await res.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
    const limitado = body?.error === 'error_server' || /too many|rate/i.test(body?.message || '');
    if ((res.status === 429 || res.status >= 500 || limitado) && i < retries) { await sleep(1500 * (i + 1)); continue; }
    return { status: res.status, body };
  }
}
