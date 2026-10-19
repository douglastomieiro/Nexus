// Coletores v2 — paralelos, incrementais e só com detalhe do que está em aberto.
// O resto (detalhe de pedido/envio/reclamação antigos) é buscado sob demanda em /api/live.
import { mlGet } from './ml.js';
import { db, saveRaw, getRaw, listRaw } from './db.js';

const MIN = 60e3, HORA = 60 * MIN, DIA = 24 * HORA;
const CONC = 6;
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const iso = ts => new Date(ts).toISOString().replace('Z', '-00:00');
const brDate = (d, end) => `${d.toISOString().slice(0, 10)}T${end ? '23:59:59.999' : '00:00:00.000'}-03:00`;
const FINAL = new Set(['delivered', 'not_delivered', 'cancelled']);
const ok2xx = s => s >= 200 && s < 300;
const NEG = new Set([400, 403, 404, 409, 422]);
const NEG_TTL = 12 * HORA; // quanto tempo lembrar que um endpoint respondeu erro definitivo

// Executa fn sobre a lista com N tarefas simultâneas
export async function pool(list, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => {
    while (i < list.length) { const idx = i++; try { await fn(list[idx], idx); } catch (e) { console.error('pool:', e.message); } }
  }));
}

export function ctx(loja, opts, user) {
  const st = { chamadas: 0, ok: 0, erros: 0 };
  const log = (...a) => console.log(`[${loja}]`, ...a);
  async function fetchSave(recurso, chave, path, { maxAge = 0, minGap, retries, headers } = {}) {
    if (!opts.force && maxAge) {
      const ex = getRaw(loja, recurso, chave);
      if (ex && ok2xx(ex.status) && Date.now() - ex.coletado_em < maxAge) return ex.body;
      // cache negativo: erro "definitivo" (400/403/404/409) não é repetido a cada ciclo
      if (ex && NEG.has(ex.status) && Date.now() - ex.coletado_em < Math.min(maxAge, NEG_TTL)) return null;
    }
    const r = await mlGet(loja, path, { minGap, retries, headers });
    st.chamadas++; (ok2xx(r.status) ? st.ok++ : st.erros++);
    saveRaw(loja, recurso, chave, path, r.status, r.body ?? r.error);
    return ok2xx(r.status) ? r.body : null;
  }
  const get = async (path, o) => { const r = await mlGet(loja, path, o); st.chamadas++; (ok2xx(r.status) ? st.ok++ : st.erros++); return r; };
  return { loja, user, opts, st, log, fetchSave, get, since: Date.now() - opts.meses * 30.44 * DIA };
}

// ───────────── CONTA (diário) ─────────────
async function conta(c) {
  const u = c.user, S = (rec, p, k = u) => c.fetchSave(rec, k, p);
  await S('user', `/users/${u}`); await S('user_me', '/users/me');
  const rotas = ['addresses', 'accepted_payment_methods', 'brands', 'applications', 'shipping_preferences', 'available_listing_types',
    'questions/response_time', 'items/search/restrictions', 'invoices/tax_rules', 'invoices/tax_rules/messages',
    'invoices/fiscal_rules/v2/additional-messages', 'stores/search'];
  await pool(rotas, CONC, r => S('user_' + r.replace(/\W+/g, '_'), `/users/${u}/${r}`));
  const hoje = new Date().toISOString().slice(0, 10), ini = new Date(c.since).toISOString().slice(0, 10);
  await Promise.all([
    S('user_bookmarks', '/users/me/bookmarks'), S('seller_recovery', '/users/reputation/seller_recovery/status'),
    S('flex_subscription', `/flex/sites/MLB/users/${u}/subscriptions/v1`), S('exclusion_list', '/seller-promotions/exclusion-list/seller?app_version=v2'),
    S('pricing_automation_items', `/pricing-automation/users/${u}/items`), S('visitas_conta_dia', `/users/${u}/items_visits/time_window?last=150&unit=day`),
    S('visitas_conta_total', `/users/${u}/items_visits?date_from=${ini}&date_to=${hoje}`),
    S('sites', '/sites/MLB'), S('currencies', '/currencies'), S('trends_mlb', '/trends/MLB'),
    S('listing_types', '/sites/MLB/listing_types'), S('shipping_methods', '/sites/MLB/shipping_methods'), S('payment_methods', '/sites/MLB/payment_methods'),
  ]);
}

