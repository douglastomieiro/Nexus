// Coletores Shopee (pedido + escrow + devolução). Guarda a resposta crua em `raw` (recursos sp_*), loja = shopee1|shopee2.
// Só leitura na Shopee. Incremental: depois da 1ª carga só busca o que mudou (update_time).
import { SHOPEE, spGet } from './shopee.js';
import { saveRaw, getRaw, logColeta } from './db.js';

const DIA = 86400, JANELA = 14 * DIA; // a Shopee limita o intervalo de busca a 15 dias
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const OPT = 'item_list,payment_method,total_amount,buyer_username,package_list,actual_shipping_fee,estimated_shipping_fee,pay_time,cancel_reason,buyer_cancel_reason,note,shipping_carrier,reverse_shipping_fee,order_chargeable_weight_gram,edt,create_time,update_time';
const ok = r => r.status === 200 && !r.body?.error;

function ctx(loja) {
  const st = { chamadas: 0, ok: 0, erros: 0 }, log = (...a) => console.log(`[${loja}]`, ...a);
  const get = async (p, params, o) => { const r = await spGet(loja, p, params, o); st.chamadas++; ok(r) ? st.ok++ : st.erros++; if (!ok(r)) log('✖', p, r.status, r.body?.error || '', r.body?.message || ''); return r; };
  return { loja, st, log, get };
}

// ───── pedidos: lista (janelas de 14 dias, por update_time) → detalhe (50 por chamada) → escrow (50 por chamada)
async function pedidos(c, { meses, force }) {
  const agora = Math.floor(Date.now() / 1000);
  const marca = getRaw(c.loja, 'sp_sync', 'pedidos')?.body;
  const ini = force || !marca ? agora - Math.round(meses * 30.44 * DIA) : Math.max(marca.ts - 3600, agora - 30 * DIA);
  const sns = new Set();
  for (let a = ini; a < agora; a += JANELA) {
    const b = Math.min(a + JANELA, agora); let cursor = '';
    for (;;) {
      const r = await c.get('/api/v2/order/get_order_list', { time_range_field: 'update_time', time_from: a, time_to: b, page_size: 100, ...(cursor ? { cursor } : {}) });
      if (!ok(r)) return c.log('lista de pedidos falhou; marca de sync mantida'), false;
      (r.body.response?.order_list || []).forEach(o => sns.add(o.order_sn));
      if (!r.body.response?.more) break; cursor = r.body.response.next_cursor;
    }
  }
  c.log(`pedidos alterados desde ${new Date(ini * 1000).toISOString().slice(0, 10)}: ${sns.size}`);
  const ped = [];
  let falhou = false;
  for (const part of chunk([...sns], 50)) {
    const r = await c.get('/api/v2/order/get_order_detail', { order_sn_list: part, response_optional_fields: OPT });
    if (!ok(r)) { falhou = true; continue; }
    for (const o of r.body.response?.order_list || []) { saveRaw(c.loja, 'sp_order', o.order_sn, 'get_order_detail', 200, o); ped.push(o); }
  }
  // escrow: pedidos pagos. Pedido COMPLETED com escrow coletado depois da última atualização já está definitivo.
  const precisa = ped.filter(o => {
    if (!o.pay_time) return false;
    const ex = getRaw(c.loja, 'sp_escrow', o.order_sn);
    return force || !ex || ex.status !== 200 || !(o.order_status === 'COMPLETED' && ex.coletado_em > o.update_time * 1000);
  });
  for (const part of chunk(precisa.map(o => o.order_sn), 50)) {
    const r = await c.get('/api/v2/payment/get_escrow_detail_batch', {}, { body: { order_sn_list: part } });
    if (!ok(r)) { falhou = true; continue; }
    for (const x of r.body.response || []) {
      const e = x.escrow_detail; if (e?.order_sn && !x.error) saveRaw(c.loja, 'sp_escrow', e.order_sn, 'get_escrow_detail_batch', 200, e);
      else if (x.error) c.log('escrow', x.order_sn, x.error);
    }
  }
  if (!falhou) saveRaw(c.loja, 'sp_sync', 'pedidos', '', 200, { ts: agora });
  return true;
}

