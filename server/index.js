// API do dashboard: lê o SQLite (resposta crua do ML) e serve JSON + a pasta web/.
import express from 'express';
import { db } from './db.js';
import { LOJAS, mlGet, ROOT, env } from './ml.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { LIVE } from './collectors.js';
import { saveRaw, getRaw } from './db.js';
import { agendar } from './sync.js';
import { promocoesComMargem, gerarAlertas } from './analises.js';
import { registrar as registrarPainel } from './painel.js';
import { registrar as registrarMetrics } from './metrics.js';
import { registrarFixos, fixosPorMes } from './custos-fixos.js';
import { registrarDescontos } from './descontos/rotas.js';
import { registrarShopee, alertasShopee } from './shopee-rotas.js';
import { registrarContas } from './contas-rotas.js';
import { calcularShopee } from './shopee-margem.js';
import { SHOPEE } from './shopee.js';
import { calcular, listarSkus, getCustos, getCustosHist, setCusto, getConfig, setConfig, aliquotaAuto, faturasML } from './margem.js';

const app = express();
// PORT=0 → porta livre sorteada pelo sistema (o app desktop usa assim). Sem PORT: 4000.
const PORT = process.env.PORT != null && process.env.PORT !== '' ? Number(process.env.PORT) : 4000;
// Só a própria máquina acessa (sem autenticação: nunca expor). Para rede privada (ex.: Tailscale), HOST=<IP dessa interface> no ambiente ou no .env.
const HOST = process.env.HOST || env.HOST || '127.0.0.1';

// App desktop: ML_DASH_CHAVE (gerada a cada abertura) só a janela do app conhece, num cookie SameSite=Strict.
// Sem a chave → 403: outros programas do PC e sites abertos no navegador não conseguem usar a API.
// O Host precisa ser 127.0.0.1:<porta> (bloqueia DNS rebinding).
const CHAVE = process.env.ML_DASH_CHAVE;
if (CHAVE) app.use((req, res, next) => {
  const ck = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('mldash='))?.slice(7) || '';
  const hostOk = req.headers.host === `127.0.0.1:${req.socket.localPort}`;
  // Exceção: o retorno do login vem do navegador do sistema (sem o cookie); ele se valida pelo nonce de uso único (server/contas.js).
  if (hostOk && req.method === 'GET' && req.path === '/oauth/ml/retorno') return next();
  const ok = hostOk && ck.length === CHAVE.length && crypto.timingSafeEqual(Buffer.from(ck), Buffer.from(CHAVE));
  if (!ok) return res.status(403).send('Acesso negado');
  next();
});
const nomes = Object.fromEntries(Object.entries(LOJAS).map(([k, v]) => [k, v.nome]));

// loja=all|loja1|loja2|...  → fragmento SQL seguro (whitelist: só chaves geradas em ml.js)
const lojaSql = (q, col = 'loja') => {
  const l = q.loja;
  return nomes[l] ? `${col} = '${l}'` : `${col} IN (${Object.keys(nomes).map(k => `'${k}'`).join(',') || "''"})`;
};
const dias = q => Math.min(Math.max(parseInt(q.dias) || 30, 1), 400);
// "últimos N dias" = hoje + os N−1 dias anteriores (dia de Brasília). Antes eram N+1 dias.
const desde = q => new Date(Date.now() - 3 * 3600e3 - (dias(q) - 1) * 864e5).toISOString().slice(0, 10);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const OK = `status=200`;
const D = `date(json_extract(body,'$.date_created'),'-3 hours')`;
const H = (fn) => (req, res) => { try { res.json(fn(req.query, req)); } catch (e) { if (!e.status) console.error(e); res.status(e.status || 500).json({ erro: e.message }); } };

app.get('/api/lojas', H(() => nomes));