// ───────────── ANÚNCIOS (horário) ─────────────
async function itens(c) {
  const u = c.user, ids = new Set();
  for (const status of ['active', 'paused', 'closed', 'under_review', 'inactive']) {
    let scroll = null;
    for (;;) {
      const r = await c.get(`/users/${u}/items/search?search_type=scan&limit=100&status=${status}${scroll ? `&scroll_id=${scroll}` : ''}`);
      if (r.status !== 200 || !r.body.results?.length) break;
      scroll = r.body.scroll_id; r.body.results.forEach(i => ids.add(i));
    }
  }
  const all = [...ids];
  saveRaw(c.loja, 'items_ids', 'all', 'scan', 200, all);
  c.log(`anúncios: ${all.length}`);
  // multiget (20 por chamada) em paralelo — já traz preço, estoque, vendidos, atributos, saúde, tipo, logística
  await pool(chunk(all, 20), CONC, async part => {
    const r = await c.get(`/items?ids=${part.join(',')}`);
    if (r.status === 200) for (const it of r.body) if (it.code === 200) saveRaw(c.loja, 'item', it.body.id, 'multiget', 200, it.body);
  });
  // visitas: a API aceita 1 anúncio por chamada → série diária dos últimos 90 dias, renovada a cada 6h
  await pool(all, CONC, id => c.fetchSave('item_visits', id, `/items/${id}/visits/time_window?last=90&unit=day`, { maxAge: 6 * HORA }));
  // preço de venda + promoções: só anúncios ativos (a cada 3h)
  const ativos = listRaw(c.loja, 'item').filter(i => i.body.status === 'active').map(i => i.chave);
  await pool(ativos, CONC, async id => {
    await c.fetchSave('item_sale_price', id, `/items/${id}/sale_price`, { maxAge: 3 * HORA });
    await c.fetchSave('item_promos', id, `/seller-promotions/items/${id}?app_version=v2`, { maxAge: 3 * HORA });
  });
  // dados lentos: 1x por dia
  await pool(ativos, CONC, async id => {
    await c.fetchSave('item_description', id, `/items/${id}/description`, { maxAge: DIA });
    await c.fetchSave('item_fiscal_information', id, `/items/${id}/fiscal_information/detail`, { maxAge: 7 * DIA });
    await c.fetchSave('item_performance', id, `/item/${id}/performance`, { maxAge: DIA });
  });
  // estoque user-products / full
  const itens = listRaw(c.loja, 'item').map(i => i.body);
  await pool(itens.filter(i => i.user_product_id), CONC, async i => {
    await c.fetchSave('user_product', i.user_product_id, `/user-products/${i.user_product_id}`, { maxAge: DIA });
    await c.fetchSave('user_product_stock', i.user_product_id, `/user-products/${i.user_product_id}/stock`, { maxAge: 3 * HORA });
  });
  await pool(itens.filter(i => i.inventory_id), CONC, i =>
    c.fetchSave('inventory_fulfillment', i.inventory_id, `/inventories/${i.inventory_id}/stock/fulfillment`, { maxAge: 3 * HORA }));
}

// ───────────── PEDIDOS (a cada 5 min, incremental) ─────────────
// Devolve false se a janela não pôde ser lida por completo (erro de rede/token/API) — quem chama não avança o marcador de sincronização.
async function pagina(c, base, arq, onRow) {
  let off = 0;
  for (;;) {
    const r = await c.get(`/orders/search${arq}?${base}&limit=51&offset=${off}`);
    if (r.status !== 200) { if (r.status === 404) return true; c.log('orders/search', arq, r.status, JSON.stringify(r.body ?? r.error).slice(0, 100)); return false; }
    for (const o of r.body.results || []) { saveRaw(c.loja, 'order', o.id, 'orders/search', 200, o); onRow?.(o); }
    off += r.body.results?.length || 0;
    if (!r.body.results?.length || off >= (r.body.paging?.total ?? 0)) return true;
  }
}

