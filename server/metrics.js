// Nexus Metrics › Meu negócio: visão do dia, projeção do mês, categorias, performance por anúncio, clientes, qualidade dos anúncios e crescimento.
// Tudo sai do que a coleta já guarda (pedidos, anúncios, visitas, envios, qualidade do anúncio, perguntas e reputação): nada novo é buscado no ML.
import { db } from './db.js';
import { calcular } from './margem.js';
import { LOG, hoje, addDias, diaBR, r2, janela, cacheDe, envios } from './painel.js';

const TIPO = { gold_pro: 'Premium', gold_premium: 'Premium', gold_special: 'Clássico', gold: 'Clássico', free: 'Grátis' };
const mesIni = d => d.slice(0, 8) + '01';
const mesAnt = m => { const [y, mm] = m.split('-').map(Number); return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`; };
const diasNoMes = m => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
const fimMes = m => `${m}-${String(diasNoMes(m)).padStart(2, '0')}`;
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const share = (a, b) => (b ? a / b : 0);

// anúncio → dados que o painel não guarda no cache dele (catálogo, tipo, vendidos históricos, SKU, data de criação)
const itensMeta = cacheDe(300e3, () => {
  const m = {};
  for (const r of db.prepare(`SELECT loja, chave, json_extract(body,'$.title') titulo, json_extract(body,'$.thumbnail') t, json_extract(body,'$.category_id') cat,
      json_extract(body,'$.status') st, json_extract(body,'$.catalog_listing') catalogo, json_extract(body,'$.listing_type_id') tipo, json_extract(body,'$.sold_quantity') vendidos,
      json_extract(body,'$.price') preco, json_extract(body,'$.available_quantity') estoque, json_extract(body,'$.shipping.logistic_type') lg, json_extract(body,'$.permalink') link,
      json_extract(body,'$.seller_custom_field') sku, json_extract(body,'$.date_created') criado, json_extract(body,'$.health') saude,
      json_extract(body,'$.catalog_product_id') prod, json_extract(body,'$.user_product_id') up
      FROM raw WHERE recurso='item' AND status=200`).iterate())
    m[r.loja + ':' + r.chave] = { titulo: r.titulo, thumb: r.t ? r.t.replace('http://', 'https://') : null, cat: r.cat, status: r.st, catalogo: !!r.catalogo, tipo: TIPO[r.tipo] || r.tipo || null,
      vendidos: r.vendidos ?? null, preco: r.preco, estoque: r.estoque, lg: r.lg ? (LOG[r.lg] || 'Padrão') : null, link: r.link, sku: r.sku, criado: r.criado, saude: r.saude, prod: r.prod, up: r.up };
  return m;
});

// categoria → nome e caminho (path_from_root) dos anúncios coletados
const catInfo = cacheDe(600e3, () => {
  const m = {};
  for (const r of db.prepare(`SELECT chave, body FROM raw WHERE recurso='category' AND status=200`).iterate()) {
    const c = parse(r.body) || {}, path = (c.path_from_root || []).map(p => p.name);
    m[r.chave] = { nome: c.name || r.chave, raiz: path[0] || c.name || r.chave, caminho: path.join(' › ') || c.name || r.chave };
  }
  return m;
});
const cat = id => catInfo()[id] || { nome: id || 'Sem categoria', raiz: id || 'Sem categoria', caminho: id || 'Sem categoria' };

// visitas por dia: por anúncio (série de 90 dias, renovada a cada 6h) e somadas por loja; antes do início da série dos anúncios, a série da conta (150 dias)
const visitas = cacheDe(120e3, () => {
  const porItem = {}, porLoja = {};
  for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='item_visits' AND status=200`).iterate()) {
    const s = {}; for (const x of parse(r.body)?.results || []) { const d = String(x.date).slice(0, 10); s[d] = x.total || 0; const l = porLoja[r.loja] ||= {}; l[d] = (l[d] || 0) + (x.total || 0); }
    porItem[r.loja + ':' + r.chave] = s;
  }
  for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='visitas_conta_dia' AND status=200`).iterate()) {
    const l = porLoja[r.loja] ||= {}, ini = Object.keys(l).sort()[0] || '9999';
    for (const x of parse(r.body)?.results || []) { const d = String(x.date).slice(0, 10); if (d < ini) l[d] = x.total || 0; }
  }
  return { porItem, porLoja };
});
const visLoja = (lojas, ini, fim) => lojas.reduce((t, l) => t + Object.entries(visitas().porLoja[l] || {}).reduce((s, [d, v]) => s + (d >= ini && d <= fim ? v : 0), 0), 0);
const visItem = (k, ini, fim) => Object.entries(visitas().porItem[k] || {}).reduce((s, [d, v]) => s + (d >= ini && d <= fim ? v : 0), 0);
const temVisitas = lojas => lojas.some(l => Object.keys(visitas().porLoja[l] || {}).length);

// soma de pedidos (já sem cancelados) com o recorte de catálogo e logística que o Nubimetrics mostra em cada card
function somaPedidos(peds) {
  const meta = itensMeta(), env = envios(), t = { receita: 0, pedidos: 0, unidades: 0, catalogo: 0, unCatalogo: 0, full: 0, flex: 0, frete: 0, comFrete: 0 };
  for (const p of peds) {
    t.receita += p.receita; t.pedidos++; t.unidades += p.qtd || 0;
    for (const d of p.det) if (meta[p.loja + ':' + d.item]?.catalogo) { t.catalogo += d.receita; t.unCatalogo += d.qtd; }
    const lg = env[p.loja + ':' + p.id]?.lg; if (lg === 'Full') t.full += p.receita; if (lg === 'Flex') t.flex += p.receita;
    if (p.frete > 0) { t.frete += p.frete; t.comFrete++; }
  }
  return { ...t, receita: r2(t.receita), catalogo: r2(t.catalogo), frete: r2(t.frete), ticket: t.pedidos ? t.receita / t.pedidos : 0, freteMedio: t.comFrete ? t.frete / t.comFrete : 0,
    pctCatalogo: share(t.catalogo, t.receita), pctFull: share(t.full, t.receita), pctFlex: share(t.flex, t.receita) };
}
// curva diária acumulada do mês (dia 1..N)
const acumulado = (peds, m) => { const v = Array(diasNoMes(m)).fill(0); for (const p of peds) { const d = diaBR(p.data); if (d.startsWith(m)) v[+d.slice(8) - 1] += p.receita; } let a = 0; return v.map(x => r2(a += x)); };
// anúncios que somam 80% do faturamento (Pareto)
const pareto = linhas => { const ord = linhas.filter(x => x.receita > 0).sort((a, b) => b.receita - a.receita), tot = ord.reduce((t, x) => t + x.receita, 0); let ac = 0; const s = new Set();
  for (const x of ord) { if (ac / tot >= 0.8) break; ac += x.receita; s.add(x.k); } return s; };

export function registrar(app, { H, lojasSel, dias }) {
  // ── Visão do dia ──
  app.get('/api/nm/dia', H(q => {
    const lojas = lojasSel(q), hj = hoje(), m = hj.slice(0, 7), mp = mesAnt(m), ontem = addDias(hj, -1), i30 = addDias(hj, -30);
    const cur = calcular({ lojas, desde: `${mp}-01` }), P = cur.pedidosTodos, dDe = p => diaBR(p.data);
    const hojeP = P.filter(p => dDe(p) === hj), u30 = P.filter(p => dDe(p) >= i30 && dDe(p) <= ontem), mesP = P.filter(p => dDe(p).startsWith(m)), antP = P.filter(p => dDe(p).startsWith(mp));
    const antAteHoje = antP.filter(p => +dDe(p).slice(8) <= +hj.slice(8)), s30 = somaPedidos(u30);
    const ph = lojas.map(() => '?').join(','), cancPorDia = {};
    for (const r of db.prepare(`SELECT date(json_extract(body,'$.date_created'),'-3 hours') d, json_extract(body,'$.total_amount') v FROM raw WHERE recurso='order' AND status=200 AND loja IN (${ph})
      AND json_extract(body,'$.status')='cancelled' AND date(json_extract(body,'$.date_created'),'-3 hours') >= ?`).iterate(...lojas, i30)) cancPorDia[r.d] = (cancPorDia[r.d] || 0) + (r.v || 0);
    const cancel30 = Object.entries(cancPorDia).filter(([d]) => d < hj).reduce((t, [, v]) => t + v, 0);
    // atendimento e reputação (o que a coleta já guarda)
    const perguntas = db.prepare(`SELECT COUNT(*) n FROM raw WHERE recurso='question' AND status=200 AND loja IN (${ph}) AND json_extract(body,'$.status')='UNANSWERED'`).get(...lojas).n;
    const resposta = db.prepare(`SELECT loja, body FROM raw WHERE recurso='user_questions_response_time' AND status=200 AND loja IN (${ph})`).all(...lojas).map(r => ({ loja: r.loja, ...parse(r.body) }));
    const reput = db.prepare(`SELECT loja, json_extract(body,'$.seller_reputation') rep FROM raw WHERE recurso='user' AND status=200 AND loja IN (${ph})`).all(...lojas).map(r => ({ loja: r.loja, ...(parse(r.rep) || {}) }));
    return {
      hoje: hj, mes: m, mesAnterior: mp, dia: +hj.slice(8), diasMes: diasNoMes(m), temVisitas: temVisitas(lojas),
      hojeT: { ...somaPedidos(hojeP), visitas: visLoja(lojas, hj, hj), cancelado: r2(cancPorDia[hj] || 0) },
      media30: { receita: s30.receita / 30, pedidos: s30.pedidos / 30, unidades: s30.unidades / 30, visitas: visLoja(lojas, i30, ontem) / 30, cancelado: cancel30 / 30 },
      mesT: somaPedidos(mesP), anteriorT: somaPedidos(antP), anteriorAteHoje: somaPedidos(antAteHoje),
      curva: { atual: acumulado(mesP, m).slice(0, +hj.slice(8)), anterior: acumulado(antP, mp) },
      perguntas, resposta, reputacao: reput,
    };
  }));

  // ── Projete suas vendas (mês atual ou escolhido) ──
  app.get('/api/nm/projecao', H(q => {
    const lojas = lojasSel(q), hj = hoje(), m = /^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : hj.slice(0, 7), mp = mesAnt(m), atual = m === hj.slice(0, 7);
    const fim = atual ? hj : fimMes(m), cur = calcular({ lojas, desde: `${m}-01`, ate: fim }), prev = calcular({ lojas, desde: `${mp}-01`, ate: fimMes(mp) });
    const P = cur.pedidosTodos, T = somaPedidos(P), A = somaPedidos(prev.pedidosTodos), meta = itensMeta(), env = envios();
    const diaN = atual ? +hj.slice(8) : diasNoMes(m), vis = visLoja(lojas, `${m}-01`, fim);
    const porCat = {}, porTipo = {}, porLg = {}, porCatalogo = { 'Com catálogo': 0, 'Sem catálogo': 0 }, porItem = {}, uf = {};
    for (const p of P) {
      const e = env[p.loja + ':' + p.id], lg = e?.lg || 'Sem dado';
      porLg[lg] = (porLg[lg] || 0) + p.receita;
      if (e?.uf) { const g = uf[e.uf] ||= { uf: e.uf, receita: 0, pedidos: 0 }; g.receita += p.receita; g.pedidos++; }
      for (const d of p.det) {
        const mi = meta[p.loja + ':' + d.item] || {}, raiz = cat(d.categoria || mi.cat).raiz;
        porCat[raiz] = (porCat[raiz] || 0) + d.receita;
        porTipo[mi.tipo || 'Sem dado'] = (porTipo[mi.tipo || 'Sem dado'] || 0) + d.receita;
        porCatalogo[mi.catalogo ? 'Com catálogo' : 'Sem catálogo'] += d.receita;
        const k = p.loja + ':' + d.item; (porItem[k] ||= { k, receita: 0 }).receita += d.receita;
      }
    }
    const lista = o => Object.entries(o).map(([nome, receita]) => ({ nome, receita: r2(receita) })).sort((a, b) => b.receita - a.receita);
    const top = pareto(Object.values(porItem)), nItens = Object.keys(porItem).length;
    // 12 meses (para os gráficos de barras): receita, pedidos e unidades por mês
    const ini12 = mesIni(addDias(`${m}-01`, -334)), ano = calcular({ lojas, desde: ini12, ate: fim }), meses = {};
    for (const p of ano.pedidosTodos) { const k = diaBR(p.data).slice(0, 7), x = meses[k] ||= { mes: k, receita: 0, pedidos: 0, unidades: 0 }; x.receita += p.receita; x.pedidos++; x.unidades += p.qtd || 0; }
    return {
      mes: m, mesAnterior: mp, atual, dia: diaN, diasMes: diasNoMes(m), atual_: T, anterior: A,
      projecao: atual ? (diaN > 1 ? T.receita / diaN * diasNoMes(m) : null) : T.receita,
      visitas: vis, temVisitas: temVisitas(lojas), conversao: vis ? T.unidades / vis : null,
      curva: { atual: acumulado(P, m).slice(0, diaN), anterior: acumulado(prev.pedidosTodos, mp) },
      categorias: lista(porCat), exposicao: lista(porTipo), logistica: lista(porLg), catalogo: lista(porCatalogo),
      pareto: { anuncios: nItens, top: top.size, resto: nItens - top.size }, estados: Object.values(uf).map(x => ({ ...x, receita: r2(x.receita) })).sort((a, b) => b.receita - a.receita),
      meses: Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes)).map(x => ({ ...x, receita: r2(x.receita) })),
    };
  }));

  // ── Analise suas categorias ──
  app.get('/api/nm/categorias', H(q => {
    const lojas = lojasSel(q), w = janela(dias(q)), cur = calcular({ lojas, desde: w.ini }), prev = calcular({ lojas, desde: w.pIni, ate: w.pFim }), meta = itensMeta();
    const linhas = {}, de = id => linhas[id] ||= { id, ...cat(id), receita: 0, unidades: 0, pedidos: new Set(), itens: new Set(), lucro: 0, prevReceita: 0, visitas: 0, ativos: 0 };
    for (const p of cur.pedidosTodos) for (const d of p.det) { const c = de(d.categoria || meta[p.loja + ':' + d.item]?.cat); c.receita += d.receita; c.unidades += d.qtd; c.lucro += d.lucro; c.pedidos.add(p.loja + ':' + p.id); c.itens.add(p.loja + ':' + d.item); }
    for (const p of prev.pedidosTodos) for (const d of p.det) de(d.categoria || meta[p.loja + ':' + d.item]?.cat).prevReceita += d.receita;
    for (const [k, mi] of Object.entries(meta)) { if (!lojas.includes(k.split(':')[0]) || !linhas[mi.cat]) continue; linhas[mi.cat].visitas += visItem(k, w.ini, w.fim); if (mi.status === 'active') linhas[mi.cat].ativos++; }
    const tot = Object.values(linhas).reduce((t, c) => t + c.receita, 0);
    const L = Object.values(linhas).map(c => ({ id: c.id, nome: c.nome, caminho: c.caminho, raiz: c.raiz, receita: r2(c.receita), unidades: c.unidades, pedidos: c.pedidos.size, anuncios: c.itens.size, ativos: c.ativos,
      lucro: r2(c.lucro), margem: c.receita ? c.lucro / c.receita : null, pct: share(c.receita, tot), prevReceita: r2(c.prevReceita), cresc: c.prevReceita ? (c.receita - c.prevReceita) / c.prevReceita : null,
      visitas: c.visitas, conversao: c.visitas ? c.unidades / c.visitas : null })).sort((a, b) => b.receita - a.receita);
    const top = pareto(L.map(x => ({ k: x.id, receita: x.receita })));
    return { desde: w.ini, total: r2(tot), temVisitas: temVisitas(lojas), linhas: L.map(x => ({ ...x, top80: top.has(x.id) })), nTop80: top.size };
  }));

  // ── Performance de vendas (por anúncio), com os anúncios ativos que não venderam ──
  app.get('/api/nm/anuncios', H(q => {
    const lojas = lojasSel(q), w = janela(dias(q)), cur = calcular({ lojas, desde: w.ini }), prev = calcular({ lojas, desde: w.pIni, ate: w.pFim }), meta = itensMeta(), env = envios();
    const pv = Object.fromEntries(prev.porItem.map(p => [p.loja + ':' + p.item, p])), ufs = {};
    for (const p of cur.pedidosTodos) { const u = env[p.loja + ':' + p.id]?.uf; if (u) for (const d of p.det) { const o = ufs[p.loja + ':' + d.item] ||= {}; o[u] = (o[u] || 0) + d.qtd; } }
    const linhas = cur.porItem.map(p => ({ k: p.loja + ':' + p.item, loja: p.loja, item: p.item, sku: p.sku, titulo: p.titulo, categoria: p.categoria, pedidos: p.pedidos, unidades: p.unidades, receita: r2(p.receita), lucro: r2(p.lucro), semCusto: p.semCusto }));
    const vistos = new Set(linhas.map(x => x.k));
    for (const [k, mi] of Object.entries(meta)) if (mi.status === 'active' && lojas.includes(k.split(':')[0]) && !vistos.has(k))
      linhas.push({ k, loja: k.split(':')[0], item: k.split(':')[1], sku: mi.sku, titulo: mi.titulo, categoria: mi.cat, pedidos: 0, unidades: 0, receita: 0, lucro: 0, semCusto: false });
    const tot = linhas.reduce((t, x) => t + x.receita, 0), top = pareto(linhas);
    const out = linhas.map(x => {
      const mi = meta[x.k] || {}, vis = visItem(x.k, w.ini, w.fim), pr = pv[x.k];
      return { ...x, thumb: mi.thumb || null, status: mi.status || null, catalogo: !!mi.catalogo, tipo: mi.tipo || null, lg: mi.lg || null, categoriaNome: cat(x.categoria || mi.cat).nome,
        historico: mi.vendidos, preco: mi.preco, estoque: mi.estoque, ticket: x.unidades ? x.receita / x.unidades : null, pct: share(x.receita, tot), visitas: vis, conversao: vis ? x.unidades / vis : null,
        prevReceita: r2(pr?.receita || 0), cresc: pr?.receita ? (x.receita - pr.receita) / pr.receita : null, top80: top.has(x.k),
        ufs: Object.entries(ufs[x.k] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u, n]) => `${u} (${n})`).join(', ') };
    }).sort((a, b) => b.receita - a.receita);
    const ativos = out.filter(x => x.status === 'active');
    return { desde: w.ini, total: r2(tot), temVisitas: temVisitas(lojas), ativos: ativos.length, ativosComVenda: ativos.filter(x => x.unidades > 0).length, nTop80: top.size, linhas: out };
  }));

  // ── Analise seus clientes ──
  app.get('/api/nm/clientes', H(q => {
    const lojas = lojasSel(q), w = janela(dias(q)), cur = calcular({ lojas, desde: w.ini }), env = envios(), ph = lojas.map(() => '?').join(',');
    // histórico de cada comprador em todos os pedidos coletados (para separar cliente novo de quem já comprou antes)
    const hist = Object.fromEntries(db.prepare(`SELECT json_extract(body,'$.buyer.id') id, COUNT(*) n, MIN(date(json_extract(body,'$.date_created'),'-3 hours')) primeira
      FROM raw WHERE recurso='order' AND status=200 AND loja IN (${ph}) AND json_extract(body,'$.status')!='cancelled' GROUP BY id`).all(...lojas).map(r => [String(r.id), r]));
    const buyerId = Object.fromEntries(db.prepare(`SELECT loja, chave, json_extract(body,'$.buyer.id') b FROM raw WHERE recurso='order' AND status=200 AND loja IN (${ph})
      AND date(json_extract(body,'$.date_created'),'-3 hours') >= ?`).all(...lojas, w.ini).map(r => [r.loja + ':' + r.chave, String(r.b)]));
    const cli = {};
    for (const p of cur.pedidosTodos) {
      const id = buyerId[p.loja + ':' + p.id] || p.comprador || '?', c = cli[id] ||= { id, nome: p.comprador || id, pedidos: 0, unidades: 0, receita: 0, freteVendedor: 0, freteComprador: 0, ufs: new Set(), lojas: new Set(), ultima: '' };
      c.pedidos++; c.unidades += p.qtd || 0; c.receita += p.receita; c.freteVendedor += p.frete; c.freteComprador += p.freteNF; c.lojas.add(p.loja);
      const u = env[p.loja + ':' + p.id]?.uf; if (u) c.ufs.add(u); if (p.data > c.ultima) c.ultima = p.data;
    }
    const L = Object.values(cli).map(c => { const h = hist[c.id]; return { ...c, receita: r2(c.receita), freteVendedor: r2(c.freteVendedor), freteComprador: r2(c.freteComprador), ufs: [...c.ufs].join(', '), lojas: [...c.lojas],
      totalPedidos: h?.n || c.pedidos, primeira: h?.primeira || null, novo: !h || h.primeira >= w.ini, recorrente: (h?.n || c.pedidos) > 1 }; }).sort((a, b) => b.receita - a.receita);
    const tot = L.reduce((t, c) => t + c.receita, 0), rec = L.filter(c => c.recorrente);
    return { desde: w.ini, clientes: L.length, novos: L.filter(c => c.novo).length, recorrentes: rec.length, receitaRecorrentes: r2(rec.reduce((t, c) => t + c.receita, 0)), total: r2(tot),
      ticketCliente: L.length ? tot / L.length : 0, linhas: L.slice(0, 5000) };
  }));

  // ── Otimize seus anúncios: qualidade do ML (/item/{id}/performance) + conversão e peso no faturamento (30 dias) ──
  app.get('/api/nm/otimiza', H(q => {
    const lojas = lojasSel(q), w = janela(30), cur = calcular({ lojas, desde: w.ini }), meta = itensMeta(), ph = lojas.map(() => '?').join(',');
    const pi = Object.fromEntries(cur.porItem.map(p => [p.loja + ':' + p.item, p])), tot = cur.porItem.reduce((t, p) => t + p.receita, 0);
    const perf = Object.fromEntries(db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='item_performance' AND status=200 AND loja IN (${ph})`).all(...lojas).map(r => [r.loja + ':' + r.chave, parse(r.body)]));
    const pendencias = b => { const out = []; for (const bk of b?.buckets || []) for (const v of bk.variables || []) for (const ru of v.rules || []) if (ru.status && ru.status !== 'COMPLETED')
      out.push({ grupo: bk.title || bk.key, titulo: ru.wordings?.title || v.title || ru.key, link: ru.wordings?.link || null }); return out; };
    const ativos = Object.entries(meta).filter(([k, mi]) => mi.status === 'active' && lojas.includes(k.split(':')[0]));
    const linhas = ativos.map(([k, mi]) => {
      const p = pi[k], b = perf[k], vis = visItem(k, w.ini, w.fim), un = p?.unidades || 0;
      return { k, loja: k.split(':')[0], item: k.split(':')[1], titulo: mi.titulo, thumb: mi.thumb, catalogo: mi.catalogo, lg: mi.lg, tipo: mi.tipo, sku: mi.sku,
        score: b?.score ?? null, nivel: b?.level_wording || b?.level || null, pendencias: pendencias(b), saude: mi.saude ?? null,
        visitas: vis, unidades: un, receita: r2(p?.receita || 0), pct: share(p?.receita || 0, tot), conversao: vis ? un / vis : null };
    });
    // conversão mediana dos anúncios com visita: base para dizer se a conversão de cada um está acima ou abaixo da sua própria loja
    const conv = linhas.filter(x => x.visitas >= 30 && x.conversao != null).map(x => x.conversao).sort((a, b) => a - b), med = conv.length ? conv[Math.floor(conv.length / 2)] : null;
    for (const x of linhas) {
      x.eficiencia = med && x.conversao != null && x.visitas >= 30 ? x.conversao / med : null;
      // prioridade: quanto o anúncio pesa no faturamento (ou nas visitas) × o quanto falta de qualidade
      x.prioridade = (x.score == null ? 0.5 : (100 - x.score) / 100) * (x.pct + share(x.visitas, linhas.reduce((t, y) => t + y.visitas, 0)));
    }
    const com = linhas.filter(x => x.score != null);
    return { desde: w.ini, ativos: linhas.length, comQualidade: com.length, mediaScore: com.length ? com.reduce((t, x) => t + x.score, 0) / com.length : null, conversaoMediana: med,
      pendentes: com.filter(x => x.pendencias.length).length, linhas: linhas.sort((a, b) => b.prioridade - a.prioridade) };
  }));

  // ── Crescimento mês a mês (seu negócio) ──
  app.get('/api/nm/crescimento', H(q => {
    const lojas = lojasSel(q), hj = hoje(), m = hj.slice(0, 7), ini = mesIni(addDias(`${m}-01`, -365)), cur = calcular({ lojas, desde: ini }), meta = itensMeta();
    const meses = {}, porCat = {};
    for (const p of cur.pedidosTodos) {
      const k = diaBR(p.data).slice(0, 7), x = meses[k] ||= { mes: k, receita: 0, pedidos: 0, unidades: 0, lucro: 0, clientes: new Set() };
      x.receita += p.receita; x.pedidos++; x.unidades += p.qtd || 0; x.lucro += p.lucro; x.clientes.add(p.comprador);
      for (const d of p.det) { const c = cat(d.categoria || meta[p.loja + ':' + d.item]?.cat).raiz, o = porCat[c] ||= {}; o[k] = (o[k] || 0) + d.receita; }
    }
    const L = Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes)).map((x, i, a) => {
      const ant = a[i - 1], yoy = a.find(y => y.mes === `${+x.mes.slice(0, 4) - 1}${x.mes.slice(4)}`), parcial = x.mes === m;
      // mês corrente: compara pelo ritmo (projeção pelo número de dias), não pelo total parcial
      const base = parcial ? x.receita / +hj.slice(8) * diasNoMes(m) : x.receita, vis = visLoja(lojas, `${x.mes}-01`, parcial ? hj : fimMes(x.mes));
      return { mes: x.mes, parcial, receita: r2(x.receita), projecao: parcial ? r2(base) : null, pedidos: x.pedidos, unidades: x.unidades, lucro: r2(x.lucro), clientes: x.clientes.size, ticket: x.pedidos ? x.receita / x.pedidos : 0,
        mom: ant?.receita ? (base - ant.receita) / ant.receita : null, yoy: yoy?.receita ? (base - yoy.receita) / yoy.receita : null, visitas: vis || null, conversao: vis ? x.unidades / vis : null };
    });
    const mesesK = L.map(x => x.mes), cats = Object.entries(porCat).map(([nome, o]) => ({ nome, total: Object.values(o).reduce((t, v) => t + v, 0), meses: mesesK.map(k => r2(o[k] || 0)) }))
      .sort((a, b) => b.total - a.total).slice(0, 8);
    return { meses: L, categorias: cats, temVisitas: temVisitas(lojas) };
  }));

  // ═════════ Mercado (Fase 2): Top buscas e Mais vendidos ═════════
  // O ML informa só a POSIÇÃO (palavras mais buscadas e top 20 de cada categoria), nunca o volume. As fotos diárias guardadas pela coleta
  // (<recurso>_hist, chave <chave>|<dia>) permitem dizer o que subiu, caiu ou entrou desde o dia anterior.
  const ultimo = (lojas, rec, chave) => db.prepare(`SELECT body, coletado_em FROM raw WHERE recurso=? AND status=200 AND loja IN (${lojas.map(() => '?').join(',')}) ${chave ? 'AND chave=?' : ''}
    ORDER BY coletado_em DESC LIMIT 1`).get(rec, ...lojas, ...(chave ? [chave] : []));
  const fotos = (lojas, rec, chave) => { const m = {};
    for (const r of db.prepare(`SELECT chave, body FROM raw WHERE recurso=? AND status=200 AND loja IN (${lojas.map(() => '?').join(',')}) AND chave LIKE ?`).iterate(rec + '_hist', ...lojas, `${chave || '%'}|%`)) m[r.chave.slice(-10)] = parse(r.body);
    return m; };
  // foto de hoje (a mais recente) e a do último dia ANTES dela
  const hojeEantes = (lojas, rec, chave) => {
    const u = ultimo(lojas, rec, chave); if (!u) return null;
    const dia = diaBR(new Date(u.coletado_em).toISOString()), F = fotos(lojas, rec, chave), dAnt = Object.keys(F).filter(d => d < dia).sort().at(-1);
    return { atual: parse(u.body), dia, coletado: u.coletado_em, anterior: dAnt ? F[dAnt] : null, diaAnterior: dAnt || null, fotos: F };
  };
  const catsCom = (lojas, rec) => [...new Set(db.prepare(`SELECT chave FROM raw WHERE recurso=? AND status=200 AND loja IN (${lojas.map(() => '?').join(',')})`).all(rec, ...lojas).map(r => r.chave))]
    .map(id => ({ id, ...cat(id) }));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const VAZIAS = new Set(['para', 'com', 'sem', 'de', 'da', 'do', 'das', 'dos', 'em', 'e', 'a', 'o', 'p', 'c']);

  app.get('/api/nm/buscas', H(q => {
    const lojas = lojasSel(q), cats = catsCom(lojas, 'trends_category').sort((a, b) => a.nome.localeCompare(b.nome)), id = cats.some(c => c.id === q.cat) ? q.cat : '';
    const R = hojeEantes(lojas, id ? 'trends_category' : 'trends_mlb', id || null);
    // seus anúncios ativos: a busca está "coberta" quando algum título tem todas as palavras dela
    const titulos = Object.entries(itensMeta()).filter(([k, mi]) => mi.status === 'active' && lojas.includes(k.split(':')[0])).map(([, mi]) => ' ' + norm(mi.titulo) + ' ');
    const cobre = kw => { const t = norm(kw).split(' ').filter(w => w && !VAZIAS.has(w)); return t.length ? titulos.filter(x => t.every(w => x.includes(' ' + w) || x.includes(w + ' '))).length : 0; };
    const posDe = lista => Object.fromEntries((Array.isArray(lista) ? lista : []).map((x, i) => [norm(x.keyword), i + 1]));
    const ant = R?.anterior ? posDe(R.anterior) : null;
    const lista = (Array.isArray(R?.atual) ? R.atual : []).map((x, i) => { const p = ant?.[norm(x.keyword)];
      return { pos: i + 1, keyword: x.keyword, url: x.url, anterior: p ?? null, delta: p ? p - (i + 1) : null, novo: !!ant && !p, anuncios: cobre(x.keyword) }; });
    // ranking do período: as buscas que mais apareceram nas fotos dos últimos 30 dias
    const ini = addDias(hoje(), -29), hist = {}; let nFotos = 0;
    for (const [d, f] of Object.entries(R?.fotos || {})) { if (d < ini || !Array.isArray(f)) continue; nFotos++;
      f.forEach((x, i) => { const h = hist[norm(x.keyword)] ||= { keyword: x.keyword, url: x.url, dias: 0, soma: 0, melhor: 99 }; h.dias++; h.soma += i + 1; h.melhor = Math.min(h.melhor, i + 1); }); }
    const periodo = Object.values(hist).map(h => ({ keyword: h.keyword, url: h.url, dias: h.dias, media: h.soma / h.dias, melhor: h.melhor, anuncios: cobre(h.keyword) }))
      .sort((a, b) => b.dias - a.dias || a.media - b.media).slice(0, 50);
    return { categorias: cats, cat: id, nome: id ? cat(id).caminho : 'Todo o Mercado Livre', dia: R?.dia || null, diaAnterior: R?.diaAnterior || null, fotos: nFotos, lista, periodo };
  }));

  app.get('/api/nm/maisvendidos', H(q => {
    const lojas = lojasSel(q), meta = Object.entries(itensMeta()).filter(([k]) => lojas.includes(k.split(':')[0])).map(([, mi]) => mi);
    const meusProd = new Set(meta.map(m => m.prod).filter(Boolean)), meusUp = new Set(meta.map(m => m.up).filter(Boolean));
    const ph = lojas.map(() => '?').join(','), eu = new Set(db.prepare(`SELECT body FROM raw WHERE recurso='user_me' AND status=200 AND loja IN (${ph})`).all(...lojas).map(r => String(parse(r.body)?.id)));
    const meuNoTop = x => (x.type === 'PRODUCT' && meusProd.has(x.id)) || (x.type === 'USER_PRODUCT' && meusUp.has(x.id));
    const cats = catsCom(lojas, 'highlights_category').map(c => { const h = parse(ultimo(lojas, 'highlights_category', c.id)?.body); return { ...c, meus: (h?.content || []).filter(meuNoTop).length }; })
      .sort((a, b) => b.meus - a.meus || a.nome.localeCompare(b.nome));
    const id = cats.some(c => c.id === q.cat) ? q.cat : cats[0]?.id;
    const R = id ? hojeEantes(lojas, 'highlights_category', id) : null;
    const det = (rec, k) => parse(db.prepare(`SELECT body FROM raw WHERE recurso=? AND chave=? AND status=200 ORDER BY coletado_em DESC LIMIT 1`).get(rec, k)?.body);
    const ant = Object.fromEntries((R?.anterior?.content || []).map(x => [x.id, x.position]));
    const lista = (R?.atual?.content || []).map(x => {
      const d = det(x.type === 'PRODUCT' ? 'product' : 'user_product', x.id) || {}, bb = d.buy_box_winner, p = ant[x.id], nome = d.name || d.title || null;
      return { pos: x.position, id: x.id, tipo: x.type === 'PRODUCT' ? 'Catálogo' : x.type === 'USER_PRODUCT' ? 'Anúncio' : x.type, nome, thumb: (d.pictures?.[0]?.url || d.thumbnail || '').replace('http://', 'https://') || null,
        preco: bb?.price ?? d.price ?? null, meu: meuNoTop(x), ganhaBuyBox: !!bb && eu.has(String(bb.seller_id)), detalhe: !!nome,
        link: d.permalink || (x.type === 'PRODUCT' ? `https://www.mercadolivre.com.br/p/${x.id}` : nome ? `https://lista.mercadolivre.com.br/${encodeURIComponent(nome)}` : null),
        anterior: p ?? null, delta: p ? p - x.position : null, novo: !!R?.anterior && !p };
    });
    return { categorias: cats, cat: id || null, nome: id ? cat(id).caminho : null, dia: R?.dia || null, diaAnterior: R?.diaAnterior || null, lista };
  }));
}