app.get('/api/resumo', H(q => {
  // uma única passada pelos pedidos da janela (antes eram 4 varreduras de JSON no SQL)
  const ini = desde(q);
  const diario = {}, top = {}, pag = {};
  const tot = { pedidos: 0, faturamento: 0, unidades: 0, tarifas: 0 };
  let cancelados = 0;
  const it = db.prepare(`SELECT loja, body FROM raw WHERE recurso='order' AND ${OK} AND ${lojaSql(q)} AND ${D} >= ?`).iterate(ini);
  for (const r of it) {
    const o = JSON.parse(r.body);
    if (o.status === 'cancelled') { cancelados++; continue; }
    tot.pedidos++; tot.faturamento += o.total_amount || 0;
    const dia = new Date(Date.parse(o.date_created) - 3 * 3600e3).toISOString().slice(0, 10);
    const d = diario[dia + '|' + r.loja] ||= { dia, loja: r.loja, pedidos: 0, valor: 0 };
    d.pedidos++; d.valor += o.total_amount || 0;
    for (const x of o.order_items || []) {
      tot.unidades += x.quantity; tot.tarifas += (x.sale_fee || 0) * x.quantity;
      const t = top[x.item.id] ||= { id: x.item.id, titulo: x.item.title, unidades: 0, valor: 0 };
      t.unidades += x.quantity; t.valor += x.quantity * x.unit_price;
    }
    for (const p of o.payments || []) { const k = p.payment_type || 'outro'; const g = pag[k] ||= { tipo: k, n: 0, valor: 0 }; g.n++; g.valor += p.transaction_amount || 0; }
  }
  return { desde: ini, ...tot, cancelados, diario: Object.values(diario).sort((a, b) => a.dia.localeCompare(b.dia)),
    top: Object.values(top).sort((a, b) => b.valor - a.valor).slice(0, 15), pagamento: Object.values(pag).sort((a, b) => b.valor - a.valor) };
}));

app.get('/api/pedidos', H(q => {
  const lim = Math.min(parseInt(q.limit) || 50, 500), off = parseInt(q.offset) || 0;
  const busca = q.q ? `AND (body LIKE ?)` : '';
  const args = [desde(q), ...(q.q ? [`%${q.q}%`] : []), lim, off];
  const status = q.status ? `AND json_extract(body,'$.status')='${String(q.status).replace(/\W/g, '')}'` : '';
  return all(`SELECT loja, chave id, json_extract(body,'$.date_created') data, json_extract(body,'$.status') status, json_extract(body,'$.total_amount') total,
      json_extract(body,'$.buyer.nickname') comprador, json_extract(body,'$.shipping.id') envio, json_extract(body,'$.pack_id') pack,
      (SELECT group_concat(json_extract(j.value,'$.item.title') || ' x' || json_extract(j.value,'$.quantity'), ' | ') FROM json_each(body,'$.order_items') j) itens,
      json_extract(body,'$.tags') tags
    FROM raw WHERE recurso='order' AND ${OK} AND ${lojaSql(q)} AND ${D} >= ? ${busca} ${status} ORDER BY data DESC LIMIT ? OFFSET ?`, ...args);
}));

