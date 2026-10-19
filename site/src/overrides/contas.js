// Contas conectadas pelo botão "Conectar" (login oficial do Mercado Livre, via intermediário — veja broker/worker.js). Versão do site web.
// Os tokens ficam só neste navegador, no IndexedDB, cifrados com uma chave que o navegador não deixa exportar (WebCrypto, non-extractable).
// O site é o ÚNICO dono do refresh_token dessas contas (uso único): renova aqui, com trava.
import { kvGet, kvSet, kvDel } from './idb.js';
import { BROKER, fetchApi } from './proxy.js';

export { BROKER };

// ───────── cofre (AES-GCM, chave não exportável) ─────────
let chave = await kvGet('chave');
if (!chave) { chave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await kvSet('chave', chave); }
const cifra = async obj => { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(JSON.stringify(obj))) }; };
const decifra = async ({ iv, ct }) => JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, ct)));

// ───────── estado em memória (carregado ao abrir; gravado a cada mudança) ─────────
let lista = (await kvGet('contas')) || [];
const tokens = new Map(); // user_id → { access_token, refresh_token, expires_in, updated_at }
for (const c of lista) { try { const b = await kvGet('tok:' + c.user_id); if (b) tokens.set(c.user_id, await decifra(b)); } catch { /* chave/token ilegível: pede para reconectar */ } }

export const listarContas = () => lista;
const salvarLista = async l => { lista = l; await kvSet('contas', l); };
const gravarTokens = async (id, t) => { tokens.set(id, t); await kvSet('tok:' + id, await cifra(t)); };
export const temTokenConta = id => tokens.has(String(id));

// ───────── chamadas ao intermediário ─────────
async function broker(rota, corpo) {
  if (!BROKER) throw new Error('Intermediário de login não configurado nesta versão do site.');
  const r = await fetch(BROKER + rota, corpo
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(20000), credentials: 'omit' }
    : { signal: AbortSignal.timeout(20000), credentials: 'omit' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.message || d.error_description || d.error || `HTTP ${r.status}`); e.status = r.status; e.codigo = d.error; throw e; }
  return d;
}
const tokensDe = d => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, updated_at: Date.now() });

// ───────── renovação (trava: chamadas simultâneas compartilham o mesmo refresh) ─────────
const pendente = new Map();
export async function tokenConta(id) {
  id = String(id);
  const t = tokens.get(id);
  if (!t) throw new Error(`Conta ${id} sem acesso: reconecte em Configurações > Contas.`);
  if (Date.now() < t.updated_at + t.expires_in * 1000 - 5 * 60e3) return t.access_token;
  if (!pendente.has(id)) pendente.set(id, (async () => {
    try {
      const d = await broker('/ml/refresh', { refresh_token: tokens.get(id).refresh_token });
      await gravarTokens(id, tokensDe(d));
      return d.access_token;
    } catch (e) {
      if (e.codigo === 'invalid_grant') await marcar(id, { reconectar: true }); // autorização revogada/expirada: precisa clicar em Conectar de novo
      throw new Error(`Não foi possível renovar o acesso da conta ${id}: ${e.message}`);
    } finally { pendente.delete(id); }
  })());
  return pendente.get(id);
}
const marcar = (id, campos) => salvarLista(lista.map(c => (c.user_id === String(id) ? { ...c, ...campos } : c)));

// ───────── conectar (PKCE + state) ─────────
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const aleatorio = n => b64url(crypto.getRandomValues(new Uint8Array(n)));

// Devolve o endereço da página oficial do ML. O navegador vai até lá NESTA aba e o ML volta ao site (via intermediário) com ?code=&state=.
export async function iniciarConexao() {
  const cfg = await broker('/ml/config');
  const verifier = aleatorio(48), nonce = aleatorio(24);
  const pedidos = Object.fromEntries(Object.entries((await kvGet('pedidos')) || {}).filter(([, v]) => v.expira > Date.now()));
  pedidos[nonce] = { verifier, expira: Date.now() + 15 * 60e3 };
  await kvSet('pedidos', pedidos);
  const u = new URL(cfg.auth_url);
  Object.entries({ response_type: 'code', client_id: cfg.client_id, redirect_uri: cfg.redirect_uri, state: `w.${nonce}`,
    code_challenge: b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), code_challenge_method: 'S256' }).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

// Retorno do login (a página repassa o ?code=&state= ao Worker). Devolve a conta conectada.
export async function concluirConexao({ code, state, error }) {
  const nonce = String(state || '').split('.')[1] || '';
  const pedidos = (await kvGet('pedidos')) || {}, p = pedidos[nonce];
  if (!p || p.expira < Date.now()) throw new Error('Este retorno de login expirou ou não foi pedido por este navegador. Clique em Conectar de novo.');
  delete pedidos[nonce]; await kvSet('pedidos', pedidos);
  if (error) throw new Error('A autorização foi cancelada no Mercado Livre.');
  const d = await broker('/ml/token', { code, code_verifier: p.verifier });
  const me = await fetchApi('https://api.mercadolibre.com/users/me', { headers: { Authorization: `Bearer ${d.access_token}` }, signal: AbortSignal.timeout(20000) })
    .then(r => (r.ok ? r.json() : {})).catch(() => ({})); // só para o apelido; o id vem na própria resposta do token
  const id = String(d.user_id || me.id || '');
  if (!/^\d+$/.test(id)) throw new Error('Não consegui identificar a conta do Mercado Livre.');
  await gravarTokens(id, tokensDe(d));
  const ja = lista.find(c => c.user_id === id);
  if (ja) { await marcar(id, { nickname: me.nickname || ja.nickname, reconectar: false }); return { ...ja, nova: false }; }
  const n = proximoNumero(), conta = { n, tipo: 'ml', user_id: id, nickname: me.nickname || '', nome: me.nickname || `Loja ${n}`, conectada_em: new Date().toISOString() };
  await salvarLista([...lista, conta]);
  return { ...conta, nova: true };
}

// Número livre (os dados no banco são por loja<n>; não reaproveita).
function proximoNumero() { const usados = new Set(lista.map(c => c.n)); let n = 1; while (usados.has(n)) n++; return n; }

export async function renomearConta(n, nome) {
  nome = String(nome || '').trim().slice(0, 60);
  if (!nome) throw Object.assign(new Error('nome vazio'), { status: 400 });
  if (!lista.some(c => c.n === n)) throw Object.assign(new Error('conta não encontrada'), { status: 404 });
  await salvarLista(lista.map(c => (c.n === n ? { ...c, nome } : c)));
}

// Desconectar: apaga os tokens deste navegador (os dados já coletados ficam no banco). A autorização também pode ser revogada no ML.
export async function desconectarConta(n) {
  const c = lista.find(x => x.n === n);
  if (!c) throw Object.assign(new Error('conta não encontrada'), { status: 404 });
  tokens.delete(c.user_id); await kvDel('tok:' + c.user_id);
  await salvarLista(lista.filter(x => x.n !== n));
}
