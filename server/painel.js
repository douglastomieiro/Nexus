// Endpoints das telas "estilo Jodda": dashboard, análise de pedidos, curva ABC, análise por SKU, catálogo (anúncios gerais),
// anúncios patrocinados, devoluções com gráficos e status da coleta.
// Tudo é derivado do que já está no banco (nada novo é coletado) e do motor de lucro (margem.js).
import { db } from './db.js';
import { calcular } from './margem.js';
import { calcularShopee } from './shopee-margem.js';
import { estoquePorSku, vendas30, shopeeDoFiltro } from './recompra.js';

export const LOG = { fulfillment: 'Full', self_service: 'Flex', xd_drop_off: 'Padrão', cross_docking: 'Padrão', drop_off: 'Padrão', default: 'Padrão' };
export const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
export const addDias = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const diaBR = s => new Date(Date.parse(s) - 3 * 3600e3).toISOString().slice(0, 10); // dia comercial (fuso de Brasília); o ML devolve -04:00
export const r2 = n => Math.round((n || 0) * 100) / 100;
const semQtd = t => String(t || '').replace(/ x\d+$/, '');
export const janela = (dias) => { const fim = hoje(), ini = addDias(fim, -(dias - 1)); return { n: dias, ini, fim, pIni: addDias(ini, -dias), pFim: addDias(ini, -1) }; };