app.get('/api/itens', H(q => all(`
  SELECT i.loja, i.chave id, json_extract(i.body,'$.title') titulo, json_extract(i.body,'$.status') status, json_extract(i.body,'$.price') preco,
    json_extract(i.body,'$.available_quantity') estoque, json_extract(i.body,'$.sold_quantity') vendidos, json_extract(i.body,'$.listing_type_id') tipo,
    json_extract(i.body,'$.shipping.logistic_type') logistica, json_extract(i.body,'$.health') saude, json_extract(i.body,'$.catalog_listing') catalogo,
    json_extract(v.body,'$.total_visits') visitas90, json_extract(i.body,'$.permalink') link, json_extract(i.body,'$.thumbnail') img,
    json_extract(i.body,'$.category_id') categoria, json_extract(i.body,'$.date_created') criado,
    json_extract(s.body,'$.sale_price.amount') preco_venda, COALESCE(v90.q,0) vendidos90, COALESCE(v90.p,0) pedidos90
  FROM raw i LEFT JOIN raw v ON v.loja=i.loja AND v.recurso='item_visits' AND v.chave=i.chave AND v.status=200
             LEFT JOIN raw s ON s.loja=i.loja AND s.recurso='item_sale_price' AND s.chave=i.chave AND s.status=200
             LEFT JOIN (SELECT loja, json_extract(j.value,'$.item.id') item, SUM(json_extract(j.value,'$.quantity')) q, COUNT(*) p FROM raw, json_each(body,'$.order_items') j
                        WHERE recurso='order' AND status=200 AND json_extract(body,'$.status')!='cancelled' AND date(json_extract(body,'$.date_created'),'-3 hours') >= date('now','-3 hours','-90 day') GROUP BY loja, item) v90 ON v90.loja=i.loja AND v90.item=i.chave
  WHERE i.recurso='item' AND i.status=200 AND ${lojaSql(q, 'i.loja')} ORDER BY vendidos DESC`)));

app.get('/api/atendimento', H(q => ({
  perguntas: all(`SELECT json_extract(body,'$.status') status, COUNT(*) n FROM raw WHERE recurso='question' AND ${OK} AND ${lojaSql(q)} GROUP BY status`),
  perguntasRecentes: all(`SELECT loja, json_extract(body,'$.date_created') data, json_extract(body,'$.status') status, json_extract(body,'$.text') texto, json_extract(body,'$.item_id') item,
      json_extract(body,'$.answer.text') resposta FROM raw WHERE recurso='question' AND ${OK} AND ${lojaSql(q)} ORDER BY data DESC LIMIT 100`),
  reclamacoes: all(`SELECT json_extract(body,'$.status') status, json_extract(body,'$.stage') etapa, json_extract(body,'$.type') tipo, COUNT(*) n
      FROM raw WHERE recurso='claim' AND ${OK} AND ${lojaSql(q)} GROUP BY status, etapa, tipo ORDER BY n DESC`),
  reclamacoesLista: all(`SELECT loja, chave id, json_extract(body,'$.date_created') data, json_extract(body,'$.status') status, json_extract(body,'$.stage') etapa,
      json_extract(body,'$.type') tipo, json_extract(body,'$.reason_id') motivo, json_extract(body,'$.resource_id') pedido
      FROM raw WHERE recurso='claim' AND ${OK} AND ${lojaSql(q)} ORDER BY data DESC LIMIT 100`),
  naoLidas: all(`SELECT loja, body FROM raw WHERE recurso='messages_unread' AND ${OK} AND ${lojaSql(q)}`).map(r => ({ loja: r.loja, ...JSON.parse(r.body) })),
})));

app.get('/api/reputacao', H(q => all(`SELECT loja, body FROM raw WHERE recurso='user' AND ${OK} AND ${lojaSql(q)}`).map(r => {
  const u = JSON.parse(r.body);
  return { loja: r.loja, nome: nomes[r.loja], nickname: u.nickname, nivel: u.seller_reputation, status: u.status, tags: u.tags, pontos: u.points, criado: u.registration_date };
})));

app.get('/api/envios', H(q => ({
  status: all(`SELECT json_extract(body,'$.status') status, json_extract(body,'$.logistic_type') logistica, COUNT(*) n
    FROM raw WHERE recurso='shipment' AND ${OK} AND ${lojaSql(q)} GROUP BY status, logistica ORDER BY n DESC`),
  custos: all(`SELECT loja, COUNT(*) n, SUM(json_extract(body,'$.senders[0].cost')) custo_vendedor, SUM(json_extract(body,'$.gross_amount')) bruto
    FROM raw WHERE recurso='shipment_costs' AND ${OK} AND ${lojaSql(q)} GROUP BY loja`),
})));