async function pedidos(c) {
  const u = c.user, meta = getRaw(c.loja, 'meta', 'orders_sync'), inicio = Date.now();
  let falhas = 0;
  if (meta?.body?.ts && !c.opts.force) {
    // incremental: tudo que mudou desde a última sincronização (−15 min de folga), em janelas de 2 dias
    // (a API limita offset+limit a 10.000 por consulta; o filtro correto é order.date_last_updated.*)
    const wins = []; const fim = Date.now();
    for (let a = meta.body.ts - 15 * MIN; a < fim; a += 2 * DIA) wins.push([a, Math.min(a + 2 * DIA, fim)]);
    let n = 0;
    await pool(wins, 4, async ([a, b]) => { if (!await pagina(c, `seller=${u}&order.date_last_updated.from=${encodeURIComponent(iso(a))}&order.date_last_updated.to=${encodeURIComponent(iso(b))}&sort=date_asc`, '', () => n++)) falhas++; });
    c.log(`pedidos alterados: ${n}`);
  } else {
    // carga inicial: janelas semanais em paralelo
    const wins = []; const fim = new Date();
    for (let a = new Date(c.since); a < fim; a = new Date(a.getTime() + 7 * DIA)) wins.push([a, new Date(Math.min(a.getTime() + 7 * DIA - 1000, fim.getTime()))]);
    let n = 0;
    await pool(wins, 4, async ([a, b]) => {
      const base = `seller=${u}&order.date_created.from=${encodeURIComponent(brDate(a))}&order.date_created.to=${encodeURIComponent(brDate(b, true))}&sort=date_asc`;
      if (!await pagina(c, base, '', () => n++)) falhas++; // /orders/search já cobre o histórico todo (o /archived devolve os mesmos pedidos)
    });
    c.log(`pedidos carga inicial: ${n}`);
  }
  // só avança o marcador se TODAS as janelas foram lidas; senão a próxima rodada repete a partir do marcador antigo (nada se perde)
  if (falhas) c.log(`⚠ ${falhas} janela(s) de pedidos falharam — marcador de sincronização mantido para tentar de novo`);
  else saveRaw(c.loja, 'meta', 'orders_sync', '', 200, { ts: inicio });

  // detalhe só do que está EM ABERTO: envios não finalizados dos últimos 90 dias
  const recente = Date.now() - 90 * DIA;
  const envios = [...new Set(listRaw(c.loja, 'order').filter(o => new Date(o.body.date_created).getTime() > recente && o.body.shipping?.id).map(o => o.body.shipping.id))];
  await pool(envios, CONC, async sid => {
    const ex = getRaw(c.loja, 'shipment', sid);
    const final = ex?.status === 200 && FINAL.has(ex.body?.status);
    const s = final ? ex.body : await c.fetchSave('shipment', sid, `/shipments/${sid}`, { maxAge: 20 * MIN });
    if (!s) return;
    await c.fetchSave('shipment_costs', sid, `/shipments/${sid}/costs`, { maxAge: final ? 3650 * DIA : DIA });
    await c.fetchSave('shipment_sla', sid, `/shipments/${sid}/sla`, { maxAge: final ? 3650 * DIA : 20 * MIN });
  });

  // NF-e: só dos pedidos em que o COMPRADOR pagou frete (esse frete entra na nota e, portanto, na base do imposto)
  const comFrete = listRaw(c.loja, 'order').filter(o => new Date(o.body.date_created).getTime() > recente && o.body.shipping?.id
    && (getRaw(c.loja, 'shipment_costs', o.body.shipping.id)?.body?.receiver?.cost || 0) > 0);
  await pool(comFrete, CONC, async o => {
    const ex = getRaw(c.loja, 'invoice', o.chave);
    await c.fetchSave('invoice', o.chave, `/users/${c.user}/invoices/orders/${o.chave}`, { maxAge: ex?.body?.status === 'authorized' ? 3650 * DIA : 30 * MIN });
  });
  c.log(`notas fiscais (frete cobrado do comprador): ${comFrete.length} pedidos`);
}

