// Contas conectadas pelo botão "Conectar" (login oficial do Mercado Livre, via intermediário — veja broker/worker.js).
// O app é o ÚNICO dono do refresh_token dessas contas (uso único): renova aqui, com trava, e grava cifrado.
//
//   data/contas.json           → lista sem segredos: [{ n, tipo: 'ml', user_id, nickname, nome, conectada_em }]
//   data/tokens/ml-<id>.bin    → tokens cifrados com o cofre do sistema (Electron safeStorage: DPAPI no Windows).
//                                Fora do app (node start.js) o cofre não existe e o arquivo fica em texto (aviso no log).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, DATA_DIR, env } from './ml.js';

// Endereço do intermediário (broker/). Ordem: NEXUS_BROKER no ambiente ou no .env da pasta de dados → app-config.json
// na raiz do programa (quem gera o instalador cria a partir de app-config.example.json; fica fora do git e vai dentro do .exe).
const configEmbutida = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'app-config.json'), 'utf8')); } catch { return {}; } })();
export const BROKER = String(process.env.NEXUS_BROKER || env.ML_DASH_BROKER || env.NEXUS_BROKER || configEmbutida.broker || '').replace(/\/+$/, '');

const DIR = path.join(DATA_DIR, 'data'), TOK = path.join(DIR, 'tokens'), LISTA = path.join(DIR, 'contas.json');
fs.mkdirSync(TOK, { recursive: true });

// ───────── cofre ─────────
let safe = null;
if (process.versions.electron) { try { safe = (await import('electron')).safeStorage; } catch { /* fora do processo principal */ } }
const cifrado = () => !!safe?.isEncryptionAvailable();
if (!cifrado()) console.warn('[contas] cofre do sistema indisponível: tokens das contas conectadas ficam em texto em data/tokens/');
const MARCA = Buffer.from('MLD1');
const cifra = s => (cifrado() ? Buffer.concat([MARCA, safe.encryptString(s)]) : Buffer.from(s, 'utf8'));
const decifra = b => (b.subarray(0, 4).equals(MARCA) ? safe.decryptString(b.subarray(4)) : b.toString('utf8'));
const gravar = (f, buf) => { const tmp = f + '.tmp'; fs.writeFileSync(tmp, buf); fs.renameSync(tmp, f); };

// ───────── lista de contas ─────────
export const listarContas = () => { try { return JSON.parse(fs.readFileSync(LISTA, 'utf8')); } catch { return []; } };
const salvarLista = l => gravar(LISTA, Buffer.from(JSON.stringify(l, null, 2)));
const arqToken = id => path.join(TOK, `ml-${String(id).replace(/\D/g, '')}.bin`);
const lerTokens = id => JSON.parse(decifra(fs.readFileSync(arqToken(id))));
const gravarTokens = (id, t) => gravar(arqToken(id), cifra(JSON.stringify(t)));
export const temTokenConta = id => fs.existsSync(arqToken(id));

// ───────── chamadas ao intermediário ─────────
async function broker(rota, corpo) {
  if (!BROKER) throw new Error('Intermediário de login não configurado (NEXUS_BROKER).');
  const r = await fetch(BROKER + rota, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(20000) } : { signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.message || d.error_description || d.error || `HTTP ${r.status}`); e.status = r.status; e.codigo = d.error; throw e; }
  return d;
}
const tokensDe = d => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, updated_at: Date.now() });

// ───────── renovação (trava: chamadas simultâneas compartilham o mesmo refresh) ─────────
const pendente = new Map();
export async function tokenConta(id) {
  const t = lerTokens(id);
  if (Date.now() < t.updated_at + t.expires_in * 1000 - 5 * 60e3) return t.access_token;
  if (!pendente.has(id)) pendente.set(id, (async () => {
    try {
      const d = await broker('/ml/refresh', { refresh_token: lerTokens(id).refresh_token });
      gravarTokens(id, tokensDe(d));
      return d.access_token;
    } catch (e) {
      if (e.codigo === 'invalid_grant') marcar(id, { reconectar: true }); // autorização revogada/expirada: precisa clicar em Conectar de novo
      throw new Error(`Não foi possível renovar o acesso da conta ${id}: ${e.message}`);
    } finally { pendente.delete(id); }
  })());
  return pendente.get(id);
}
const marcar = (id, campos) => salvarLista(listarContas().map(c => (c.user_id === String(id) ? { ...c, ...campos } : c)));