app.get('/api/promocoes', H(q => {
  const lista = all(`SELECT loja, body FROM raw WHERE recurso='promotions_list' AND ${OK} AND ${lojaSql(q)}`).flatMap(r => (JSON.parse(r.body).results || []).map(p => ({ loja: r.loja, ...p })));
  const detalhe = Object.fromEntries(all(`SELECT loja, chave, body FROM raw WHERE recurso='promotion' AND ${OK} AND ${lojaSql(q)}`).map(r => [r.loja + ':' + r.chave, JSON.parse(r.body)]));
  const cont = {};
  for (const r of all(`SELECT loja, chave, body FROM raw WHERE recurso='promotion_items' AND ${OK} AND ${lojaSql(q)}`)) {
    const id = r.chave.slice(0, r.chave.lastIndexOf(':')), c = cont[r.loja + ':' + id] ||= {};
    for (const it of JSON.parse(r.body).results || []) c[it.status] = (c[it.status] || 0) + 1;
  }
  return { lista: lista.map(p => ({ ...p, ...(detalhe[p.loja + ':' + p.id] || {}), itens: cont[p.loja + ':' + p.id] || {} })) };
}));

app.get('/api/promocoes-margem', H(q => promocoesComMargem(lojasSel(q))));
app.get('/api/alertas', H(q => { const ml = gerarAlertas(lojasSel(q), nomes), o = { alta: 0, media: 1, info: 2 }; return [...ml, ...alertasShopee(lojasSel(q))].sort((a, b) => o[a.nivel] - o[b.nivel]); }));
app.get('/api/cobertura', H(q => ({
  recursos: all(`SELECT recurso, SUM(status=200) ok, SUM(status!=200) falhas, COUNT(*) total, MAX(coletado_em) ultima FROM raw WHERE ${lojaSql(q)} GROUP BY recurso ORDER BY total DESC`),
  coletas: all(`SELECT * FROM coleta_log ORDER BY id DESC LIMIT 30`),
})));

// Explorador de dados crus
app.get('/api/raw/lista', H(q => all(`SELECT loja, chave, status, url, coletado_em, length(body) bytes FROM raw
  WHERE recurso=? AND ${lojaSql(q)} ${q.q ? 'AND (chave LIKE ? OR body LIKE ?)' : ''} ORDER BY coletado_em DESC LIMIT 200`, ...[q.recurso, ...(q.q ? [`%${q.q}%`, `%${q.q}%`] : [])])));
app.get('/api/raw/doc', H(q => {
  const r = all('SELECT loja, recurso, chave, url, status, body, coletado_em FROM raw WHERE loja=? AND recurso=? AND chave=?', q.loja, q.recurso, q.chave)[0];
  if (!r) throw Object.assign(new Error('não encontrado'), { status: 404 });
  return { ...r, body: JSON.parse(r.body) };
}));