// ───────────── ATENDIMENTO (a cada 5 min) ─────────────
async function atendimento(c) {
  const u = c.user;
  const salvaQ = r => { for (const q of r.body.questions || []) saveRaw(c.loja, 'question', q.id, 'questions/search', 200, q); return r.body.questions?.length || 0; };
  // perguntas: todas as sem resposta + as 250 mais recentes (as antigas já estão no banco)
  for (const filtro of ['&status=UNANSWERED', '']) {
    for (let off = 0; off < (filtro ? 5000 : 250); ) {
      const r = await c.get(`/questions/search?seller_id=${u}&api_version=4&sort_fields=date_created&sort_types=DESC&limit=50&offset=${off}${filtro}`);
      if (r.status !== 200) break;
      const n = salvaQ(r); off += n;
      if (!n || off >= (r.body.total ?? 0)) break;
    }
  }
  await c.fetchSave('questions_received', u, '/my/received_questions/search');
  const unread = await c.fetchSave('messages_unread', u, '/messages/unread?role=seller&tag=post_sale');

  // reclamações: lista (parando quando passa do período) + detalhe só das abertas ou dos últimos 30 dias
  // A API exige um filtro "real" (status/type/...) além de players.*; por isso itera por status.
  const claims = [], desdeIso = new Date(c.since).toISOString().replace('Z', '+00:00');
  for (const status of ['opened', 'closed']) {
    for (let off = 0; off < 9900; ) {
      const r = await c.get(`/post-purchase/v1/claims/search?players.role=respondent&players.user_id=${u}&status=${status}&range=date_created:after:${desdeIso}&sort=date_created:desc&limit=50&offset=${off}`);
      if (r.status !== 200) { c.log('claims/search', status, r.status, JSON.stringify(r.body).slice(0, 150)); break; }
      const rows = r.body.data || [];
      for (const cl of rows) { saveRaw(c.loja, 'claim', cl.id, 'claims/search', 200, cl); claims.push(cl); }
      off += rows.length;
      if (!rows.length || off >= (r.body.paging?.total ?? 0)) break;
    }
  }
  c.log('reclamações', claims.length);
  const alvo = claims.filter(cl => cl.status !== 'closed' || new Date(cl.date_created).getTime() > Date.now() - 30 * DIA);
  await pool(alvo, CONC, async cl => {
    for (const e of ['detail', 'messages', 'status-history', 'affects-reputation', 'expected-resolutions'])
      await c.fetchSave('claim_' + e, cl.id, `/post-purchase/v1/claims/${cl.id}/${e}`, { maxAge: cl.status === 'closed' ? 3650 * DIA : 30 * MIN });
  });

  // custo de devolução (frete de volta cobrado do vendedor): existe em devoluções E em mediações que terminam com o produto voltando
  await pool(claims.filter(cl => cl.type !== 'cancel_purchase'), CONC, cl =>
    c.fetchSave('claim_return_cost', cl.id, `/post-purchase/v1/claims/${cl.id}/charges/return-cost`, { maxAge: cl.status === 'closed' ? 3650 * DIA : 6 * HORA }));

  // nomes legíveis dos motivos de reclamação (poucos códigos distintos; renovados a cada 30 dias)
  await pool([...new Set(claims.map(cl => cl.reason_id).filter(Boolean))], CONC, id =>
    c.fetchSave('claim_reason', id, `/post-purchase/v1/claims/reasons/${id}`, { maxAge: 30 * DIA }));

  // mensagens pós-venda: só packs com mensagem não lida
  const packs = new Set(JSON.stringify(unread?.results || []).match(/packs\/(\d+)/g)?.map(s => s.slice(6)) || []);
  await pool([...packs], CONC, pk => c.fetchSave('messages_pack', pk, `/messages/packs/${pk}/sellers/${u}?tag=post_sale`, { maxAge: 5 * MIN }));
}

