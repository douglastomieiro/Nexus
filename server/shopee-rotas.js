// API da aba Shopee: lê o que o coletor guardou (sp_*) e o motor `calcularShopee`. Só leitura.
import { db } from './db.js';
import { SHOPEE } from './shopee.js';
import { LOJAS } from './ml.js';
import { calcularShopee } from './shopee-margem.js';
import { calcular } from './margem.js';

const NOMES = Object.fromEntries(Object.entries(SHOPEE).map(([k, v]) => [k, v.nome]));
const spDe = l => 'shopee' + l.replace('loja', ''); // o filtro global de loja é o do ML: loja<n> ↔ shopee<n> (mesma empresa)
const lojasSp = q => (NOMES[q.loja] ? [q.loja] : LOJAS[q.loja] ? [spDe(q.loja)].filter(l => NOMES[l]) : Object.keys(NOMES));
const brHoje = () => new Date(Date.now() - 3 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const janela = q => { // últimos N dias (hoje incluso) e o período anterior de mesmo tamanho
  const n = Math.min(Math.max(parseInt(q.dias) || 30, 1), 400), h = brHoje();
  const ini = new Date(h - (n - 1) * 864e5), fimP = new Date(h - n * 864e5), iniP = new Date(h - (2 * n - 1) * 864e5);
  return { n, desde: iso(ini), desdeP: iso(iniP), ateP: iso(fimP) };
};
const soma = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);