// ── Lucro real, custos e configuração ──
app.use(express.json());
const lojasSel = q => (nomes[q.loja] ? [q.loja] : Object.keys(nomes));
registrarPainel(app, { H, nomes, lojasSel, dias });
registrarMetrics(app, { H, lojasSel, dias }); // Nexus Metrics › Meu negócio
app.get('/api/lucro', H(q => { const { porItem, ...r } = calcular({ lojas: lojasSel(q), desde: desde(q) }); return { ...r, devolucoes: r.devolucoes.slice(0, 2000) }; }));
app.get('/api/devolucoes', H(q => {
  const r = calcular({ lojas: lojasSel(q), desde: desde(q) });
  const motivos = Object.fromEntries(all(`SELECT chave, body FROM raw WHERE recurso='claim_reason' AND ${OK}`).map(x => [x.chave, JSON.parse(x.body)]));
  const porTipo = {}, porSku = {}, porMotivo = {};
  for (const d of r.devolucoes) {
    const t = porTipo[d.tipo] ||= { tipo: d.tipo, n: 0, reembolsado: 0, perda: 0 }; t.n++; t.reembolsado += d.reembolsado; t.perda += d.perda;
    for (const it of d.itensDet) { const s = porSku[it.sku] ||= { sku: it.sku, titulo: it.titulo, loja: d.loja, devolucoes: 0, unidades: 0, valor: 0 }; s.devolucoes++; s.unidades += it.qtd; s.valor += it.valor; }
    for (const mo of d.motivos.length ? d.motivos : ['(sem reclamação)']) { const g = porMotivo[mo] ||= { motivo: mo, nome: motivos[mo]?.detail || motivos[mo]?.name || mo, n: 0, reembolsado: 0 }; g.n++; g.reembolsado += d.reembolsado / Math.max(d.motivos.length, 1); }
  }
  for (const s of Object.values(porSku)) { const v = r.skus.find(x => x.sku === s.sku); s.vendas = v ? v.unidades : 0; s.pedidosVendas = v ? v.unidades : 0; s.taxa = v && v.unidades ? s.unidades / (v.unidades + s.unidades) : null; }
  return { desde: r.desde, total: r.total, pedidos: r.total.pedidos, lista: r.devolucoes.slice(0, 500), porTipo: Object.values(porTipo), porMotivo: Object.values(porMotivo).sort((a, b) => b.n - a.n),
    porSku: Object.values(porSku).sort((a, b) => b.valor - a.valor).slice(0, 40), porMes: r.porMes.map(m => ({ mes: m.mes, loja: m.loja, devolvido: m.devolvido, perda: m.perdaDevolucao, receita: m.receita })) };
}));
app.get('/api/custos', H(q => { // SKUs do ML + SKUs que só vendem na Shopee (o custo é um só por SKU, vale para os dois canais)
  const ml = listarSkus(lojasSel(q), desde({ dias: q.dias || 90 })), vistos = new Map(ml.map(s => [s.sku, s]));
  for (const s of calcularShopee({ lojas: Object.keys(SHOPEE), desde: desde({ dias: q.dias || 90 }) }).skus) {
    const ex = vistos.get(s.sku);
    if (ex) { ex.lojas = [...new Set([...ex.lojas, ...s.lojas])]; ex.unidades += s.unidades; ex.receita += s.receita; }
    else { const n = { sku: s.sku, titulo: s.titulo, item: s.item, lojas: s.lojas, unidades: s.unidades, receita: s.receita, preco: s.unidades ? s.receita / s.unidades : 0, anuncios: s.anuncios, custo: s.custoUnit }; ml.push(n); vistos.set(s.sku, n); }
  }
  // hist = vigência do custo ([[desde, custo], ...]; '0000-00-00' = vale para todo o passado), só quando o custo já mudou
  const hist = getCustosHist(); for (const s of ml) if (hist[s.sku]?.length > 1) s.hist = hist[s.sku];
  return ml.sort((a, b) => b.receita - a.receita);
}));
app.get('/api/custos/vigencia', H(() => ({ ok: true }))); // a tela confere se este servidor já aceita "desde"
// desde (opcional): dia em que o custo passa a valer; sem ele, vale a partir de hoje (o 1º custo do SKU vale para todo o passado)
app.post('/api/custos', H((_, req) => { for (const { sku, custo, desde } of [].concat(req.body)) if (sku) setCusto(String(sku), custo, desde); return { ok: true }; }));
// dia (AAAA-MM-DD, Brasília) do pedido mais antigo das contas: o DRE oferece os meses a partir dele e avisa se o 1º mês começa no meio (guardado por 10 min)
const primeiroDiaCache = new Map();
function primeiroDia(lojas) {
  const k = lojas.join(','), c = primeiroDiaCache.get(k); if (c && Date.now() - c.t < 600e3) return c.v;
  const v = db.prepare(`SELECT min(date(json_extract(body,'$.date_created'),'-3 hours')) d FROM raw WHERE recurso='order' AND status=200 AND loja IN (${lojas.map(() => '?').join(',')})`).get(...lojas)?.d || null;
  primeiroDiaCache.set(k, { t: Date.now(), v }); return v;
}
// 1º dia da série diária de Ads da conta (janela de 90 dias + ads_daily_hist), o mais tardio entre as contas que têm Ads:
// o DRE usa o Ads da API nos meses inteiros a partir dele (antes, o da fatura)
function adsDesde(lojas) {
  const ph = lojas.map(() => '?').join(','), ini = {};
  for (const r of all(`SELECT loja, min(substr(json_extract(j.value,'$.date'),1,10)) d FROM raw, json_each(body,'$.results') j WHERE recurso='ads_daily' AND status=200 AND loja IN (${ph}) GROUP BY loja`, ...lojas)) ini[r.loja] = r.d;
  for (const r of all(`SELECT loja, min(j.key) d FROM raw, json_each(body) j WHERE recurso='ads_daily_hist' AND status=200 AND loja IN (${ph}) GROUP BY loja`, ...lojas)) if (r.d && !(ini[r.loja] <= r.d)) ini[r.loja] = r.d;
  return Object.values(ini).filter(Boolean).sort().at(-1) || null;
}
// período: de/ate (AAAA-MM, até 60 meses) ou os últimos `meses` (padrão 12)
app.get('/api/dre', H(q => {
  const mesBR = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7), ehMes = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
  const soma = (m, n) => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  let ate = ehMes(q.ate) && q.ate < mesBR ? q.ate : mesBR, de = ehMes(q.de) ? q.de : soma(mesBR, -(Math.min(Math.max(parseInt(q.meses) || 12, 1), 60) - 1));
  if (de > ate) [de, ate] = [ate, de];
  if (soma(de, 59) < ate) de = soma(ate, -59);
  const lista = []; for (let m = de; m <= ate; m = soma(m, 1)) lista.push(m);
  const r = calcular({ lojas: lojasSel(q), desde: de + '-01', ate: ate + '-31' });
  const faturas = faturasML(lojasSel(q)).filter(f => (f.grupo === 'ML' || f.grupo === 'MP') && f.mes >= de && f.mes <= ate);
  // custos fixos de cada mês da janela (os de "todas as contas" só entram quando o filtro é todas as contas)
  const fixos = fixosPorMes(lista, lojasSel(q), !nomes[q.loja]);
  const dia1 = primeiroDia(lojasSel(q));
  return { desde: r.desde, de, ate, primeiroMes: dia1?.slice(0, 7) || null, primeiroDia: dia1, adsDesde: adsDesde(lojasSel(q)), config: r.config, porMes: r.porMes, faturas, cobertura: r.cobertura, fixos };
}));
registrarFixos(app, { H, nomes }); // Financeiro (DRE) › custos fixos do negócio
app.get('/api/config', H(() => ({ ...getConfig(), auto: Object.fromEntries(Object.keys(nomes).map(l => { const a = aliquotaAuto(l); return [l, a && { cnpj: a.cnpj, nome: a.nome, anexo: a.anexo, meses: Object.entries(a.meses).slice(-6).map(([mes, v]) => ({ mes, ...v })) }]; })) })));
app.post('/api/config', H((_, req) => { for (const k of [...Object.keys(nomes).map(l => 'aliquota_' + l), 'devolucao_perde_produto']) if (req.body[k] != null) {
    const v = Number(req.body[k]); if (!Number.isFinite(v) || v < 0 || v > 100) throw Object.assign(new Error(`valor inválido para ${k}`), { status: 400 });
    setConfig(k, v);
  }
  if (req.body.aliquota_modo != null) { if (!['manual'].includes(req.body.aliquota_modo)) throw Object.assign(new Error('modo inválido'), { status: 400 }); setConfig('aliquota_modo', req.body.aliquota_modo); } return getConfig(); }));
