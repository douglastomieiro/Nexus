// Do jeito de cada operação: módulos ligados (o que fica desligado some do menu, do Resumo, do sino e da coleta),
// "Minhas regras" (margem mínima, cobertura, ACOS, prazo de resposta, limites de reputação) usadas por todas as telas,
// e perfis de uso com senha (dono, atendimento, expedição…): cada perfil vê só os seus módulos e só age onde pode.
// Tudo fica na tabela config (entra no backup). Sem perfis ligados, o sistema abre direto como sempre.
// Esqueceu a senha do dono: iniciar o servidor com SEM_LOGIN=1 no ambiente abre sem pedir senha.
import { db } from './db.js';
import { shopeeConfigurada } from './shopee.js';

db.exec(`CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS sessoes (token TEXT PRIMARY KEY, perfil TEXT NOT NULL, criado INTEGER NOT NULL)`);

const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const ler = k => { try { return JSON.parse(db.prepare('SELECT valor FROM config WHERE chave=?').get(k)?.valor ?? 'null'); } catch { return null; } };
const grava = (k, v) => db.prepare('INSERT INTO config (chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor').run(k, JSON.stringify(v));

// ───────── módulos ─────────
export const MODULOS = [
  { id: 'atendimento', nome: 'Atendimento', txt: 'Perguntas, mensagens, reclamações e devoluções' },
  { id: 'vendas', nome: 'Vendas e envios', txt: 'Lista de despacho, etiquetas, NF-e, painel ao vivo' },
  { id: 'anuncios', nome: 'Gestão de anúncios', txt: 'Preço, estoque, fotos, ficha técnica, catálogo e Full' },
  { id: 'ads', nome: 'Publicidade (Ads)', txt: 'Campanhas e anúncios patrocinados' },
  { id: 'promocoes', nome: 'Promoções e descontos', txt: 'Promoções do ML e a tela de Descontos' },
  { id: 'financas', nome: 'Finanças', txt: 'DRE e indicadores' },
  { id: 'metrics', nome: 'Nexus Metrics', txt: 'Buscas, mais vendidos, concorrência e projeções' },
  { id: 'shopee', nome: 'Shopee', txt: 'Contas Shopee: pedidos, anúncios, Ads e avisos', so: () => shopeeConfigurada() },
];
export const modulos = () => { const m = ler('central_modulos') || {}; return Object.fromEntries(MODULOS.map(x => [x.id, m[x.id] !== false])); };
export const ligado = id => modulos()[id] !== false;

// ───────── minhas regras ─────────
const REGRAS = { margemMin: 15, coberturaDias: 30, estoqueMinDias: 7, acosMax: 0, qualidadeMin: 60, respostaMin: 60,
  reputacao: { reclamacoes: [2, 1], atrasos: [10, 6], cancelamentos: [1.5, 0.5] } }; // % de vendas em 60 dias: [verde, MercadoLíder]
export const regras = () => { const r = ler('central_regras') || {}; return { ...REGRAS, ...r, reputacao: { ...REGRAS.reputacao, ...(r.reputacao || {}) } }; };
function salvaRegras(b) {
  const n = (v, min, max) => { const x = Number(String(v ?? '').replace(',', '.')); if (!(x >= min && x <= max)) throw erro('Algum valor está fora do permitido.'); return x; };
  const rp = b.reputacao || {}, par = (k, a) => [n(a?.[0] ?? REGRAS.reputacao[k][0], 0, 100), n(a?.[1] ?? REGRAS.reputacao[k][1], 0, 100)];
  const r = { margemMin: n(b.margemMin, 0, 80), coberturaDias: Math.round(n(b.coberturaDias, 1, 365)), estoqueMinDias: Math.round(n(b.estoqueMinDias, 0, 90)), acosMax: n(b.acosMax ?? 0, 0, 100),
    qualidadeMin: Math.round(n(b.qualidadeMin, 0, 100)), respostaMin: Math.round(n(b.respostaMin, 5, 1440)),
    reputacao: { reclamacoes: par('reclamacoes', rp.reclamacoes), atrasos: par('atrasos', rp.atrasos), cancelamentos: par('cancelamentos', rp.cancelamentos) } };
  grava('central_regras', r); return r;
}