// ── caches de metadados (logística/UF por pedido, anúncios, categorias) ──
export const cacheDe = (ttl, fn) => { let c = { t: 0, v: null }; return () => { if (c.v && Date.now() - c.t < ttl) return c.v; c = { t: Date.now(), v: fn() }; return c.v; }; };
export const envios = cacheDe(60e3, () => {
  const m = {};
  for (const r of db.prepare(`SELECT loja, json_extract(body,'$.order_id') oid, json_extract(body,'$.logistic_type') lg, json_extract(body,'$.receiver_address.state.id') uf
    FROM raw WHERE recurso='shipment' AND status=200`).iterate()) if (r.oid) m[r.loja + ':' + r.oid] = { lg: r.lg ? (LOG[r.lg] || 'Padrão') : null, uf: (r.uf || '').replace('BR-', '') || null };
  return m;
});
// anúncio → miniatura, categoria, status, preço, estoque, logística (dos anúncios coletados; miniatura também dos anúncios em Ads)
export const anuncios = cacheDe(300e3, () => {
  const m = {};
  for (const r of db.prepare(`SELECT loja, chave, json_extract(body,'$.thumbnail') t, json_extract(body,'$.category_id') cat, json_extract(body,'$.status') st, json_extract(body,'$.price') preco,
      json_extract(body,'$.available_quantity') est, json_extract(body,'$.shipping.logistic_type') lg, json_extract(body,'$.permalink') link FROM raw WHERE recurso='item' AND status=200`).iterate())
    m[r.loja + ':' + r.chave] = { thumb: r.t ? r.t.replace('http://', 'https://') : null, cat: r.cat, status: r.st, preco: r.preco, estoque: r.est, lg: r.lg ? (LOG[r.lg] || 'Padrão') : null, link: r.link };
  for (const r of db.prepare(`SELECT loja, chave, json_extract(body,'$.thumbnail') t FROM raw WHERE recurso='ads_ad' AND status=200`).iterate()) {
    const k = r.loja + ':' + r.chave; if (!m[k]) m[k] = { thumb: null }; if (!m[k].thumb && r.t) m[k].thumb = r.t.replace('http://', 'https://');
  }
  return m;
});
const thumbDe = (loja, item) => anuncios()[loja + ':' + item]?.thumb || null;
// miniatura do anúncio da Shopee (dos anúncios coletados)
export const spThumbs = cacheDe(300e3, () => Object.fromEntries(db.prepare(`SELECT loja, chave, json_extract(body,'$.image.image_url_list[0]') img FROM raw WHERE recurso='sp_item' AND status=200`).all().map(r => [r.loja + ':' + r.chave, r.img])));
export const spThumb = (loja, item) => spThumbs()[loja + ':' + item] || null;
export const categorias = cacheDe(600e3, () => Object.fromEntries(db.prepare(`SELECT chave, json_extract(body,'$.name') n FROM raw WHERE recurso='category' AND status=200`).all().map(r => [r.chave, r.n])));
// anúncios em Ads (status e métricas dos últimos 90 dias), por loja:item
const adsPorItem = cacheDe(120e3, () => {
  const camp = Object.fromEntries(db.prepare(`SELECT loja, chave, json_extract(body,'$.name') n FROM raw WHERE recurso='ads_campaign' AND status=200`).all().map(r => [r.loja + ':' + r.chave, r.n]));
  const m = {};
  for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='ads_ad' AND status=200`).iterate()) { const a = JSON.parse(r.body); m[r.loja + ':' + a.item_id] = { ...a, loja: r.loja, campanha: camp[r.loja + ':' + a.campaign_id] || null }; }
  return m;
});

// classe ABC pela métrica escolhida (A = até 80% do acumulado, B = até 95%, C = resto; o item que cruza o corte fica na classe de cima)
function classes(linhas, met) {
  const ord = linhas.slice().sort((a, b) => b[met] - a[met]), tot = ord.reduce((t, x) => t + Math.max(x[met], 0), 0) || 1;
  let ac = 0; const m = {};
  for (const x of ord) { const antes = ac / tot; ac += Math.max(x[met], 0); m[x.sku] = { classe: antes < 0.8 ? 'A' : antes < 0.95 ? 'B' : 'C', pctAcum: ac / tot }; }
  return m;
}

function sinal(x) {
  if (x.semCusto) return 'Sem custo';
  const m = x.margem, g = x.cresc;
  if (m < 0.15) return 'ATENÇÃO';
  if (m < 0.20) return x.classe === 'C' ? 'Neutro / Monitorar' : 'Giro com Margem Baixa';
  if (g != null && g < -0.05) return m >= 0.25 ? 'Em Queda, mas Rentável' : 'Neutro / Monitorar';
  if (x.classe === 'A' && m >= 0.30) return 'Alta Receita Saudável';
  if (x.classe === 'A' && m >= 0.25 && (g == null || g >= 0)) return 'Campeão A';
  return 'Neutro / Monitorar';
}

// soma Mercado Livre + Shopee por SKU (em cópias: os objetos do cálculo ficam em cache)
function juntaCanais(ml, sp) {
  const m = new Map(ml.map(s => [s.sku, { ...s, lojas: [...s.lojas], canais: ['ML'] }]));
  for (const s of sp) {
    const e = m.get(s.sku);
    if (e) { e.unidades += s.unidades; e.receita += s.receita; e.lucro += s.lucro; e.ads = (e.ads || 0) + (s.ads || 0); e.margem = e.receita ? e.lucro / e.receita : 0; e.semCusto = e.semCusto || s.semCusto; e.lojas = [...new Set([...e.lojas, ...s.lojas])]; e.canais.push('Shopee'); }
    else m.set(s.sku, { sku: s.sku, titulo: s.titulo, item: s.item, lojas: [...s.lojas], anuncios: s.anuncios, unidades: s.unidades, receita: s.receita, lucro: s.lucro, margem: s.margem, ads: s.ads || 0, custoUnit: s.custoUnit, semCusto: s.semCusto, canais: ['Shopee'] });
  }
  return [...m.values()];
}

// spLojas: contas da Shopee para somar ao ML (Tabela de Produtos); vazio = só ML
function montaAbc(lojas, w, met, spLojas = []) {
  const cur = calcular({ lojas, desde: w.ini }), prev = calcular({ lojas, desde: w.pIni, ate: w.pFim });
  const sp = spLojas.length ? { cur: calcularShopee({ lojas: spLojas, desde: w.ini }), prev: calcularShopee({ lojas: spLojas, desde: w.pIni, ate: w.pFim }) } : null;
  const curSkus = sp ? juntaCanais(cur.skus, sp.cur.skus) : cur.skus, prevSkus = sp ? juntaCanais(prev.skus, sp.prev.skus) : prev.skus;
  const pm = Object.fromEntries(prevSkus.map(s => [s.sku, s]));
  const base = curSkus.map(s => ({ canais: s.canais || ['ML'], sku: s.sku, titulo: s.titulo, item: s.item, lojas: s.lojas, anuncios: s.anuncios, unidades: s.unidades, receita: r2(s.receita), lucro: r2(s.lucro), margem: s.margem, ads: r2(s.ads), custoUnit: s.custoUnit, semCusto: s.semCusto,
    thumb: thumbDe(s.lojas[0], s.item), prevReceita: r2(pm[s.sku]?.receita || 0), prevUnidades: pm[s.sku]?.unidades || 0, prevLucro: r2(pm[s.sku]?.lucro || 0), prevMargem: pm[s.sku]?.margem ?? null }));
  const cl = classes(base, met), clp = classes(prevSkus.map(s => ({ sku: s.sku, unidades: s.unidades, receita: s.receita, lucro: s.lucro })), met);
  const ref = met === 'unidades' ? 'prevUnidades' : met === 'lucro' ? 'prevLucro' : 'prevReceita';
  const linhas = base.map(x => {
    x.cresc = x[ref] > 0 ? (x[met] - x[ref]) / x[ref] : null;
    x.classe = cl[x.sku].classe; x.pctAcum = cl[x.sku].pctAcum; x.classePrev = clp[x.sku]?.classe || '—';
    x.tendencia = x.cresc == null ? 'Novo' : x.cresc > 0.05 ? 'Alta' : x.cresc < -0.05 ? 'Queda' : 'Estável';
    x.sinal = sinal(x); return x;
  }).sort((a, b) => b[met] - a[met]);
  return { cur, prev, linhas, sp };
}

// saúde de um anúncio em Ads: compara o ACOS com a margem do item ANTES do Ads (se o ACOS come a margem, o Ads dá prejuízo)
function saudeAds(cost, venda, margemPre) {
  if (!cost) return 'Sem gasto';
  if (!venda) return cost >= 5 ? 'Crítico' : 'Atenção';
  const acos = cost / venda;
  if (margemPre == null) return acos <= 0.10 ? 'Excelente' : acos <= 0.20 ? 'Atenção' : 'Crítico';
  return acos >= margemPre ? 'Crítico' : acos >= margemPre * 0.6 ? 'Atenção' : 'Excelente';
}

export function registrar(app, { H, nomes, lojasSel, dias }) {
  // ── status da coleta (cabeçalho: "sincronizado há X min") ──
  app.get('/api/status', H(() => {
    const ped = db.prepare(`SELECT loja, MAX(fim) fim FROM coleta_log WHERE modulo='pedidos' GROUP BY loja`).all();
    const ult = db.prepare(`SELECT MAX(fim) fim FROM coleta_log`).get();
    return { agora: Date.now(), pedidos: Object.fromEntries(ped.map(r => [r.loja, r.fim])), ultima: ult?.fim || null };
  }));

  // ── Análise de pedidos ──
  app.get('/api/pedidos-analise', H(q => {
    const lojas = lojasSel(q), w = janela(dias(q)), cur = calcular({ lojas, desde: w.ini }), env = envios();
    const todos = cur.pedidosTodos.slice().sort((a, b) => b.data.localeCompare(a.data));
    const rows = todos.map(p => ({ id: p.id, loja: p.loja, data: p.data, itens: p.itens.map(semQtd), sku: p.det[0]?.sku || null, qtd: p.qtd || 0, thumb: thumbDe(p.loja, p.itemId), itemId: p.itemId, envio: p.envio,
      receita: r2(p.receita), custo: r2(p.custo), comissao: r2(p.comissao), frete: r2(p.frete), reembolso: r2(p.devolucao), imposto: r2(p.imposto), ads: r2(p.ads), repasse: r2(p.receita - p.devolucao - p.comissao - p.frete),
      freteNF: r2(p.freteNF), impostoFrete: r2(p.impostoFrete), // frete do comprador na NF: não é receita nem custo, mas entra na base do imposto
      det: p.det.map(d => ({ qtd: d.qtd, preco: r2(d.preco), custo: r2(d.custo), comissao: r2(d.comissao) })), // itens: para a explicação de cada valor na tela
      lucro: r2(p.lucro), margem: p.receita ? p.lucro / p.receita : 0, lg: env[p.loja + ':' + p.id]?.lg || null, uf: env[p.loja + ':' + p.id]?.uf || null, flags: p.flags }));
    const fat = rows.reduce((t, x) => t + x.receita, 0), luc = rows.reduce((t, x) => t + x.lucro, 0);
    return { desde: w.ini, total: rows.length, faturamento: r2(fat), margemMedia: fat ? luc / fat : 0, cancelados: cur.total.canceladas, semLogistica: rows.filter(x => !x.lg).length, pedidos: rows.slice(0, 3000) };
  }));

  // ── Curva ABC / tabela de produtos ──
  app.get('/api/abc', H(q => {
    const met = ['unidades', 'receita', 'lucro'].includes(q.metrica) ? q.metrica : 'receita', w = janela(dias(q));
    const lojas = lojasSel(q), spL = shopeeDoFiltro(lojas); // com Shopee no filtro, a tabela soma os dois canais por SKU
    const { cur, prev, linhas, sp } = montaAbc(lojas, w, met, spL);
    // recompra: estoque dos anúncios (próprio e Full) e vendas dos últimos 30 dias de cada SKU
    const E = estoquePorSku(lojas, spL), V30 = vendas30(lojas, spL);
    for (const x of linhas) { const e = E[x.sku]; x.estoqueProprio = e?.proprio || 0; x.estoqueFull = e?.full || 0; x.estoqueAnuncios = e?.anuncios || []; x.semAnuncio = !e; x.unidades30 = V30[x.sku] || 0; }
    const delta = (a, b) => b ? (a - b) / Math.abs(b) : null, S = (c, k) => (sp ? sp[c].total[k] || 0 : 0), U = c => (sp ? sp[c].skus.reduce((t, s) => t + s.unidades, 0) : 0);
    const fat = cur.total.receita + S('cur', 'receita'), fatP = prev.total.receita + S('prev', 'receita'), luc = cur.total.lucroFinal + S('cur', 'lucroFinal'), lucP = prev.total.lucroFinal + S('prev', 'lucroFinal');
    return { desde: w.ini, dias: w.n, metrica: met, canais: sp ? ['ML', 'Shopee'] : ['ML'], resumo: {
      faturamento: fat, faturamentoPrev: fatP, dFat: delta(fat, fatP),
      unidades: cur.skus.reduce((t, s) => t + s.unidades, 0) + U('cur'), unidadesPrev: prev.skus.reduce((t, s) => t + s.unidades, 0) + U('prev'),
      lucro: luc, lucroPrev: lucP, margem: sp ? (fat ? luc / fat : 0) : cur.total.margem, margemPrev: sp ? (fatP ? lucP / fatP : 0) : prev.total.margem,
      cancelados: cur.total.canceladas + S('cur', 'canceladas'), canceladosPrev: prev.total.canceladas + S('prev', 'canceladas') }, linhas };
  }));

  // ── Análise por SKU ──
  app.get('/api/sku', H(q => {
    const sku = String(q.sku || ''); if (!sku) throw Object.assign(new Error('informe o SKU'), { status: 400 });
    const lojas = lojasSel(q), w = janela(dias(q)), cur = calcular({ lojas, desde: w.ini }), prev = calcular({ lojas, desde: w.pIni, ate: w.pFim }), env = envios();
    // com Shopee no filtro, o histórico do SKU junta os dois canais
    const spL = shopeeDoFiltro(lojas), spCur = spL.length ? calcularShopee({ lojas: spL, desde: w.ini }) : null, spPrev = spL.length ? calcularShopee({ lojas: spL, desde: w.pIni, ate: w.pFim }) : null;
    // frete na nota (cobrado do comprador, base do imposto) é do pedido: cada item fica com a sua parte do valor
    const linhas = (c, canal) => (c?.pedidosTodos || []).flatMap(p => p.det.filter(d => d.sku === sku).map(d => ({ ...d, canal, pedido: String(p.id), loja: p.loja, data: p.data, flags: p.flags,
      freteNF: p.receita ? (p.freteNF || 0) * d.receita / p.receita : 0, lg: canal === 'shopee' ? 'Shopee' : env[p.loja + ':' + p.id]?.lg || null })));
    const soma = L => { const t = { pedidos: new Set(L.map(x => x.loja + ':' + x.pedido)).size, unidades: 0, receita: 0, devolucao: 0, comissao: 0, frete: 0, ajustes: 0, freteNF: 0, imposto: 0, custo: 0, ads: 0, lucro: 0 };
      for (const x of L) { t.unidades += x.qtd; for (const k of ['receita', 'devolucao', 'comissao', 'frete', 'ajustes', 'freteNF', 'imposto', 'custo', 'ads', 'lucro']) t[k] += x[k] || 0; }
      for (const k of Object.keys(t)) if (k !== 'pedidos' && k !== 'unidades') t[k] = r2(t[k]); t.margem = t.receita ? t.lucro / t.receita : 0; t.precoMedio = t.unidades ? t.receita / t.unidades : 0; return t; };
    const L = [...linhas(cur, 'ml'), ...linhas(spCur, 'shopee')], Lp = [...linhas(prev, 'ml'), ...linhas(spPrev, 'shopee')];
    const s = cur.skus.find(x => x.sku === sku) || spCur?.skus.find(x => x.sku === sku) || prev.skus.find(x => x.sku === sku) || spPrev?.skus.find(x => x.sku === sku);
    if (!L.length && !s) throw Object.assign(new Error('SKU sem vendas no período'), { status: 404 });
    const dia = {}, porLoja = {}, porLg = {}, anunc = {};
    for (const x of L) {
      const d = dia[diaBR(x.data)] ||= { dia: diaBR(x.data), receita: 0, unidades: 0, lucro: 0 }; d.receita += x.receita; d.unidades += x.qtd; d.lucro += x.lucro;
      const l = porLoja[x.loja] ||= { loja: x.loja, receita: 0, unidades: 0, lucro: 0 }; l.receita += x.receita; l.unidades += x.qtd; l.lucro += x.lucro;
      const g = porLg[x.lg || 'Sem dado'] ||= { lg: x.lg || 'Sem dado', receita: 0, unidades: 0 }; g.receita += x.receita; g.unidades += x.qtd;
      const a = anunc[x.loja + ':' + x.item] ||= { loja: x.loja, item: x.item, titulo: x.titulo, thumb: x.canal === 'shopee' ? spThumb(x.loja, x.item) : thumbDe(x.loja, x.item), canal: x.canal, receita: 0, unidades: 0, ads: adsPorItem()[x.loja + ':' + x.item] ? 1 : 0 }; a.receita += x.receita; a.unidades += x.qtd;
    }
    const devol = [...cur.devolucoes, ...(spCur?.devolucoes.filter(d => d.efetiva) || [])].filter(d => (d.itensDet || []).some(i => i.sku === sku));
    return { sku, desde: w.ini, titulo: s?.titulo || L[0]?.titulo, thumb: thumbDe((s?.lojas || [L[0]?.loja])[0], s?.item || L[0]?.item) || spThumb(L[0]?.loja, L[0]?.item), custoUnit: s?.custoUnit ?? null, semCusto: !!s?.semCusto,
      total: soma(L), anterior: soma(Lp), devolucoes: devol.length, devolvido: r2(devol.reduce((t, d) => t + d.reembolsado, 0)),
      diario: Object.values(dia).sort((a, b) => a.dia.localeCompare(b.dia)), porLoja: Object.values(porLoja), logistica: Object.values(porLg), anuncios: Object.values(anunc).sort((a, b) => b.receita - a.receita),
      // datas do ML vêm com -04:00 e as da Shopee em UTC: ordena pelo instante, não pelo texto
      pedidos: L.sort((a, b) => Date.parse(b.data) - Date.parse(a.data)).slice(0, 300).map(x => ({ data: x.data, canal: x.canal, loja: x.loja, pedido: x.pedido, qtd: x.qtd, preco: x.preco, receita: r2(x.receita),
        devolucao: r2(x.devolucao), comissao: r2(x.comissao), frete: r2(x.frete), ajustes: r2(x.ajustes || 0), freteNF: r2(x.freteNF), imposto: r2(x.imposto), custo: r2(x.custo), ads: r2(x.ads),
        lucro: r2(x.lucro), margem: x.receita ? x.lucro / x.receita : 0, lg: x.lg, flags: x.flags })) };
  }));

  // ── Dashboard ──
  app.get('/api/dash', H(q => {
    const lojas = lojasSel(q), w = janela(dias(q));
    const { cur, prev, linhas } = montaAbc(lojas, w, 'receita'), env = envios();
    const hj = hoje(), mIni = hj.slice(0, 8) + '01', diaMes = +hj.slice(8), diasMes = new Date(+hj.slice(0, 4), +hj.slice(5, 7), 0).getDate();
    const mes = calcular({ lojas, desde: mIni }), T = cur.total;
    const pf = c => ({ receita: c.total.receita, pedidos: c.total.pedidos, unidades: c.skus.reduce((t, s) => t + s.unidades, 0), lucro: c.total.lucroFinal, imposto: c.total.imposto, ads: r2(c.total.ads + c.total.adsSemVenda), margem: c.total.margem });
    // lucro bruto = tudo o que sai por pedido + todo o Ads do período (inclusive o gasto em dias sem venda)
    const lucroBruto = r2(T.receita - T.devolucao - T.comissao - T.frete - T.imposto - T.custo - T.ads - T.adsSemVenda);
    const porLoja = {}, lg = {}, uf = {}, dia = {};
    for (const p of cur.pedidosTodos) {
      const l = porLoja[p.loja] ||= { loja: p.loja, receita: 0, pedidos: 0, lucro: 0, prevReceita: 0, prevPedidos: 0 }; l.receita += p.receita; l.pedidos++; l.lucro += p.lucro;
      const e = env[p.loja + ':' + p.id];
      if (e?.lg) { const g = lg[e.lg] ||= { lg: e.lg, pedidos: 0, receita: 0, lucro: 0 }; g.pedidos++; g.receita += p.receita; g.lucro += p.lucro; }
      if (e?.uf) { const g = uf[e.uf] ||= { uf: e.uf, pedidos: 0, receita: 0 }; g.pedidos++; g.receita += p.receita; }
      const d = diaBR(p.data), x = dia[d] ||= { dia: d, receita: 0, pedidos: 0, lucro: 0, unidades: 0 }; x.receita += p.receita; x.pedidos++; x.lucro += p.lucro; x.unidades += p.qtd || 0;
    }
    for (const p of prev.pedidosTodos) { const l = porLoja[p.loja] ||= { loja: p.loja, receita: 0, pedidos: 0, lucro: 0, prevReceita: 0, prevPedidos: 0 }; l.prevReceita += p.receita; l.prevPedidos++; }
    const semAds = linhas.filter(x => x.ads === 0 && !x.semCusto);
    return {
      desde: w.ini, atual: pf(cur), anterior: pf(prev), lucroBruto, lucroBrutoPrev: r2(prev.total.receita - prev.total.devolucao - prev.total.comissao - prev.total.frete - prev.total.imposto - prev.total.custo - prev.total.ads - prev.total.adsSemVenda),
      mes: { receita: mes.total.receita, dia: diaMes, diasMes, previsao: diaMes ? mes.total.receita / diaMes * diasMes : 0, inicio: mIni },
      porLoja: Object.values(porLoja), logistica: Object.values(lg), estados: Object.values(uf).sort((a, b) => b.receita - a.receita),
      diario: Object.values(dia).sort((a, b) => a.dia.localeCompare(b.dia)).map(x => ({ ...x, receita: r2(x.receita), lucro: r2(x.lucro) })),
      top10: linhas.slice(0, 10), ads: { total: r2(T.ads + T.adsSemVenda), organicoSemAds: r2(semAds.reduce((t, x) => t + x.receita, 0)), oportunidades: semAds.filter(x => x.margem >= 0.25 && x.receita >= 300).length },
      nBaixaMargem: linhas.filter(x => !x.semCusto && x.margem < 0.20).length, nSemCusto: linhas.filter(x => x.semCusto).length,
      baixaMargem: linhas.filter(x => !x.semCusto && x.margem < 0.20).sort((a, b) => b.receita - a.receita).slice(0, 100),
      semCusto: linhas.filter(x => x.semCusto).sort((a, b) => b.receita - a.receita).slice(0, 100),
      oportunidadesAds: semAds.filter(x => x.margem >= 0.25 && x.receita >= 300).sort((a, b) => b.receita - a.receita).slice(0, 50),
      semLogistica: cur.pedidosTodos.filter(p => !env[p.loja + ':' + p.id]?.lg).length,
    };
  }));

  // ── Catálogo (anúncios gerais): por anúncio, com categoria e segmento Com/Sem Ads ──
  app.get('/api/catalogo', H(q => {
    const lojas = lojasSel(q), w = janela(dias(q)), cur = calcular({ lojas, desde: w.ini }), an = anuncios(), cats = categorias(), ads = adsPorItem();
    const linhas = cur.porItem.map(p => {
      const meta = an[p.loja + ':' + p.item] || {}, ad = ads[p.loja + ':' + p.item], comAds = !!ad && (ad.status === 'active' || (ad.metrics?.cost || 0) > 0);
      const margem = p.receita ? p.lucro / p.receita : 0, cat = meta.cat || p.categoria;
      return { loja: p.loja, item: p.item, sku: p.sku, titulo: p.titulo, thumb: meta.thumb || null, categoria: cats[cat] || cat || 'Sem categoria', unidades: p.unidades, pedidos: p.pedidos,
        receita: r2(p.receita), lucro: r2(p.lucro), ads: r2(p.ads), margem, semCusto: p.semCusto, segmento: comAds ? 'Com ADS' : 'Sem ADS', oportunidade: !comAds && !p.semCusto && margem >= 0.25 && p.receita > 0,
        status: meta.status || null, estoque: meta.estoque ?? null, lg: meta.lg || null };
    }).sort((a, b) => b.receita - a.receita);
    const porCat = {};
    for (const x of linhas) { const c = porCat[x.categoria] ||= { categoria: x.categoria, receita: 0, lucro: 0, ads: 0, unidades: 0, n: 0 }; c.receita += x.receita; c.lucro += x.lucro; c.ads += x.ads; c.unidades += x.unidades; c.n++; }
    const T = linhas.reduce((t, x) => ({ receita: t.receita + x.receita, lucro: t.lucro + x.lucro, unidades: t.unidades + x.unidades }), { receita: 0, lucro: 0, unidades: 0 });
    return { desde: w.ini, total: { ...T, margem: T.receita ? T.lucro / T.receita : 0, anuncios: linhas.length }, linhas, categorias: Object.values(porCat).map(c => ({ ...c, margem: c.receita ? c.lucro / c.receita : 0 })).sort((a, b) => b.receita - a.receita) };
  }));

  // ── Anúncios patrocinados (Product Ads, 90 dias) com saúde pela margem do item ──
  app.get('/api/ads-anuncios', H(q => {
    const lojas = lojasSel(q), cur = calcular({ lojas, desde: janela(90).ini });
    const pi = Object.fromEntries(cur.porItem.map(p => [p.loja + ':' + p.item, p]));
    const lista = Object.values(adsPorItem()).filter(a => lojas.includes(a.loja)).map(a => {
      const m = a.metrics || {}, p = pi[a.loja + ':' + a.item_id];
      const margemPre = p && !p.semCusto && p.receita ? (p.lucro + p.ads) / p.receita : null; // margem do item antes do Ads
      return { loja: a.loja, item: a.item_id, titulo: a.title, thumb: (a.thumbnail || '').replace('http://', 'https://') || thumbDe(a.loja, a.item_id), status: a.status, campanha: a.campanha, preco: a.price, lg: LOG[a.logistic_type] || null,
        clicks: m.clicks || 0, prints: m.prints || 0, cost: r2(m.cost), venda: r2(m.total_amount), vendaDireta: r2(m.direct_amount), unidades: m.units_quantity || 0, orgUnidades: m.organic_units_quantity || 0, orgVenda: r2(m.organic_units_amount),
        acos: m.total_amount ? m.cost / m.total_amount : null, roas: m.cost ? m.total_amount / m.cost : null, ctr: m.prints ? m.clicks / m.prints : null,
        margemPre, margemPos: margemPre == null ? null : margemPre - (m.total_amount ? m.cost / m.total_amount : 0), saude: saudeAds(m.cost || 0, m.total_amount || 0, margemPre) };
    }).sort((a, b) => b.cost - a.cost);
    return { lista, receitaTotal90: cur.total.receita };
  }));

  // ── Devoluções (gráficos e quadros) ──
  app.get('/api/devolucoes-graficos', H(q => {
    const lojas = lojasSel(q), w = janela(dias(q)), cur = calcular({ lojas, desde: w.ini }), env = envios();
    const evo = {}, porLoja = {}, lg = {}, uf = {}, vendasLg = {}, vendasUf = {};
    for (const p of cur.pedidosTodos) { const e = env[p.loja + ':' + p.id]; if (e?.lg) vendasLg[e.lg] = (vendasLg[e.lg] || 0) + 1; if (e?.uf) vendasUf[e.uf] = (vendasUf[e.uf] || 0) + 1; }
    for (const d of cur.devolucoes) {
      const k = diaBR(d.data), x = evo[k] ||= { dia: k, n: 0, valor: 0 }; x.n++; x.valor += d.reembolsado;
      const l = porLoja[d.loja] ||= { loja: d.loja, n: 0, valor: 0 }; l.n++; l.valor += d.reembolsado;
      const e = env[d.loja + ':' + d.id];
      if (e?.lg) { const g = lg[e.lg] ||= { lg: e.lg, n: 0, valor: 0 }; g.n++; g.valor += d.reembolsado; }
      if (e?.uf) { const g = uf[e.uf] ||= { uf: e.uf, n: 0, valor: 0 }; g.n++; g.valor += d.reembolsado; }
    }
    const un = cur.devolucoes.reduce((t, d) => t + (d.itensDet || []).reduce((s, i) => s + i.qtd, 0), 0);
    return { desde: w.ini, total: cur.devolucoes.length, faturamento: cur.total.receita, lucro: cur.total.lucroFinal, unidades: un, pedidos: cur.total.pedidos,
      taxa: cur.total.pedidos + cur.devolucoes.length ? cur.devolucoes.length / (cur.total.pedidos + cur.devolucoes.length) : 0, valor: cur.total.devolvido,
      evolucao: Object.values(evo).sort((a, b) => a.dia.localeCompare(b.dia)), porLoja: Object.values(porLoja),
      logistica: Object.values(lg).map(g => ({ ...g, vendas: vendasLg[g.lg] || 0 })), estados: Object.values(uf).map(g => ({ ...g, vendas: vendasUf[g.uf] || 0 })).sort((a, b) => b.n - a.n) };
  }));
}