// ───────────── PROMOÇÕES (diário) ─────────────
async function promocoes(c) {
  const u = c.user;
  const precos = new Map(); // anúncio:preço promocional → para consultar a tarifa exata de venda nesse preço
  const lista = await c.fetchSave('promotions_list', u, `/seller-promotions/users/${u}?app_version=v2`);
  await pool(lista?.results || [], 3, async p => {
    await c.fetchSave('promotion', p.id, `/seller-promotions/promotions/${p.id}?promotion_type=${p.type}&app_version=v2`);
    let after = null, page = 0;
    for (;;) {
      const path = `/seller-promotions/promotions/${p.id}/items?promotion_type=${p.type}&app_version=v2&limit=50${after ? `&search_after=${after}` : ''}`;
      const r = await c.get(path);
      if (r.status !== 200) break;
      saveRaw(c.loja, 'promotion_items', `${p.id}:${page++}`, path, 200, r.body);
      for (const it of r.body.results || []) if (it.price) precos.set(it.id + ':' + it.price, it);
      after = r.body.paging?.searchAfter || r.body.paging?.search_after;
      if (!after || !(r.body.results || []).length) break;
    }
  });
  // tarifa de venda (percentual exato) para cada preço promocional — base da margem "se eu participar"
  await pool([...precos.entries()], CONC, async ([k, it]) => {
    const item = getRaw(c.loja, 'item', it.id)?.body; if (!item) return;
    await c.fetchSave('listing_fee', k, `/sites/MLB/listing_prices?price=${it.price}&listing_type_id=${item.listing_type_id}&category_id=${item.category_id}`, { maxAge: 7 * DIA });
  });
  // frete que o vendedor pagará NO PREÇO PROMOCIONAL (cotação do próprio ML, 1 unidade). Necessário porque a partir de R$ 79 o frete
  // grátis é obrigatório: uma promoção que cruza esse limite muda o frete (ex.: R$ 14,45 a R$ 79,90 → R$ 8,45 a R$ 75,90).
  await pool([...precos.entries()], CONC, async ([k, it]) => {
    const item = getRaw(c.loja, 'item', it.id)?.body; if (!item || item.status !== 'active') return; // a API só cota anúncio ativo
    const fs = freteGratisNoPreco(item, it.price);
    await c.fetchSave('frete_cotacao', `${k}:${fs ? 1 : 0}`, `/users/${c.user}/shipping_options/free?item_id=${it.id}&item_price=${it.price}&verbose=true&free_shipping=${fs}`, { maxAge: DIA });
  });
}
// frete grátis no preço p: obrigatório a partir de R$ 79; abaixo disso vale a escolha do anúncio
export const LIMITE_FRETE_GRATIS = 79;
export const freteGratisNoPreco = (item, p) => p >= LIMITE_FRETE_GRATIS || !!item?.shipping?.free_shipping;

// ───────────── CATEGORIAS / TENDÊNCIAS (diário, público) ─────────────
async function categorias(c) {
  await c.fetchSave('categories_tree', 'MLB', '/sites/MLB/categories', { maxAge: 7 * DIA });
  const cats = [...new Set(listRaw(c.loja, 'item').map(i => i.body.category_id).filter(Boolean))];
  await pool(cats, CONC, async id => {
    await c.fetchSave('category', id, `/categories/${id}`, { maxAge: 30 * DIA });
    await c.fetchSave('category_attributes', id, `/categories/${id}/attributes`, { maxAge: 30 * DIA });
    await c.fetchSave('trends_category', id, `/trends/MLB/${id}`, { maxAge: DIA });
    await c.fetchSave('highlights_category', id, `/highlights/MLB/category/${id}`, { maxAge: DIA });
    fotoDoDia(c.loja, 'trends_category', id); fotoDoDia(c.loja, 'highlights_category', id);
  });
  fotoDoDia(c.loja, 'trends_mlb', c.user);
  // Nexus Metrics › Mais vendidos: o /highlights só traz posição e ID; nome, foto e preço vêm do produto de catálogo (ou do user product)
  const prods = new Set(), ups = new Set();
  for (const h of listRaw(c.loja, 'highlights_category')) for (const x of h.body?.content || []) (x.type === 'PRODUCT' ? prods : x.type === 'USER_PRODUCT' ? ups : new Set()).add(x.id);
  await pool([...prods], CONC, id => c.fetchSave('product', id, `/products/${id}`, { maxAge: DIA }));
  await pool([...ups], CONC, id => c.fetchSave('user_product', id, `/user-products/${id}`, { maxAge: DIA }));
  // histórico: guarda 120 dias de fotos
  db.prepare(`DELETE FROM raw WHERE loja=? AND recurso IN ('trends_category_hist','highlights_category_hist','trends_mlb_hist') AND substr(chave,-10) < ?`)
    .run(c.loja, new Date(Date.now() - 120 * DIA).toISOString().slice(0, 10));
}
// foto diária de um recurso (tendências / mais vendidos), para a posição de hoje ser comparada com a dos dias anteriores. Chave: <chave>|<dia de Brasília>
function fotoDoDia(loja, recurso, chave) {
  const ex = getRaw(loja, recurso, chave);
  if (ex?.status === 200) saveRaw(loja, recurso + '_hist', `${chave}|${new Date(ex.coletado_em - 3 * HORA).toISOString().slice(0, 10)}`, '', 200, ex.body);
}