export function registrarShopee(app, { H }) {
  app.get('/api/shopee/lojas', H(() => NOMES));

  app.get('/api/shopee/status', H(() => {
    const ult = db.prepare("SELECT loja, MAX(coletado_em) t FROM raw WHERE recurso='sp_order' GROUP BY loja").all();
    return { agora: Date.now(), pedidos: Object.fromEntries(ult.map(r => [r.loja, r.t])),
      totais: db.prepare("SELECT loja, recurso, COUNT(*) n FROM raw WHERE recurso IN ('sp_order','sp_escrow','sp_return') AND status=200 GROUP BY loja, recurso").all() };
  }));

  app.get('/api/shopee/dash', H(q => {
    const { desde, desdeP, ateP, n } = janela(q), lojas = lojasSp(q);
    const A = calcularShopee({ lojas, desde }), P = calcularShopee({ lojas, desde: desdeP, ate: ateP });
    const porLoja = lojas.map(l => { const a = calcularShopee({ lojas: [l], desde }), p = calcularShopee({ lojas: [l], desde: desdeP, ate: ateP });
      return { loja: l, nome: NOMES[l], receita: a.total.receita, lucro: a.total.lucroFinal, pedidos: a.total.pedidos, prevReceita: p.total.receita, prevLucro: p.total.lucroFinal }; });
    const status = {};
    for (const p of A.pedidosTodos) status[p.status] = (status[p.status] || 0) + 1;
    const motivos = {};
    for (const d of A.devolucoes) { const m = motivos[d.motivo] ||= { motivo: d.motivo, n: 0, reembolsado: 0 }; m.n++; m.reembolsado += d.reembolsado; }
    const top = A.skus.slice(0, 10).map(s => ({ sku: s.sku, titulo: s.titulo, unidades: s.unidades, receita: s.receita, lucro: s.lucro, margem: s.margem, semCusto: s.semCusto }));
    const baixa = A.skus.filter(s => !s.semCusto && s.margem < 0.2 && s.receita > 100).slice(0, 15).map(s => ({ sku: s.sku, titulo: s.titulo, receita: s.receita, lucro: s.lucro, margem: s.margem }));
    return { dias: n, desde, atual: A.total, anterior: P.total, cobertura: A.cobertura, porLoja, diario: A.diario, porMes: A.porMes, status,
      motivos: Object.values(motivos).sort((a, b) => b.n - a.n), top, baixa,
      semCusto: A.skus.filter(s => s.semCusto).slice(0, 40).map(s => ({ sku: s.sku, titulo: s.titulo, receita: s.receita })) };
  }));

  app.get('/api/shopee/pedidos', H(q => {
    const { desde } = janela(q), r = calcularShopee({ lojas: lojasSp(q), desde });
    let l = r.pedidosTodos;
    if (q.status) l = l.filter(p => p.status === q.status);
    if (q.q) { const t = String(q.q).toLowerCase(); l = l.filter(p => (p.id + ' ' + p.itens.join(' ') + ' ' + (p.comprador || '')).toLowerCase().includes(t)); }
    l = l.slice().sort((a, b) => b.data.localeCompare(a.data));
    const lim = Math.min(parseInt(q.limit) || 200, 1000);
    return { total: r.total, cobertura: r.cobertura, n: l.length, lista: l.slice(0, lim).map(p => ({ ...p, itens: p.itens.join(' | ') })) };
  }));

  app.get('/api/shopee/produtos', H(q => { const { desde } = janela(q), r = calcularShopee({ lojas: lojasSp(q), desde }); return { total: r.total, cobertura: r.cobertura, skus: r.skus }; }));
  app.get('/api/shopee/devolucoes', H(q => {
    const { desde } = janela(q), r = calcularShopee({ lojas: lojasSp(q), desde });
    const porSku = {};
    for (const d of r.devolucoes.filter(x => x.efetiva)) for (const i of d.itensDet) { const s = porSku[i.sku || i.id] ||= { sku: i.sku || i.id, titulo: i.titulo, devolucoes: 0, unidades: 0, valor: 0 }; s.devolucoes++; s.unidades += i.qtd; s.valor += i.valor || 0; }
    return { total: r.total, lista: r.devolucoes.slice(0, 500), porSku: Object.values(porSku).sort((a, b) => b.valor - a.valor).slice(0, 40), porMes: r.porMes };
  }));

  // Ads: série diária da loja (gasto, GMV, pedidos, ROAS) + saldo. Só a loja inteira: as campanhas ativas (GMV Max) não vêm por anúncio na API.
  app.get('/api/shopee/ads', H(q => {
    const { desde, n } = janela(q), lojas = lojasSp(q), ph = lojas.map(() => '?').join(',');
    const dias = {};
    for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='sp_ads_shop' AND status=200 AND loja IN (${ph}) AND chave >= ?`).all(...lojas, desde)) {
      const b = JSON.parse(r.body), d = dias[r.chave] ||= { dia: r.chave, gasto: 0, gmv: 0, pedidos: 0, cliques: 0, impressoes: 0, itens: 0 };
      d.gasto += b.expense || 0; d.gmv += b.broad_gmv || 0; d.pedidos += b.broad_order || 0; d.cliques += b.clicks || 0; d.impressoes += b.impression || 0; d.itens += b.broad_item_sold || 0;
    }
    const serie = Object.values(dias).sort((a, b) => a.dia.localeCompare(b.dia));
    const T = serie.reduce((t, d) => { for (const k of ['gasto', 'gmv', 'pedidos', 'cliques', 'impressoes', 'itens']) t[k] += d[k]; return t; }, { gasto: 0, gmv: 0, pedidos: 0, cliques: 0, impressoes: 0, itens: 0 });
    const A = calcularShopee({ lojas, desde });
    const saldo = db.prepare(`SELECT loja, body FROM raw WHERE recurso='sp_ads_saldo' AND status=200 AND loja IN (${ph})`).all(...lojas).map(r => ({ loja: r.loja, nome: NOMES[r.loja], saldo: JSON.parse(r.body).total_balance }));
    const camp = db.prepare(`SELECT loja, body FROM raw WHERE recurso='sp_ads_campaign' AND status=200 AND loja IN (${ph})`).all(...lojas).map(r => ({ loja: r.loja, ...JSON.parse(r.body) }));
    return { dias: n, desde, serie: serie.map(d => ({ ...d, roas: d.gasto ? d.gmv / d.gasto : 0 })), total: { ...T, roas: T.gasto ? T.gmv / T.gasto : 0, acos: T.gmv ? T.gasto / T.gmv : 0, cpc: T.cliques ? T.gasto / T.cliques : 0, ctr: T.impressoes ? T.cliques / T.impressoes : 0, tacos: A.total.receita ? T.gasto / A.total.receita : 0 },
      receita: A.total.receita, saldo, campanhasAntigas: camp.length, gastoEmCampanhas: camp.reduce((t, c) => t + Object.entries(c.dias || {}).filter(([d]) => d >= desde).reduce((s, [, m]) => s + (m.expense || 0), 0), 0) };
  }));

  // Anúncios: preço, estoque por variação e giro (vendas dos últimos 90 dias) → cobertura em dias
  app.get('/api/shopee/anuncios', H(q => {
    const lojas = lojasSp(q), ph = lojas.map(() => '?').join(','), h = brHoje();
    const v = calcularShopee({ lojas, desde: iso(new Date(h - 89 * 864e5)) });
    const vend = Object.fromEntries(v.skus.map(s => [s.sku, s]));
    const lista = [];
    for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='sp_item' AND status=200 AND loja IN (${ph})`).all(...lojas)) {
      const it = JSON.parse(r.body), modelos = it.modelos?.model || [];
      const linhas = modelos.length ? modelos : [{ model_id: 0, model_name: '', model_sku: it.item_sku, price_info: it.price_info, stock_info_v2: it.stock_info_v2 }];
      for (const m of linhas) {
        const sku = String(m.model_sku || it.item_sku || it.item_id).trim(), preco = m.price_info?.[0]?.current_price ?? it.price_info?.[0]?.current_price ?? null;
        const estoque = m.stock_info_v2?.summary_info?.total_available_stock ?? it.stock_info_v2?.summary_info?.total_available_stock ?? null, s = vend[sku];
        const un90 = s?.unidades || 0, giro = un90 / 90;
        lista.push({ loja: r.loja, nome: NOMES[r.loja], item: it.item_id, modelo: m.model_id, titulo: it.item_name, variacao: m.model_name || '', sku, status: it.item_status, preco, estoque, thumb: it.image?.image_url_list?.[0] || null,
          unidades90: un90, receita90: s?.receita || 0, lucro90: s?.lucro || 0, margem: s?.margem ?? null, semCusto: s ? s.semCusto : null, cobertura: giro > 0 && estoque != null ? estoque / giro : null, ads: (m.has_promotion || it.has_promotion) ? 'promo' : '' });
      }
    }
    return { lista: lista.sort((a, b) => b.receita90 - a.receita90), pedidosPeriodo: v.total.pedidos };
  }));

  app.get('/api/shopee/promocoes', H(q => {
    const lojas = lojasSp(q), ph = lojas.map(() => '?').join(',');
    const out = [];
    for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='sp_promo' AND status=200 AND loja IN (${ph})`).all(...lojas)) {
      const b = JSON.parse(r.body), [tipo, status] = r.chave.split('_'), l = b.discount_list || b.voucher_list || b.add_on_deal_list || [];
      for (const x of l) out.push({ loja: r.loja, nome: NOMES[r.loja], tipo, status, id: x.discount_id || x.voucher_id || x.add_on_deal_id, titulo: x.discount_name || x.voucher_name || x.add_on_deal_name, inicio: x.start_time, fim: x.end_time, bruto: x });
    }
    return { lista: out.sort((a, b) => (b.inicio || 0) - (a.inicio || 0)) };
  }));

  // Consolidado ML + Shopee: mesmo período, mesma conta (loja<n> + shopee<n>)
  app.get('/api/consolidado', H(q => {
    const { desde, n } = janela(q), sel = LOJAS[q.loja] ? q.loja : null;
    const mlL = sel ? [sel] : Object.keys(LOJAS), spL = sel ? [spDe(sel)].filter(l => NOMES[l]) : Object.keys(NOMES);
    const M = calcular({ lojas: mlL, desde }), S = calcularShopee({ lojas: spL, desde });
    const mlT = M.total, spT = S.total;
    const norm = (t, canal) => ({ canal, pedidos: t.pedidos, receita: t.receita, devolucao: t.devolucao, comissao: t.comissao, frete: t.frete, imposto: t.imposto, custo: t.custo, ads: (t.ads || 0) + (t.adsSemVenda || 0), outros: (t.ajustes || 0), lucro: t.lucroFinal, margem: t.receita ? t.lucroFinal / t.receita : 0 });
    const canais = [norm(mlT, 'ml'), norm(spT, 'shopee')];
    const soma = k => canais.reduce((s, c) => s + c[k], 0), tot = Object.fromEntries(['pedidos', 'receita', 'devolucao', 'comissao', 'frete', 'imposto', 'custo', 'ads', 'outros', 'lucro'].map(k => [k, soma(k)]));
    tot.margem = tot.receita ? tot.lucro / tot.receita : 0;
    const dia = {};
    for (const d of M.diario) { const x = dia[d.dia] ||= { dia: d.dia, ml: 0, shopee: 0, lml: 0, lsp: 0 }; x.ml += d.receita; x.lml += d.lucro; }
    for (const d of S.diario) { const x = dia[d.dia] ||= { dia: d.dia, ml: 0, shopee: 0, lml: 0, lsp: 0 }; x.shopee += d.receita; x.lsp += d.lucro; }
    const mes = {};
    for (const m of M.porMes) { const x = mes[m.mes] ||= { mes: m.mes, ml: { receita: 0, lucro: 0, pedidos: 0 }, shopee: { receita: 0, lucro: 0, pedidos: 0 } }; x.ml.receita += m.receita; x.ml.pedidos += m.pedidos; x.ml.lucro += m.lucro - (m.adsSemVenda || 0) - (m.perdaDevolucao || 0); }
    for (const m of S.porMes) { const x = mes[m.mes] ||= { mes: m.mes, ml: { receita: 0, lucro: 0, pedidos: 0 }, shopee: { receita: 0, lucro: 0, pedidos: 0 } }; x.shopee.receita += m.receita; x.shopee.pedidos += m.pedidos; x.shopee.lucro += m.lucro; }
    const sku = {};
    for (const [canal, L] of [['ml', M.skus], ['shopee', S.skus]]) for (const s of L) { const x = sku[s.sku] ||= { sku: s.sku, titulo: s.titulo, unidades: 0, receita: 0, lucro: 0, ml: 0, shopee: 0, semCusto: false }; x.unidades += s.unidades; x.receita += s.receita; x.lucro += s.lucro; x[canal] += s.receita; x.semCusto ||= s.semCusto; }
    const skus = Object.values(sku).map(s => ({ ...s, margem: s.receita ? s.lucro / s.receita : 0 })).sort((a, b) => b.receita - a.receita);
    return { dias: n, desde, canais, total: tot, diario: Object.values(dia).sort((a, b) => a.dia.localeCompare(b.dia)), porMes: Object.values(mes).sort((a, b) => a.mes.localeCompare(b.mes)), skus: skus.slice(0, 40),
      cobertura: { ml: M.cobertura.pctReceitaSemCusto, shopee: S.cobertura.pctReceitaSemCusto } };
  }));
}

// Alertas da Shopee (somados aos do ML na tela Alertas). `lojasMl` = lojas selecionadas no filtro (loja1/loja2).
export function alertasShopee(lojasMl) {
  const lojas = lojasMl.map(spDe).filter(l => NOMES[l]), A = [];
  if (!lojas.length) return A;
  const add = (nivel, titulo, detalhe, view, itens = []) => A.push({ nivel, titulo: '[Shopee] ' + titulo, detalhe, view, itens });
  const h = brHoje(), d30 = iso(new Date(h - 29 * 864e5)), d90 = iso(new Date(h - 89 * 864e5));
  const R30 = calcularShopee({ lojas, desde: d30 }), R90 = calcularShopee({ lojas, desde: d90 });
  const ph = lojas.map(() => '?').join(','), N = l => NOMES[l]?.replace(' (Shopee)', '') || l, r2 = n => Math.round(n * 100) / 100;

  const prej = R30.skus.filter(s => !s.semCusto && s.lucro < 0).sort((a, b) => a.lucro - b.lucro);
  if (prej.length) add('alta', `${prej.length} produto(s) vendendo com PREJUÍZO (30 dias)`, `Perda somada: R$ ${r2(-prej.reduce((t, s) => t + s.lucro, 0))}. Reveja preço, frete, Ads ou pause.`, 'shopeeprodutos',
    prej.slice(0, 12).map(s => ({ texto: s.titulo, extra: `lucro R$ ${r2(s.lucro)} em ${s.unidades} un.`, loja: s.lojas.map(N).join('/') })));
  const sc = R30.skus.filter(s => s.semCusto).sort((a, b) => b.receita - a.receita);
  if (sc.length) add('media', `${sc.length} produto(s) vendidos SEM custo cadastrado`, `Representam ${(100 * R30.cobertura.pctReceitaSemCusto).toFixed(0)}% da receita da Shopee — o lucro mostrado está superestimado.`, 'custos',
    sc.slice(0, 10).map(s => ({ texto: s.titulo, extra: `receita R$ ${r2(s.receita)} · SKU ${s.sku}`, loja: s.lojas.map(N).join('/') })));

  // estoque: variação ativa que vende e vai acabar (ou já zerou)
  const giro = Object.fromEntries(R90.skus.map(s => [s.sku, s.unidades / 90])), rupt = [];
  for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='sp_item' AND status=200 AND loja IN (${ph})`).all(...lojas)) {
    const it = JSON.parse(r.body); if (it.item_status !== 'NORMAL') continue;
    for (const m of it.modelos?.model || []) {
      const sku = String(m.model_sku || it.item_sku || it.item_id).trim(), est = m.stock_info_v2?.summary_info?.total_available_stock, g = giro[sku] || 0;
      if (est != null && g >= 0.3 && est / g < 15) rupt.push({ texto: `${it.item_name}${m.model_name ? ' (' + m.model_name + ')' : ''}`, extra: `estoque ${est} · vende ${g.toFixed(1)}/dia → ${Math.floor(est / g)} dia(s)`, loja: N(r.loja), dias: est / g });
    }
  }
  rupt.sort((a, b) => a.dias - b.dias);
  if (rupt.length) add(rupt[0].dias < 7 ? 'alta' : 'media', `${rupt.length} variação(ões) com estoque para menos de 15 dias`, 'Estoque por variação, pelo giro dos últimos 90 dias.', 'shopeeanuncios', rupt.slice(0, 12));

  // pedidos a enviar com prazo vencido ou vencendo hoje
  const agora = Date.now() / 1000, atr = [];
  for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='sp_order' AND status=200 AND loja IN (${ph}) AND json_extract(body,'$.order_status') IN ('READY_TO_SHIP','PROCESSED')`).all(...lojas)) {
    const o = JSON.parse(r.body); if (o.ship_by_date && o.ship_by_date < agora + 6 * 3600) atr.push({ texto: `Pedido ${o.order_sn}`, extra: o.ship_by_date < agora ? `prazo de envio vencido há ${Math.round((agora - o.ship_by_date) / 3600)} h` : 'prazo de envio vence em poucas horas', loja: N(r.loja), venc: o.ship_by_date });
  }
  if (atr.length) add('alta', `${atr.length} pedido(s) com prazo de envio vencido ou vencendo`, 'Atraso no envio gera penalidade e piora a reputação na Shopee.', 'shopeepedidos', atr.sort((a, b) => a.venc - b.venc).slice(0, 12));

  // Ads
  const ads = db.prepare(`SELECT body FROM raw WHERE recurso='sp_ads_shop' AND status=200 AND loja IN (${ph}) AND chave >= ?`).all(...lojas, d30).map(r => JSON.parse(r.body)), gasto = ads.reduce((t, x) => t + (x.expense || 0), 0), gmv = ads.reduce((t, x) => t + (x.broad_gmv || 0), 0);
  if (gasto >= 50 && R30.total.receita && gasto / R30.total.receita > 0.1) add('media', `Ads consumindo ${(100 * gasto / R30.total.receita).toFixed(1)}% do faturamento (30 dias)`, `Gasto R$ ${r2(gasto)} · vendas por Ads R$ ${r2(gmv)} (ROAS ${(gasto ? gmv / gasto : 0).toFixed(1)}x).`, 'shopeeads');
  const saldo = db.prepare(`SELECT loja, body FROM raw WHERE recurso='sp_ads_saldo' AND status=200 AND loja IN (${ph})`).all(...lojas).filter(r => (JSON.parse(r.body).total_balance ?? 99) < 20);
  if (saldo.length) add('media', 'Saldo de Ads baixo', saldo.map(r => `${N(r.loja)}: R$ ${r2(JSON.parse(r.body).total_balance)}`).join(' · ') + ' — os anúncios param quando o saldo acaba.', 'shopeeads');

  // devoluções e coleta
  const taxa = R30.total.pedidos ? R30.total.qtdDevolucoes / R30.total.pedidos : 0;
  if (taxa > 0.04) add('media', `Taxa de devolução em ${(100 * taxa).toFixed(1)}% (30 dias)`, `${R30.total.qtdDevolucoes} devolução(ões) efetivada(s) em ${R30.total.pedidos} pedidos.`, 'shopeedev');
  for (const l of lojas) {
    const u = db.prepare("SELECT MAX(coletado_em) t FROM raw WHERE loja=? AND recurso='sp_order'").get(l)?.t;
    if (!u || Date.now() - u > 30 * 60e3) add('alta', `${N(l)}: coleta de pedidos da Shopee PARADA`, u ? `Última coleta há ${Math.round((Date.now() - u) / 60e3)} min. Verifique se o servidor está ligado e se o sistema antigo (renova o token da Shopee) está rodando.` : 'Nenhuma coleta feita ainda.', 'cobertura');
  }
  return A;
}
