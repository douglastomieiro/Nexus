// Cliente ML (leitura). Tokens: contas conectadas pelo app (server/contas.js) ou, no modo avançado, arquivo de token de outro programa.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Raiz do programa (código e telas; no app instalado é só leitura)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Pasta de DADOS do usuário: .env, data/ (banco, tokens de escrita) e backup-custos/. Caminhos de token do .env são relativos a ela.
// No app (Electron) é a pasta do usuário no sistema (ex.: %APPDATA%\Nexus_); rodando com `node start.js`, a própria pasta do projeto.
export const DATA_DIR = process.env.NEXUS_DATA ? path.resolve(process.env.NEXUS_DATA) : ROOT;
fs.mkdirSync(DATA_DIR, { recursive: true });
const envFile = path.join(DATA_DIR, '.env');

export const env = Object.fromEntries(
  (fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '').split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

// Contas do ML (loja<n>), de duas fontes:
//  1. conectadas pelo botão "Conectar" (data/contas.json; tokens próprios, renovados pelo app — server/contas.js);
//  2. avançado: TOKENS_LOJA<n> no .env = arquivo de token mantido por OUTRO programa (só lido aqui). Nome: NOME_LOJA<n>.
// A conta Shopee de mesmo número (shopee<n>) é tratada como a mesma empresa (mesma alíquota do Simples).
export const MAX_LOJAS = 20;
export const nomeLoja = n => env[`NOME_LOJA${n}`] || `Loja ${n}`;
export const LOJAS = {};
{
  const lista = [];
  for (let n = 1; n <= MAX_LOJAS; n++) if (env[`TOKENS_LOJA${n}`]) lista.push([n, { nome: nomeLoja(n), file: path.resolve(DATA_DIR, env[`TOKENS_LOJA${n}`]) }]);
  let conectadas = []; try { conectadas = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'data', 'contas.json'), 'utf8')); } catch { /* nenhuma */ }
  for (const c of conectadas) if (c.tipo === 'ml' && !lista.some(([n]) => n === c.n)) lista.push([c.n, { nome: c.nome || `Loja ${c.n}`, conta: c.user_id }]);
  lista.sort((a, b) => a[0] - b[0]).forEach(([n, v]) => { LOJAS[`loja${n}`] = v; });
}
export const API = 'https://api.mercadolibre.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Só para contas do .env (arquivo mantido por outro programa).
export function readToken(loja) {
  const t = JSON.parse(fs.readFileSync(LOJAS[loja].file, 'utf8'));
  const expiraEm = t.updated_at + t.expires_in * 1000 - Date.now();
  return { token: t.access_token, expiraEm };
}

// Conta conectada: o próprio app renova. Conta do .env: aguarda o outro programa renovar (re-lê o arquivo).
const tokenFalhou = {};
async function token(loja) {
  if (LOJAS[loja].conta) return (await import('./contas.js')).tokenConta(LOJAS[loja].conta);
  // se o arquivo não foi renovado há pouco, falha rápido (evita 6 chamadas paralelas esperando 2 min cada)
  if (tokenFalhou[loja] && Date.now() - tokenFalhou[loja] < 60_000) throw new Error(`Token ${loja} vencido (aguardando renovação do arquivo de token)`);
  for (let i = 0; i < 12; i++) {
    const { token, expiraEm } = readToken(loja);
    if (expiraEm > 60_000) { delete tokenFalhou[loja]; return token; }
    if (i === 0) console.warn(`[${loja}] token vencido; aguardando o programa que renova o arquivo de token...`);
    await sleep(5000);
  }
  tokenFalhou[loja] = Date.now();
  throw new Error(`Token ${loja} vencido e não renovado (arquivo de token)`);
}

const lastCalls = {};
export async function mlGet(loja, pathOrUrl, { retries = 4, minGap = 40, headers = {} } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : API + pathOrUrl;
  for (let i = 0; i <= retries; i++) {
    const last = lastCalls[loja] || 0; const wait = last + minGap - Date.now(); lastCalls[loja] = Math.max(Date.now(), last + minGap);
    if (wait > 0) await sleep(wait);
    let res;
    try { res = await fetch(url, { headers: { Authorization: `Bearer ${await token(loja)}`, ...headers } }); }
    catch (e) { if (i === retries) return { status: 0, error: String(e) }; await sleep(1000 * (i + 1)); continue; }
    if (res.status === 429 || res.status >= 500) { if (i < retries) { await sleep(1500 * (i + 1)); continue; } }
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body, bytes: text.length, ctype: res.headers.get('content-type') };
  }
}