// ───────────── FATURAMENTO / FATURA DO ML (diário; limite de 5 req/min) ─────────────
// 12 períodos (o ABERTO, do mês corrente, + 11 fechados; a API recusa chave com mais de 12 meses) bastam para o DRE.
// Documentos só do período fechado mais recente.
async function faturamento(c) {
  const slow = { minGap: 13000 };
  for (const group of ['ML', 'MP']) {
    const per = await c.fetchSave('billing_periods', group, `/billing/integration/monthly/periods?group=${group}&document_type=BILL&offset=0&limit=12`, slow);
    const primeiroFechado = (per?.results || []).find(p => p.period_status === 'CLOSED')?.key;
    for (const p of per?.results || []) {
      const key = p.key, fechado = p.period_status === 'CLOSED';
      await c.fetchSave('billing_summary', `${group}:${key}`, `/billing/integration/periods/key/${key}/summary/details?document_type=BILL`, { ...slow, maxAge: fechado ? 7 * DIA : 6 * HORA });
      if (key === primeiroFechado) await c.fetchSave('billing_documents', `${group}:${key}`, `/billing/integration/periods/key/${key}/documents?group=${group}&document_type=BILL`, { ...slow, maxAge: DIA });
    }
  }
}

// ───────────── MERCADO ADS — Product Ads (a cada 3h) ─────────────
async function ads(c) {
  const H = { 'Api-Version': '2' }, u = c.user;
  const adv = (await c.fetchSave('ads_advertiser', u, '/advertising/advertisers?product_id=PADS', { headers: { 'Api-Version': '1' } }))?.advertisers?.[0]?.advertiser_id;
  if (!adv) return c.log('sem advertiser de Product Ads');
  const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 89 * DIA).toISOString().slice(0, 10);
  const M = 'clicks,prints,cost,cpc,ctr,acos,roas,cvr,units_quantity,direct_units_quantity,indirect_units_quantity,total_amount,direct_amount,indirect_amount,organic_units_quantity,organic_units_amount';
  const base = `/advertising/MLB/advertisers/${adv}/product_ads`;
  const q = `date_from=${from}&date_to=${to}&metrics=${M}`;
  const paginar = async (path, onRow) => {
    for (let off = 0; ; off += 50) {
      const r = await c.get(`${path}${path.includes('?') ? '&' : '?'}limit=50&offset=${off}`, { headers: H });
      if (r.status !== 200) { c.log('ads', path.replace(base, ''), r.status, JSON.stringify(r.body).slice(0, 120)); return; }
      (r.body.results || []).forEach(onRow);
      if (off + 50 >= (r.body.paging?.total ?? 0)) return;
    }
  };
  const camps = [], anuncios = [];
  await paginar(`${base}/campaigns/search?${q}`, x => { camps.push(x); saveRaw(c.loja, 'ads_campaign', x.id, 'campaigns/search', 200, x); });
  await paginar(`${base}/ads/search?${q}`, x => { anuncios.push(x); saveRaw(c.loja, 'ads_ad', x.item_id, 'ads/search', 200, x); });
  c.log(`ads: ${camps.length} campanhas, ${anuncios.length} anúncios`);
  // série diária da conta (90 dias)
  await c.fetchSave('ads_daily', 'conta', `${base}/ads/search?${q}&aggregation_type=daily&limit=1`, { headers: H });
  // série diária por anúncio que teve custo (usada para ratear o custo de Ads entre os pedidos)
  const comCusto = anuncios.filter(a => (a.metrics?.cost ?? a.cost ?? 0) > 0 && a.campaign_id);
  await pool(comCusto, CONC, a => c.fetchSave('ads_item_daily', a.item_id,
    `${base}/campaigns/${a.campaign_id}/ads/metrics?${q}&aggregation_type=daily&filters[item_ids]=${a.item_id}`, { headers: H, maxAge: 2 * HORA }));
}