// ───── devoluções: por criação (janelas de 14 dias); no incremental só os últimos 60 dias (status muda depois)
async function devolucoes(c, { meses, force }) {
  const agora = Math.floor(Date.now() / 1000), marca = getRaw(c.loja, 'sp_sync', 'devolucoes')?.body;
  const ini = force || !marca ? agora - Math.round(meses * 30.44 * DIA) : agora - 60 * DIA;
  let n = 0, falhou = false;
  for (let a = ini; a < agora; a += JANELA) {
    const b = Math.min(a + JANELA, agora);
    for (let pg = 0; ; pg++) {
      const r = await c.get('/api/v2/returns/get_return_list', { page_no: pg, page_size: 100, create_time_from: a, create_time_to: b });
      if (!ok(r)) { falhou = true; break; }
      for (const x of r.body.response?.return || []) { saveRaw(c.loja, 'sp_return', x.return_sn, 'get_return_list', 200, x); n++; }
      if (!r.body.response?.more) break;
    }
  }
  c.log(`devoluções: ${n}`);
  if (!falhou) saveRaw(c.loja, 'sp_sync', 'devolucoes', '', 200, { ts: agora });
}

// ───── Ads (CPC): gasto diário da loja + por campanha (com os anúncios de cada campanha), últimos 90 dias (a API limita 1 mês por chamada)
const ddmmyyyy = ts => { const x = new Date(ts * 1000 - 3 * 3600e3); return `${String(x.getUTCDate()).padStart(2, '0')}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${x.getUTCFullYear()}`; };
const isoDia = s => s.split('-').reverse().join('-');
async function ads(c) {
  const agora = Math.floor(Date.now() / 1000), janelas = [[agora - 29 * DIA, agora], [agora - 59 * DIA, agora - 30 * DIA], [agora - 89 * DIA, agora - 60 * DIA]];
  let falhou = false;
  const ids = [];
  for (let off = 0; ; off += 100) {
    const r = await c.get('/api/v2/ads/get_product_level_campaign_id_list', { ad_type: 'all', offset: off, limit: 100 });
    if (!ok(r)) return c.log('campanhas de Ads indisponíveis'), false;
    (r.body.response?.campaign_list || []).forEach(x => ids.push(x.campaign_id));
    if (!r.body.response?.has_next_page) break;
  }
  const camp = {};
  for (const part of chunk(ids, 100)) {
    const r = await c.get('/api/v2/ads/get_product_level_campaign_setting_info', { info_type_list: '1,3', campaign_id_list: part });
    if (!ok(r)) { falhou = true; continue; }
    for (const x of r.body.response?.campaign_list || []) camp[x.campaign_id] = { id: x.campaign_id, nome: x.common_info?.ad_name, tipo: x.common_info?.ad_type, status: x.common_info?.campaign_status, local: x.common_info?.campaign_placement, orcamento: x.common_info?.campaign_budget, itens: x.common_info?.item_id_list || [], dias: {} };
  }
  for (const [a, b] of janelas) {
    const sh = await c.get('/api/v2/ads/get_all_cpc_ads_daily_performance', { start_date: ddmmyyyy(a), end_date: ddmmyyyy(b) });
    if (ok(sh)) for (const d of sh.body.response || []) saveRaw(c.loja, 'sp_ads_shop', isoDia(d.date), '', 200, d); else falhou = true;
    for (const part of chunk(ids, 100)) {
      const r = await c.get('/api/v2/ads/get_product_campaign_daily_performance', { start_date: ddmmyyyy(a), end_date: ddmmyyyy(b), campaign_id_list: part });
      if (!ok(r)) { falhou = true; continue; }
      for (const x of r.body.response?.campaign_list || []) for (const m of x.metrics_list || []) if (m.expense || m.impression) (camp[x.campaign_id] ||= { id: x.campaign_id, itens: [], dias: {} }).dias[isoDia(m.date)] = m;
    }
  }
  for (const k of Object.values(camp)) saveRaw(c.loja, 'sp_ads_campaign', k.id, '', 200, k);
  const bal = await c.get('/api/v2/ads/get_total_balance', {}); if (ok(bal)) saveRaw(c.loja, 'sp_ads_saldo', 'saldo', '', 200, bal.body.response);
  c.log(`ads: ${ids.length} campanhas${falhou ? ' (com falhas)' : ''}`);
}