// ───────── conectar (PKCE + state) ─────────
const b64url = b => b.toString('base64url');
const pedidos = new Map(); // nonce → { verifier, expira }
export async function iniciarConexao(porta) {
  const cfg = await broker('/ml/config');
  const verifier = b64url(crypto.randomBytes(48)), nonce = b64url(crypto.randomBytes(24));
  for (const [k, v] of pedidos) if (v.expira < Date.now()) pedidos.delete(k);
  pedidos.set(nonce, { verifier, expira: Date.now() + 15 * 60e3 });
  const u = new URL(cfg.auth_url);
  Object.entries({ response_type: 'code', client_id: cfg.client_id, redirect_uri: cfg.redirect_uri, state: `${porta}.${nonce}`,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256' }).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

// Retorno do login (vem do navegador do sistema). Devolve a conta conectada.
export async function concluirConexao({ code, state, error }) {
  const nonce = String(state || '').split('.')[1] || '', p = pedidos.get(nonce);
  if (!p || p.expira < Date.now()) throw new Error('Este link de retorno expirou ou não foi pedido por este app. Clique em Conectar de novo.');
  pedidos.delete(nonce);
  if (error) throw new Error('A autorização foi cancelada no Mercado Livre.');
  const d = await broker('/ml/token', { code, code_verifier: p.verifier });
  const me = await fetch('https://api.mercadolibre.com/users/me', { headers: { Authorization: `Bearer ${d.access_token}` }, signal: AbortSignal.timeout(20000) })
    .then(r => (r.ok ? r.json() : {})).catch(() => ({})); // só para o apelido; o id vem na própria resposta do token
  const id = String(d.user_id || me.id || '');
  if (!/^\d+$/.test(id)) throw new Error('Não consegui identificar a conta do Mercado Livre.');
  gravarTokens(id, tokensDe(d));
  const lista = listarContas(), ja = lista.find(c => c.user_id === id);
  if (ja) { marcar(id, { nickname: me.nickname || ja.nickname, reconectar: false }); return { ...ja, nova: false }; }
  const n = proximoNumero(lista), conta = { n, tipo: 'ml', user_id: id, nickname: me.nickname || '', nome: me.nickname || `Loja ${n}`, conectada_em: new Date().toISOString() };
  salvarLista([...lista, conta]);
  return { ...conta, nova: true };
}

// Número livre: depois das contas do .env (TOKENS_LOJA<n>) e das já conectadas (os dados no banco são por loja<n>; não reaproveita).
function proximoNumero(lista) {
  const usados = new Set(lista.map(c => c.n));
  for (const k of Object.keys(env)) { const m = /^TOKENS_LOJA(\d+)$/.exec(k); if (m) usados.add(Number(m[1])); }
  let n = 1; while (usados.has(n)) n++; return n;
}

export function renomearConta(n, nome) {
  nome = String(nome || '').trim().slice(0, 60);
  if (!nome) throw Object.assign(new Error('nome vazio'), { status: 400 });
  const l = listarContas(); if (!l.some(c => c.n === n)) throw Object.assign(new Error('conta não encontrada'), { status: 404 });
  salvarLista(l.map(c => (c.n === n ? { ...c, nome } : c)));
}

// Desconectar: apaga os tokens deste PC (os dados já coletados ficam no banco). A autorização também pode ser revogada no ML.
export function desconectarConta(n) {
  const l = listarContas(), c = l.find(x => x.n === n);
  if (!c) throw Object.assign(new Error('conta não encontrada'), { status: 404 });
  fs.rmSync(arqToken(c.user_id), { force: true });
  salvarLista(l.filter(x => x.n !== n));
}