// ───────── perfis e sessão ─────────
// na versão site o servidor roda dentro do navegador (sem cookie nem middleware): lá não há perfis
const NO_NAVEGADOR = !globalThis.process?.versions?.node;
const perfis = () => { const p = ler('central_perfis'); return { ativo: !NO_NAVEGADOR && !!p?.ativo, lista: Array.isArray(p?.lista) ? p.lista : [] }; };
const semLogin = () => !!process.env.SEM_LOGIN;
const hex = a => [...new Uint8Array(a)].map(b => b.toString(16).padStart(2, '0')).join('');
const aleatorio = n => hex(globalThis.crypto.getRandomValues(new Uint8Array(n)));
async function hash(senha, sal) {
  const c = globalThis.crypto.subtle, k = await c.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  return hex(await c.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(sal), iterations: 120000 }, k, 256));
}
const cookie = req => (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('central_sessao='))?.slice(15) || '';
function perfilDe(req) {
  const t = cookie(req); if (!t) return null;
  const s = db.prepare('SELECT perfil, criado FROM sessoes WHERE token=?').get(t); if (!s || Date.now() - s.criado > 60 * 864e5) return null;
  return perfis().lista.find(p => p.id === s.perfil) || null;
}
const publico = p => p && { id: p.id, nome: p.nome, dono: !!p.dono, modulos: p.dono ? null : p.modulos || null, acoes: !!(p.dono || p.acoes) };
// rotas de cada módulo (para o perfil): fora daqui, só o dono muda alguma coisa
const ROTA = [['/api/at/', 'atendimento'], ['/api/vendas/', 'vendas'], ['/api/aovivo', 'vendas'], ['/api/anuncios/', 'anuncios'], ['/api/pub/', 'ads'],
  ['/api/descontos', 'promocoes'], ['/api/shopee', 'shopee']];
const moduloDa = p => ROTA.find(([r]) => p.startsWith(r))?.[1] || null;
const LIVRE = new Set(['/api/login', '/api/logout', '/api/prefs', '/api/lojas']);

// vai antes de todas as rotas: com perfis ligados, a API pede sessão; o perfil limita módulos e ações
export function guarda(req, res, next) {
  if (!req.path.startsWith('/api/') || semLogin() || !perfis().ativo) return next();
  if (LIVRE.has(req.path)) return next();
  const p = perfilDe(req); if (!p) return res.status(401).json({ erro: 'Entre com o seu perfil para continuar.', login: true });
  req.perfil = p; if (p.dono) return next();
  const m = moduloDa(req.path);
  if (m && (p.modulos && !p.modulos.includes(m) || !ligado(m))) return res.status(403).json({ erro: 'Este perfil não tem acesso a esta parte do sistema.' });
  if (req.method !== 'GET' && !(m && p.acoes)) return res.status(403).json({ erro: 'Este perfil não pode fazer esta alteração. Peça ao dono.' });
  next();
}
const soDono = req => { if (perfis().ativo && !semLogin() && !req.perfil?.dono) throw erro('Só o perfil dono muda esta configuração.', 403); };