// diario = série diária da conta (janela de 90 dias da API). Com ?dias= acima de 90, junta os dias guardados em ads_daily_hist
// desde então (no mesmo dia vale a janela).
app.get('/api/ads', H(q => {
  const diario = all(`SELECT loja, body FROM raw WHERE recurso='ads_daily' AND ${OK} AND ${lojaSql(q)}`).map(r => ({ loja: r.loja, dias: JSON.parse(r.body).results || [] }));
  if (parseInt(q.dias) > 90) for (const r of all(`SELECT loja, body FROM raw WHERE recurso='ads_daily_hist' AND ${OK} AND ${lojaSql(q)}`)) {
    let x = diario.find(y => y.loja === r.loja); if (!x) diario.push(x = { loja: r.loja, dias: [] });
    const tem = new Set(x.dias.map(d => String(d.date).slice(0, 10))), ini = desde(q);
    x.dias = [...Object.entries(JSON.parse(r.body)).filter(([d]) => d >= ini && !tem.has(d)).map(([, v]) => v), ...x.dias].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  return {
    campanhas: all(`SELECT loja, body FROM raw WHERE recurso='ads_campaign' AND ${OK} AND ${lojaSql(q)}`).map(r => ({ loja: r.loja, ...JSON.parse(r.body) })),
    anuncios: all(`SELECT loja, body FROM raw WHERE recurso='ads_ad' AND ${OK} AND ${lojaSql(q)}`).map(r => ({ loja: r.loja, ...JSON.parse(r.body) })),
    diario,
  };
}));

// Detalhe ao vivo (sob demanda) com cache de 5 min: /api/live?tipo=order|shipment|item|claim|pack&id=...&loja=loja1
app.get('/api/live', async (req, res) => {
  const { tipo, id, loja } = req.query;
  if (!Object.hasOwn(LIVE, tipo) || !nomes[loja] || !/^[\w-]+$/.test(id || '')) return res.status(400).json({ erro: 'parametros invalidos' });
  const out = {};
  await Promise.all(LIVE[tipo](id).map(async ([nome, path]) => {
    const ex = getRaw(loja, 'live_' + tipo + '_' + nome, id);
    if (ex && ex.status === 200 && Date.now() - ex.coletado_em < 5 * 60e3) return (out[nome] = ex.body);
    const r = await mlGet(loja, path, { retries: 1 });
    saveRaw(loja, 'live_' + tipo + '_' + nome, id, path, r.status, r.body ?? r.error);
    out[nome] = r.status === 200 ? r.body : { _status: r.status, ...(typeof r.body === 'object' ? r.body : { erro: r.body }) };
  }));
  res.json(out);
});

registrarContas(app); // Configurações > Contas (conectar pelo login oficial do ML)
registrarShopee(app, { H }); // Gestão Shopee (só leitura)
registrarDescontos(app); // Gestão Mercado Livre > Descontos (aplicar/remover desconto, categorias, campanhas)
// Chart.js servido do próprio app (sem CDN: funciona offline e não depende de terceiros)
const CHART = path.join(path.dirname(createRequire(import.meta.url).resolve('chart.js')), 'chart.umd.js');
app.get('/vendor/chart.umd.js', (_, res) => res.sendFile(CHART));
// no-cache: o navegador sempre confere com o servidor (resposta 304 se nada mudou), senão segura o index.html/CSS antigos depois de uma atualização
app.use(express.static(path.join(ROOT, 'web'), { setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));
// `pronto` resolve com a porta real (o app desktop espera por ela antes de abrir a janela).
export const pronto = new Promise((resolve, reject) => {
  const srv = app.listen(PORT, HOST, () => {
    const porta = srv.address().port;
    console.log(`Nexus em http://${HOST}:${porta}`);
    if (!process.env.SEM_COLETA) agendar();
    resolve(porta);
  });
  srv.on('error', reject);
});