// ───────────── HISTÓRICO DE FRETE (carga única + retomável; roda 1x por dia) ─────────────
// O módulo `pedidos` cobre os últimos 90 dias. Aqui buscamos o custo real de envio (e a NF quando o comprador
// pagou frete) dos pedidos MAIS ANTIGOS, para que o lucro dos 12 meses use frete real e não estimativa.
async function historico(c) {
  const corte = Date.now() - 90 * DIA;
  const antigos = listRaw(c.loja, 'order').filter(o => new Date(o.body.date_created).getTime() <= corte && o.body.shipping?.id);
  const envios = [...new Set(antigos.map(o => o.body.shipping.id))];
  let feitos = 0;
  await pool(envios, CONC, async sid => {
    await c.fetchSave('shipment_costs', sid, `/shipments/${sid}/costs`, { maxAge: 3650 * DIA });
    if (++feitos % 1000 === 0) c.log(`frete histórico ${feitos}/${envios.length}`);
  });
  const comFrete = antigos.filter(o => (getRaw(c.loja, 'shipment_costs', o.body.shipping.id)?.body?.receiver?.cost || 0) > 0);
  await pool(comFrete, CONC, async o => {
    const ex = getRaw(c.loja, 'invoice', o.chave);
    await c.fetchSave('invoice', o.chave, `/users/${c.user}/invoices/orders/${o.chave}`, { maxAge: ex?.body?.status === 'authorized' ? 3650 * DIA : 6 * HORA });
  });
  c.log(`histórico: ${envios.length} envios, ${comFrete.length} NFs de frete cobrado do comprador`);
}

// ───────────── PAGAMENTOS NO MERCADO PAGO (devoluções) ─────────────
// O /shipments/{id}/costs mostra o frete COTADO e nunca o estorno. A verdade do que foi cobrado do vendedor e do que o ML devolveu
// está no pagamento do Mercado Pago (charges_details[].amounts.original / refunded). Só leitura, com o mesmo token do ML.
async function pagamentos(c) {
  const alvo = listRaw(c.loja, 'order').filter(o => o.body.status === 'cancelled' && (o.body.payments || []).some(p => (p.transaction_amount_refunded || 0) > 0));
  const ids = [];
  for (const o of alvo) for (const p of o.body.payments || []) if (p.id) ids.push([p.id, new Date(o.body.date_created).getTime()]);
  let n = 0;
  await pool(ids, CONC, async ([pid, criado]) => {
    const ex = getRaw(c.loja, 'mp_payment', pid);
    // estorno ainda pendente (cobrança > estornado) em pedido recente: confere de novo a cada 3h; resolvido ou antigo: guarda por muito tempo
    const aberto = !ex?.body?.charges_details || ex.body.charges_details.some(x => (x.amounts?.original || 0) > (x.amounts?.refunded || 0) + 0.004);
    const maxAge = aberto && Date.now() - criado < 180 * DIA ? 3 * HORA : 3650 * DIA;
    await c.fetchSave('mp_payment', pid, `https://api.mercadopago.com/v1/payments/${pid}`, { maxAge });
    if (++n % 200 === 0) c.log(`pagamentos MP ${n}/${ids.length}`);
  });
  c.log(`pagamentos MP de pedidos cancelados com reembolso: ${ids.length}`);
}