async function salvaPerfis(b, req) {
  const atual = perfis(), lista = [];
  for (const x of (b.lista || []).slice(0, 20)) {
    const nome = String(x.nome || '').trim().slice(0, 40); if (!nome) throw erro('Todo perfil precisa de nome.');
    const ant = atual.lista.find(p => p.id === x.id), id = ant?.id || aleatorio(6);
    const p = { id, nome, dono: !!x.dono, acoes: !!x.acoes, modulos: x.dono ? null : (x.modulos || []).filter(m => MODULOS.some(d => d.id === m)), sal: ant?.sal, hash: ant?.hash };
    if (x.senha) { if (String(x.senha).length < 4) throw erro(`A senha de ${nome} precisa de pelo menos 4 caracteres.`); p.sal = aleatorio(16); p.hash = await hash(String(x.senha), p.sal); }
    if (!p.hash) throw erro(`Defina a senha de ${nome}.`);
    lista.push(p);
  }
  const ativo = !!b.ativo;
  if (ativo && !lista.some(p => p.dono)) throw erro('Para ligar os perfis, tenha pelo menos um perfil dono com senha.');
  if (new Set(lista.map(p => p.nome.toLowerCase())).size < lista.length) throw erro('Dois perfis com o mesmo nome.');
  grava('central_perfis', { ativo, lista });
  db.prepare(`DELETE FROM sessoes WHERE perfil NOT IN (${lista.map(() => '?').join(',') || "''"})`).run(...lista.map(p => p.id));
  // quem ligou os perfis agora já fica dentro como dono
  if (ativo && !atual.ativo && !perfilDe(req)) return { novaSessao: lista.find(p => p.dono).id };
  return {};
}
const novaSessao = (res, perfil) => { const t = aleatorio(24); db.prepare('INSERT INTO sessoes (token, perfil, criado) VALUES (?,?,?)').run(t, perfil, Date.now());
  res.setHeader('Set-Cookie', `central_sessao=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 86400}`); };

export function registrarPreferencias(app) {
  const J = fn => async (req, res) => { try { res.json(await fn(req, res)); } catch (e) { if (!e.status) console.error(e); res.status(e.status || 500).json({ erro: e.message }); } };
  app.get('/api/prefs', J(req => { const P = perfis(), eu = P.ativo && !semLogin() ? perfilDe(req) : null;
    return { modulos: modulos(), defs: MODULOS.filter(m => !m.so || m.so()).map(({ id, nome, txt }) => ({ id, nome, txt })), regras: regras(),
      perfis: { ativo: P.ativo && !semLogin(), precisaLogin: P.ativo && !semLogin() && !eu, eu: publico(eu), opcoes: P.ativo ? P.lista.map(p => ({ id: p.id, nome: p.nome })) : [],
        lista: (!P.ativo || semLogin() || eu?.dono) ? P.lista.map(p => ({ ...publico(p), temSenha: !!p.hash })) : [], possivel: !NO_NAVEGADOR }, semLogin: semLogin() }; }));
  app.post('/api/prefs/modulos', J(req => { soDono(req); const b = req.body || {}; grava('central_modulos', Object.fromEntries(MODULOS.map(m => [m.id, b[m.id] !== false]))); return modulos(); }));
  app.post('/api/prefs/regras', J(req => { soDono(req); return salvaRegras(req.body || {}); }));
  app.post('/api/prefs/perfis', J(async (req, res) => { soDono(req); const r = await salvaPerfis(req.body || {}, req); if (r.novaSessao) novaSessao(res, r.novaSessao); return { ok: true }; }));
  app.post('/api/login', J(async (req, res) => {
    const p = perfis().lista.find(x => x.id === String(req.body?.perfil || '')); await new Promise(r => setTimeout(r, 400)); // freia tentativa em sequência
    if (!p || !p.hash || await hash(String(req.body?.senha || ''), p.sal) !== p.hash) throw erro('Perfil ou senha não conferem.', 401);
    novaSessao(res, p.id); return { ok: true, perfil: publico(p) };
  }));
  app.post('/api/logout', J((req, res) => { const t = cookie(req); if (t) db.prepare('DELETE FROM sessoes WHERE token=?').run(t); res.setHeader('Set-Cookie', 'central_sessao=; Path=/; Max-Age=0'); return { ok: true }; }));
}