// ───── anúncios: lista + dados básicos (50 por chamada) + variações (preço, SKU, estoque)
async function itens(c) {
  const ids = [];
  for (const st of ['NORMAL', 'UNLIST', 'BANNED', 'REVIEWING']) for (let off = 0; ; ) {
    const r = await c.get('/api/v2/product/get_item_list', { offset: off, page_size: 100, item_status: st });
    if (!ok(r)) break;
    (r.body.response?.item || []).forEach(i => ids.push(i.item_id));
    if (!r.body.response?.has_next_page) break; off = r.body.response.next_offset;
  }
  const base = {};
  for (const part of chunk(ids, 50)) {
    const r = await c.get('/api/v2/product/get_item_base_info', { item_id_list: part, need_complaint_policy: false, need_tax_info: false });
    if (ok(r)) for (const i of r.body.response?.item_list || []) { delete i.description; base[i.item_id] = i; }
  }
  for (const id of ids) {
    if (!base[id]) continue;
    const m = await c.get('/api/v2/product/get_model_list', { item_id: id });
    saveRaw(c.loja, 'sp_item', id, '', 200, { ...base[id], modelos: ok(m) ? m.body.response : null });
  }
  c.log(`anúncios: ${ids.length}`);
}

// ───── promoções: descontos, cupons e combos (guarda as listas cruas; vazio é normal)
async function promocoes(c) {
  for (const st of ['ongoing', 'upcoming', 'expired']) {
    const d = await c.get('/api/v2/discount/get_discount_list', { discount_status: st, page_no: 1, page_size: 100 });
    if (ok(d)) saveRaw(c.loja, 'sp_promo', 'discount_' + st, '', 200, d.body.response);
    const v = await c.get('/api/v2/voucher/get_voucher_list', { page_no: 1, page_size: 100, status: st === 'expired' ? 'expired' : st });
    if (ok(v)) saveRaw(c.loja, 'sp_promo', 'voucher_' + st, '', 200, v.body.response);
    const a = await c.get('/api/v2/add_on_deal/get_add_on_deal_list', { promotion_status: st, page_no: 1, page_size: 100 });
    if (ok(a)) saveRaw(c.loja, 'sp_promo', 'addon_' + st, '', 200, a.body.response);
  }
}

export const MODULOS_SP = { pedidos, devolucoes, ads, itens, promocoes };
const rodando = new Set();
export async function rodarShopee(modulos = Object.keys(MODULOS_SP), { lojas = Object.keys(SHOPEE), force = false, meses = 12 } = {}) {
  await Promise.all(lojas.map(async loja => {
    for (const m of modulos) {
      const key = loja + ':' + m; if (rodando.has(key)) { console.log(`[${loja}] ${m} ainda em execução, pulando`); continue; }
      rodando.add(key); const c = ctx(loja), t0 = Date.now();
      try { await MODULOS_SP[m](c, { meses, force }); } catch (e) { c.log(`✖ ${m}:`, e.message); c.st.erros++; }
      finally { rodando.delete(key); }
      logColeta({ loja, modulo: m, inicio: t0, fim: Date.now(), chamadas: c.st.chamadas, ok: c.st.ok, erros: c.st.erros, obs: null });
      c.log(`✔ ${m} ${((Date.now() - t0) / 1000).toFixed(1)}s | chamadas ${c.st.chamadas} ok ${c.st.ok} erros ${c.st.erros}`);
    }
  }));
}