// ───────────── EXTRATO DE COBRANÇAS POR PEDIDO (fatura do ML) ─────────────
// Mesma conta da tela "Detalhe da venda": C* = cobrança, B* = cancelamento. Traz o frete de ida, a tarifa de devolução e a comissão, líquidos de estorno.
// A API limita a 5 chamadas/min, então só buscamos os pedidos em que pode haver perda: cobrança do MP não estornada, custo de devolução > 0 ou sem dado do MP.
async function extrato(c) {
  // pedidos com custo de devolução > 0 (lido UMA vez; antes a lista inteira de reclamações era relida para cada pedido)
  const comRetorno = new Set(listRaw(c.loja, 'claim').filter(cl => cl.body.type !== 'cancel_purchase' && (getRaw(c.loja, 'claim_return_cost', cl.chave)?.body?.amount || 0) > 0)
    .map(cl => String(cl.body.resource_id)));
  const pend = o => {
    const pays = (o.body.payments || []).filter(p => (p.transaction_amount_refunded || 0) > 0).map(p => getRaw(c.loja, 'mp_payment', p.id)?.body);
    if (pays.some(p => !p)) return true;
    if (pays.some(p => (p.charges_details || []).some(x => (x.amounts?.original || 0) > (x.amounts?.refunded || 0) + 0.004))) return true;
    return !!o.body.shipping?.id && comRetorno.has(String(o.chave));
  };
  const alvo = listRaw(c.loja, 'order').filter(o => o.body.status === 'cancelled' && (o.body.payments || []).some(p => (p.transaction_amount_refunded || 0) > 0) && pend(o))
    .sort((a, b) => b.body.date_created.localeCompare(a.body.date_created));
  let n = 0;
  for (const o of alvo) {
    const velho = Date.now() - new Date(o.body.date_created).getTime() > 45 * DIA;
    const ex = getRaw(c.loja, 'billing_order', o.chave);
    if (ex?.status === 200 && Date.now() - ex.coletado_em < (velho ? 3650 * DIA : 3 * HORA)) continue;
    let r = await c.fetchSave('billing_order', o.chave, `/billing/integration/group/ML/order/details?order_ids=${o.chave}`, { minGap: 12500, retries: 0 });
    if (r === null && getRaw(c.loja, 'billing_order', o.chave)?.status === 429) { await new Promise(r => setTimeout(r, 65e3)); r = await c.fetchSave('billing_order', o.chave, `/billing/integration/group/ML/order/details?order_ids=${o.chave}`, { minGap: 12500, retries: 0 }); }
    if (++n % 20 === 0) c.log(`extrato ${n}/${alvo.length}`);
  }
  c.log(`extrato de cobranças por pedido: ${alvo.length} candidatos, ${n} consultados`);
}

export const MODULOS = { conta, itens, pedidos, atendimento, ads, promocoes, categorias, faturamento, historico, pagamentos, extrato };

// Sob demanda: detalhe ao vivo de uma entidade (cache curto), usado pelo dashboard ao abrir um registro
export const LIVE = {
  order: id => [['pedido', `/orders/${id}`], ['descontos', `/orders/${id}/discounts`], ['notas', `/orders/${id}/notes`], ['feedback', `/orders/${id}/feedback`]],
  shipment: id => ['', 'costs', 'sla', 'lead_time', 'history', 'items', 'payments', 'billing_info', 'carrier', 'delays'].map(e => [e || 'envio', `/shipments/${id}${e ? '/' + e : ''}`]),
  item: id => [['anuncio', `/items/${id}`], ['descricao', `/items/${id}/description`], ['precos', `/items/${id}/prices`], ['preco_venda', `/items/${id}/sale_price`],
    ['visitas_30d', `/items/${id}/visits/time_window?last=30&unit=day`], ['performance', `/item/${id}/performance`], ['promocoes', `/seller-promotions/items/${id}?app_version=v2`],
    ['fiscal', `/items/${id}/fiscal_information/detail`], ['catalogo', `/items/${id}/catalog_listing_eligibility`], ['tipos_upgrade', `/items/${id}/available_upgrades`]],
  claim: id => ['', 'detail', 'messages', 'status-history', 'actions-history', 'affects-reputation', 'evidences', 'expected-resolutions', 'changes']
    .map(e => [e || 'reclamacao', `/post-purchase/v1/claims/${id}${e ? '/' + e : ''}`]),
  pack: id => [['pack', `/packs/${id}`]],
};
