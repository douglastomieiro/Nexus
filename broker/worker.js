// Intermediário de login do Nexus (Cloudflare Worker). Código aberto; NÃO guarda nada (sem banco, sem log de tokens).
//
// Por que existe: o Mercado Livre exige a senha do aplicativo (client_secret) para trocar o código de autorização por tokens
// e para renová-los. Essa senha não pode ir dentro do app instalado (qualquer um a extrairia), então fica só aqui.
//
// Rotas:
//   GET  /ml/config    → { client_id, auth_url, redirect_uri }  (dados públicos para o app montar o link de autorização)
//   GET  /ml/callback  → o ML volta aqui depois do "Autorizar"; repassa code+state ao app no PC (http://127.0.0.1:<porta>)
//                        ou, no site web (state "w.<nonce>"), ao endereço fixo WEB_URL
//   POST /ml/token     → { code, code_verifier } → tokens  (o código sozinho não vale nada sem o code_verifier, que só o app tem: PKCE)
//   POST /ml/refresh   → { refresh_token } → tokens novos
//   POST /p            → repassa UMA chamada à API do Mercado Livre ou do Mercado Pago (só para o site web, veja WEB_URL). O navegador não consegue
//        chamar essas APIs direto (CORS); o Worker só repassa: não grava, não registra e não guarda nada.
//
// Configuração (wrangler.toml / painel da Cloudflare): ML_CLIENT_ID (variável), ML_CLIENT_SECRET (secret).
// Site web (GitHub Pages): WEB_URL = endereço do site (ex.: https://usuario.github.io/NEXUS_/). Sem ele, só o app instalado funciona.
// ML_API, MP_API e ML_AUTH só mudam em teste.

const json = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const ESTADO = /^(\d{2,5})\.([A-Za-z0-9_-]{16,128})$/; // state do app instalado = "<porta do app>.<nonce>"
const ESTADO_WEB = /^w\.[A-Za-z0-9_-]{16,128}$/; // state do site web = "w.<nonce>"
const PROXY = { ml: env => env.ML_API || 'https://api.mercadolibre.com', mp: env => env.MP_API || 'https://api.mercadopago.com' };
const REPASSA_REQ = ['authorization', 'content-type', 'accept', 'api-version', 'x-format-new', 'x-caller-id']; // cabeçalhos que seguem para o ML/MP
const REPASSA_RESP = ['content-type', 'retry-after', 'x-request-id'];

// Só o site web (WEB_URL) pode usar as rotas por navegador. Devolve o cabeçalho CORS ou null.
const origemWeb = env => { try { return env.WEB_URL ? new URL(env.WEB_URL).origin : null; } catch { return null; } };
const cors = (req, env) => {
  const o = origemWeb(env);
  return o && req.headers.get('origin') === o
    ? { 'access-control-allow-origin': o, vary: 'Origin', 'access-control-expose-headers': 'retry-after, content-type' } : {};
};

