// Intermediário de login do ML Dashboard (Cloudflare Worker). Código aberto; NÃO guarda nada (sem banco, sem log de tokens).
//
// Por que existe: o Mercado Livre exige a senha do aplicativo (client_secret) para trocar o código de autorização por tokens
// e para renová-los. Essa senha não pode ir dentro do app instalado (qualquer um a extrairia), então fica só aqui.
//
// Rotas:
//   GET  /ml/config    → { client_id, auth_url, redirect_uri }  (dados públicos para o app montar o link de autorização)
//   GET  /ml/callback  → o ML volta aqui depois do "Autorizar"; repassa code+state ao app no PC (http://127.0.0.1:<porta>)
//   POST /ml/token     → { code, code_verifier } → tokens  (o código sozinho não vale nada sem o code_verifier, que só o app tem: PKCE)
//   POST /ml/refresh   → { refresh_token } → tokens novos
//
// Configuração (wrangler.toml / painel da Cloudflare): ML_CLIENT_ID (variável), ML_CLIENT_SECRET (secret).
// ML_API e ML_AUTH só mudam em teste.

const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const ESTADO = /^(\d{2,5})\.([A-Za-z0-9_-]{16,128})$/; // state = "<porta do app>.<nonce>"

async function oauthToken(env, campos) {
  const r = await fetch(`${env.ML_API || 'https://api.mercadolibre.com'}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ client_id: env.ML_CLIENT_ID, client_secret: env.ML_CLIENT_SECRET, ...campos }).toString(),
  });
  const d = await r.json().catch(() => ({ error: 'resposta_invalida' }));
  return json(d, r.status);
}

async function corpo(req, limite = 4096) {
  const t = await req.text();
  if (t.length > limite) throw new Error('corpo grande demais');
  return JSON.parse(t || '{}');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), redirectUri = `${url.origin}/ml/callback`;
    if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET) return json({ error: 'intermediario_nao_configurado' }, 500);
    try {
      if (req.method === 'GET' && url.pathname === '/ml/config')
        return json({ client_id: env.ML_CLIENT_ID, auth_url: env.ML_AUTH || 'https://auth.mercadolivre.com.br/authorization', redirect_uri: redirectUri });

      if (req.method === 'GET' && url.pathname === '/ml/callback') {
        const m = ESTADO.exec(url.searchParams.get('state') || '');
        const porta = m && Number(m[1]);
        if (!m || porta < 1024 || porta > 65535) return new Response('Link de retorno inválido. Volte ao app e tente conectar de novo.', { status: 400 });
        // Só repassa ao PRÓPRIO computador de quem autorizou (127.0.0.1); o app confere o nonce do state.
        const destino = new URL(`http://127.0.0.1:${porta}/oauth/ml/retorno`);
        for (const k of ['code', 'state', 'error', 'error_description']) { const v = url.searchParams.get(k); if (v) destino.searchParams.set(k, v.slice(0, 512)); }
        return new Response(null, { status: 302, headers: { location: destino.toString(), 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
      }

      if (req.method === 'POST' && url.pathname === '/ml/token') {
        const { code, code_verifier } = await corpo(req);
        if (typeof code !== 'string' || typeof code_verifier !== 'string' || code.length > 512 || !/^[A-Za-z0-9._~-]{43,128}$/.test(code_verifier)) return json({ error: 'parametros_invalidos' }, 400);
        return oauthToken(env, { grant_type: 'authorization_code', code, code_verifier, redirect_uri: redirectUri });
      }

      if (req.method === 'POST' && url.pathname === '/ml/refresh') {
        const { refresh_token } = await corpo(req);
        if (typeof refresh_token !== 'string' || !refresh_token || refresh_token.length > 512) return json({ error: 'parametros_invalidos' }, 400);
        return oauthToken(env, { grant_type: 'refresh_token', refresh_token });
      }

      if (req.method === 'GET' && url.pathname === '/')
        return new Response('Intermediário de login do ML Dashboard (código aberto). Não guarda tokens nem dados.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      return json({ error: 'nao_encontrado' }, 404);
    } catch {
      return json({ error: 'requisicao_invalida' }, 400);
    }
  },
};
