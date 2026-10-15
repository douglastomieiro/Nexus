// Teste ponta a ponta do login (npm test): Mercado Livre SIMULADO + intermediário (broker/worker.js rodando no Node) + servidor do app.
// Nenhuma conta real é usada (só o apelido é buscado em /users/me com um token falso, que falha e é ignorado).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-teste-'));
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FALHA'} ${m}`); if (!c) process.exitCode = 1; };
const escuta = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

// ── ML simulado ──
let usuario = 987654321; const codes = new Map(); const refresh = new Map(); let nRefresh = 0;
const ml = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/authorization') { // o usuário clicou em "Autorizar"
    const code = 'TG-' + crypto.randomBytes(8).toString('hex');
    codes.set(code, { ch: u.searchParams.get('code_challenge'), cid: u.searchParams.get('client_id'), ru: u.searchParams.get('redirect_uri') });
    const d = new URL(u.searchParams.get('redirect_uri')); d.searchParams.set('code', code); d.searchParams.set('state', u.searchParams.get('state'));
    res.writeHead(302, { location: d.toString() }); return res.end();
  }
  if (u.pathname === '/oauth/token') {
    let b = ''; for await (const ch of req) b += ch; const p = new URLSearchParams(b);
    const out = d => { res.writeHead(d.error ? 400 : 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(d)); };
    if (p.get('client_secret') !== 'segredo-teste') return out({ error: 'invalid_client' });
    const novo = () => { const rt = 'TG-rt-' + crypto.randomBytes(8).toString('hex'); refresh.set(rt, true); return { access_token: 'APP_USR-' + crypto.randomBytes(8).toString('hex'), refresh_token: rt, expires_in: 21600, user_id: usuario }; };
    if (p.get('grant_type') === 'authorization_code') {
      const c = codes.get(p.get('code')); codes.delete(p.get('code'));
      if (!c || c.ru !== p.get('redirect_uri')) return out({ error: 'invalid_grant' });
      const ch = crypto.createHash('sha256').update(p.get('code_verifier') || '').digest('base64url');
      if (ch !== c.ch) return out({ error: 'invalid_grant', message: 'pkce' });
      return out(novo());
    }
    if (p.get('grant_type') === 'refresh_token') { nRefresh++; if (!refresh.delete(p.get('refresh_token'))) return out({ error: 'invalid_grant' }); return out(novo()); }
  }
  res.writeHead(404); res.end();
});
const pML = await escuta(ml);