async function oauthToken(env, campos, h) {
  const r = await fetch(`${env.ML_API || 'https://api.mercadolibre.com'}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ client_id: env.ML_CLIENT_ID, client_secret: env.ML_CLIENT_SECRET, ...campos }).toString(),
  });
  const d = await r.json().catch(() => ({ error: 'resposta_invalida' }));
  return json(d, r.status, h);
}

async function corpo(req, limite = 4096) {
  const t = await req.text();
  if (t.length > limite) throw new Error('corpo grande demais');
  return JSON.parse(t || '{}');
}

// Repasse transparente. Só dois destinos fixos (ml, mp) e só para o site web: não é um proxy aberto.
// O site manda um POST "simples" (text/plain, sem cabeçalhos próprios) com o pedido dentro do corpo: assim o navegador não faz a pré-verificação
// de CORS (que dobraria o número de chamadas) e o token viaja no corpo, nunca na URL.
//   corpo: { api: 'ml'|'mp', metodo: 'GET', caminho: '/orders/search?...', cabecalhos: { authorization, 'api-version', ... }, corpo?: string }
async function repassar(req, env, h) {
  if (!h['access-control-allow-origin']) return json({ error: 'origem_nao_permitida' }, 403);
  if (req.method !== 'POST') return json({ error: 'metodo_nao_permitido' }, 405, h);
  const p = await corpo(req, 512 * 1024);
  const { api, metodo, caminho, cabecalhos = {}, corpo: dados } = p;
  if (!Object.hasOwn(PROXY, api) || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(metodo)
    || typeof caminho !== 'string' || !/^\/[^\s#\\]*$/.test(caminho) || caminho.includes('..') || caminho.startsWith('//')
    || (dados != null && typeof dados !== 'string')) return json({ error: 'pedido_invalido' }, 400, h);
  const headers = new Headers();
  for (const k of REPASSA_REQ) { const v = cabecalhos[k]; if (typeof v === 'string' && v && v.length < 4096) headers.set(k, v); }
  if (!headers.get('authorization')) return json({ error: 'sem_autorizacao' }, 401, h);
  const r = await fetch(PROXY[api](env) + caminho, { method: metodo, headers, redirect: 'manual', body: metodo === 'GET' || dados == null ? undefined : dados });
  const saida = new Headers(h);
  for (const k of REPASSA_RESP) { const v = r.headers.get(k); if (v) saida.set(k, v); }
  saida.set('cache-control', 'no-store');
  saida.set('x-status-origem', String(r.status)); // o status real vai também num cabeçalho (o site usa o do próprio HTTP; este é só conferência)
  return new Response(r.body, { status: r.status, headers: saida });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), redirectUri = `${url.origin}/ml/callback`, h = cors(req, env);
    if (req.method === 'OPTIONS') { // pré-verificação (CORS) do navegador
      if (!h['access-control-allow-origin']) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: { ...h, 'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'access-control-allow-headers': REPASSA_REQ.join(', '), 'access-control-max-age': '86400' } });
    }
    if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET) return json({ error: 'intermediario_nao_configurado' }, 500, h);
    try {
      if (url.pathname === '/p') return await repassar(req, env, h);

      if (req.method === 'GET' && url.pathname === '/ml/config')
        return json({ client_id: env.ML_CLIENT_ID, auth_url: env.ML_AUTH || 'https://auth.mercadolivre.com.br/authorization', redirect_uri: redirectUri }, 200, h);

      if (req.method === 'GET' && url.pathname === '/ml/callback') {
        const estado = url.searchParams.get('state') || '', m = ESTADO.exec(estado), web = ESTADO_WEB.test(estado) && origemWeb(env);
        let destino;
        if (web) destino = new URL(env.WEB_URL); // endereço FIXO (configurado aqui): nunca vem do pedido
        else {
          const porta = m && Number(m[1]);
          if (!m || porta < 1024 || porta > 65535) return new Response('Link de retorno inválido. Volte ao app e tente conectar de novo.', { status: 400 });
          // Só repassa ao PRÓPRIO computador de quem autorizou (127.0.0.1); o app confere o nonce do state.
          destino = new URL(`http://127.0.0.1:${porta}/oauth/ml/retorno`);
        }
        for (const k of ['code', 'state', 'error', 'error_description']) { const v = url.searchParams.get(k); if (v) destino.searchParams.set(k, v.slice(0, 512)); }
        return new Response(null, { status: 302, headers: { location: destino.toString(), 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
      }

      if (req.method === 'POST' && url.pathname === '/ml/token') {
        const { code, code_verifier } = await corpo(req);
        if (typeof code !== 'string' || typeof code_verifier !== 'string' || code.length > 512 || !/^[A-Za-z0-9._~-]{43,128}$/.test(code_verifier)) return json({ error: 'parametros_invalidos' }, 400, h);
        return oauthToken(env, { grant_type: 'authorization_code', code, code_verifier, redirect_uri: redirectUri }, h);
      }

      if (req.method === 'POST' && url.pathname === '/ml/refresh') {
        const { refresh_token } = await corpo(req);
        if (typeof refresh_token !== 'string' || !refresh_token || refresh_token.length > 512) return json({ error: 'parametros_invalidos' }, 400, h);
        return oauthToken(env, { grant_type: 'refresh_token', refresh_token }, h);
      }

      if (req.method === 'GET' && url.pathname === '/')
        return new Response('Intermediário de login do Nexus (código aberto). Não guarda tokens nem dados.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      return json({ error: 'nao_encontrado' }, 404, h);
    } catch {
      return json({ error: 'requisicao_invalida' }, 400, h);
    }
  },
};