// ── intermediário (o mesmo worker.js da Cloudflare) ──
const worker = (await import(pathToFileURL(path.join(PROJ, 'broker/worker.js')))).default;
const wenv = { ML_CLIENT_ID: '123', ML_CLIENT_SECRET: 'segredo-teste', ML_API: `http://127.0.0.1:${pML}`, ML_AUTH: `http://127.0.0.1:${pML}/authorization` };
const broker = http.createServer(async (req, res) => {
  let b = ''; for await (const ch of req) b += ch;
  const r = await worker.fetch(new Request(`http://127.0.0.1:${req.socket.localPort}${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'POST' ? b : undefined }), wenv);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
});
const pBR = await escuta(broker);

// ── servidor do app ──
const CHAVE = crypto.randomBytes(16).toString('hex'), PORTA = 4000 + Math.floor(Math.random() * 900);
const sobe = () => spawn(process.execPath, ['server/index.js'], { cwd: PROJ, env: { ...process.env, NEXUS_DATA: DADOS, NEXUS_CHAVE: CHAVE, NEXUS_BROKER: `http://127.0.0.1:${pBR}`, PORT: String(PORTA), SEM_COLETA: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let app = sobe(); let log = ''; app.stdout.on('data', d => (log += d)); app.stderr.on('data', d => (log += d));
for (let i = 0; i < 40 && !log.includes('NEXUS_ em'); i++) await new Promise(r => setTimeout(r, 250));
const A = `http://127.0.0.1:${PORTA}`, ck = { cookie: `nexus=${CHAVE}` };

const c0 = await fetch(A + '/api/contas', { headers: ck }).then(r => r.json());
ok(c0.broker === true && c0.contas.length === 0, 'app vê o intermediário e começa sem contas');
ok((await fetch(A + '/api/contas')).status === 403, 'API sem a chave do app → 403');

const { url } = await fetch(A + '/api/contas/ml/conectar', { method: 'POST', headers: ck }).then(r => r.json());
const au = new URL(url);
ok(au.searchParams.get('code_challenge_method') === 'S256' && au.searchParams.get('redirect_uri') === `http://127.0.0.1:${pBR}/ml/callback` && au.searchParams.get('state').startsWith(PORTA + '.'), 'link de autorização com PKCE, redirect fixo e porta no state');

// navegador: segue os redirecionamentos SEM o cookie do app (como o navegador do sistema)
let alvo = url, final, retorno;
for (let i = 0; i < 5; i++) { const r = await fetch(alvo, { redirect: 'manual' }); if (r.status === 302) { alvo = new URL(r.headers.get('location'), alvo).toString(); if (alvo.includes('/oauth/ml/retorno')) retorno = alvo; continue; } final = { status: r.status, html: await r.text() }; break; }
ok(final?.status === 200 && final.html.includes('Conta conectada!'), 'navegador: ML → intermediário → app mostra "Conta conectada!"');
ok(!final.html.includes('APP_USR') && !final.html.includes('TG-rt'), 'página de retorno não exibe tokens');

const replay = await fetch(retorno); ok(replay.status === 400, 'reusar o mesmo link de retorno → recusado (nonce de uso único)');
const forjado = await fetch(`${A}/oauth/ml/retorno?code=TG-x&state=${PORTA}.AAAAAAAAAAAAAAAAAAAAAAAA`); ok(forjado.status === 400, 'state forjado → recusado');

const c1 = await fetch(A + '/api/contas', { headers: ck }).then(r => r.json());
ok(c1.contas.length === 1 && c1.contas[0].user_id === '987654321' && c1.contas[0].n === 1 && c1.reiniciar === true, 'conta salva como loja1 e pede reinício');
const arq = path.join(DADOS, 'data/tokens/ml-987654321.bin');
ok(fs.existsSync(arq), 'tokens gravados na pasta de dados (fora do Electron ficam em texto — no app, cifrados)');
ok(!fs.readFileSync(path.join(DADOS, 'data/contas.json'), 'utf8').includes('APP_USR'), 'lista de contas sem tokens');

// mesma conta de novo → aviso "já estava conectada"; outra conta → loja2
const autoriza = async () => { const { url } = await fetch(A + '/api/contas/ml/conectar', { method: 'POST', headers: ck }).then(r => r.json()); let a = url; for (let i = 0; i < 5; i++) { const r = await fetch(a, { redirect: 'manual' }); if (r.status === 302) { a = new URL(r.headers.get('location'), a).toString(); continue; } return r.text(); } };
const h2 = await autoriza(); const c2 = await fetch(A + '/api/contas', { headers: ck }).then(r => r.json());
ok(h2.includes('já estava conectada') && c2.contas.length === 1 && c2.ultimo?.nova === false, 'mesma conta autorizada de novo → aviso "já estava conectada", sem duplicar');
usuario = 111222333;
const h3 = await autoriza(); const c3 = await fetch(A + '/api/contas', { headers: ck }).then(r => r.json());
ok(h3.includes('Conta conectada!') && c3.contas.length === 2 && c3.contas[1].n === 2 && c3.ultimo?.nova === true, 'outra conta (outro navegador) → vira loja2');
usuario = 987654321;
// reinicia o servidor: a conta vira loja1
app.kill(); await new Promise(r => setTimeout(r, 800));
app = sobe(); log = ''; app.stdout.on('data', d => (log += d)); app.stderr.on('data', d => (log += d));
for (let i = 0; i < 40 && !log.includes('NEXUS_ em'); i++) await new Promise(r => setTimeout(r, 250));
const lojas = await fetch(A + '/api/lojas', { headers: ck }).then(r => r.json());
ok(lojas.loja1 && lojas.loja2 && (await fetch(A + '/api/contas', { headers: ck }).then(r => r.json())).reiniciar === false, `depois do reinício a conta aparece nas lojas (${JSON.stringify(lojas)})`);
app.kill();

// renovação: token vencido + 3 pedidos ao mesmo tempo → UMA renovação (refresh de uso único)
const t = JSON.parse(fs.readFileSync(arq, 'utf8')); t.updated_at = 0; fs.writeFileSync(arq, JSON.stringify(t));
process.env.NEXUS_DATA = DADOS; process.env.NEXUS_BROKER = `http://127.0.0.1:${pBR}`;
const { tokenConta } = await import(pathToFileURL(path.join(PROJ, 'server/contas.js')));
const r3 = await Promise.all([tokenConta('987654321'), tokenConta('987654321'), tokenConta('987654321')]);
ok(nRefresh === 1 && new Set(r3).size === 1 && r3[0] !== t.access_token, 'token vencido: 3 pedidos simultâneos → 1 renovação só');
const t2 = JSON.parse(fs.readFileSync(arq, 'utf8')); ok(t2.refresh_token !== t.refresh_token, 'refresh_token novo gravado');

// intermediário: entradas inválidas
const inval = await fetch(`http://127.0.0.1:${pBR}/ml/callback?code=x&state=../evil`, { redirect: 'manual' });
ok(inval.status === 400, 'intermediário recusa state inválido (não redireciona para fora)');

ml.close(); broker.close(); fs.rmSync(DADOS, { recursive: true, force: true });
