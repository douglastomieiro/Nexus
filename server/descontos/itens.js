// Lista os anúncios da conta ao vivo (com preço real vigente, preço sem desconto e SKUs). Portado do sistema DESCONTOS.
import { req } from './ml.js';

const TTL_PRECOS = 30 * 60e3, TTL_SKU = 60 * 60e3;
const cachePrecos = new Map(), cacheSku = new Map();

async function mapConc(ids, fn, conc) {
  const out = new Map(); let i = 0;
  await Promise.all(Array.from({ length: Math.min(conc, ids.length) }, async () => {
    while (i < ids.length) { const id = ids[i++]; const v = await fn(id); if (v != null) out.set(id, v); }
  }));
  return out;
}

// /items/{id}/prices guarda promoções que não aparecem no preço do item (loyalty, Mercado Pago, cart…)
function parsePrices(data) {
  if (!data || !Array.isArray(data.prices)) return null;
  const now = Date.now();
  // só vale preço sem restrição de canal ou com "channel_marketplace" (ignora o do Mercado Shops) e dentro da validade
  const vale = p => {
    const ctx = p.conditions?.context_restrictions;
    if (Array.isArray(ctx) && ctx.length && !ctx.includes('channel_marketplace')) return false;
    const s = p.conditions?.start_time ? Date.parse(p.conditions.start_time) : NaN, e = p.conditions?.end_time ? Date.parse(p.conditions.end_time) : NaN;
    return !(isFinite(s) && now < s) && !(isFinite(e) && now > e);
  };
  let regular = null, regularTs = -Infinity, promo = null, promoRegular = null;
  for (const p of data.prices) {
    const amt = typeof p.amount === 'number' ? p.amount : parseFloat(p.amount);
    if (!isFinite(amt) || amt <= 0 || !vale(p)) continue;
    const type = String(p.type || '').toLowerCase(), ts = p.last_updated ? Date.parse(p.last_updated) : 0;
    if (type === 'standard' || p.id === 'regular' || type === 'regular') { if (regular == null || ts >= regularTs) { regular = amt; regularTs = ts; } }
    else if (['promotion', 'promotional', 'deal'].includes(type) && (promo == null || amt < promo)) {
      promo = amt; const ra = typeof p.regular_amount === 'number' ? p.regular_amount : parseFloat(p.regular_amount); promoRegular = isFinite(ra) && ra > 0 ? ra : null;
    }
  }
  if (regular == null && promoRegular != null) regular = promoRegular;
  return { regular, promo };
}

async function precosDe(id, token, fresh) {
  const c = cachePrecos.get(id);
  if (!fresh && c && Date.now() - c.t < TTL_PRECOS) return c.v;
  let v = null;
  try { v = parsePrices((await req(token, 'GET', `/items/${id}/prices`, { timeout: 8000 })).data); } catch { /* sem preços: usa o do item */ }
  cachePrecos.set(id, { v, t: Date.now() });
  return v;
}

const skuUP = up => { const a = up?.attributes?.find(x => x.id === 'SELLER_SKU'); return a?.values?.[0]?.name ? String(a.values[0].name).trim() : null; };
async function skuDeUP(id, token) {
  const c = cacheSku.get(id);
  if (c && Date.now() - c.t < TTL_SKU) return c.v;
  let v = null;
  try { v = skuUP((await req(token, 'GET', `/user-products/${id}`, { timeout: 10000 })).data); } catch { /* ignora */ }
  cacheSku.set(id, { v, t: Date.now() });
  return v;
}

function skuDoNo(n) {
  if (!n) return null;
  if (n.seller_custom_field) return String(n.seller_custom_field).trim();
  if (n.seller_custom_sku) return String(n.seller_custom_sku).trim();
  const a = Array.isArray(n.attributes) && n.attributes.find(x => x.id === 'SELLER_SKU');
  return a?.value_name ? String(a.value_name).trim() : null;
}
// [{ label (variação ou null), sku }]
function skuPairs(item, upSku) {
  const pairs = [], vistos = new Set();
  const push = (label, sku) => { if (sku && !vistos.has(sku)) { vistos.add(sku); pairs.push({ label: label || null, sku }); } };
  push(null, skuDoNo(item) || (item.user_product_id && upSku.get(item.user_product_id)) || null);
  for (const v of item.variations || []) {
    const sku = skuDoNo(v) || (v.user_product_id && upSku.get(v.user_product_id)) || null;
    if (sku) push((v.attribute_combinations || []).map(a => a?.value_name ? String(a.value_name).trim() : null).filter(Boolean).join(' / '), sku);
  }
  return pairs;
}

export async function listarAnuncios({ seller, token, status = 'active', fresh = false }) {
  const ids = [];
  let offset = 0, scroll = null, usarScroll = false;
  for (;;) {
    const params = { limit: 100 };
    if (status && status !== 'all') params.status = status;
    if (usarScroll) { params.search_type = 'scan'; if (scroll) params.scroll_id = scroll; } else params.offset = offset;
    const d = (await req(token, 'GET', `/users/${seller}/items/search`, { params, timeout: 20000 })).data, lote = d.results || [];
    ids.push(...lote);
    if (!usarScroll) { if (offset + lote.length >= (d.paging?.total ?? 0)) break; offset += lote.length; if (offset >= 1000) { usarScroll = true; scroll = null; } }
    else { scroll = d.scroll_id; if (!scroll || !lote.length) break; }
    if (!lote.length) break;
  }
  const brutos = [];
  for (let i = 0; i < ids.length; i += 20) {
    const r = (await req(token, 'GET', '/items', { params: { ids: ids.slice(i, i + 20).join(',') }, timeout: 30000 })).data;
    for (const w of r || []) if (w.code === 200 && w.body) brutos.push(w.body);
  }
  const ups = new Set();
  for (const b of brutos) { if (b.user_product_id) ups.add(b.user_product_id); for (const v of b.variations || []) if (v.user_product_id) ups.add(v.user_product_id); }
  const upSku = ups.size ? await mapConc([...ups], id => skuDeUP(id, token), 10) : new Map();
  const precos = brutos.length ? await mapConc(brutos.map(b => b.id), id => precosDe(id, token, fresh), 20) : new Map();
  return brutos.map(b => {
    let atual = b.price, base = b.original_price != null ? b.original_price : b.price;
    const px = precos.get(b.id);
    if (px && px.regular != null) { base = px.regular; if (px.promo != null && px.promo < px.regular) atual = px.promo; }
    const pares = skuPairs(b, upSku);
    return { id: b.id, title: b.title, skus: pares.map(p => p.sku), skuPairs: pares, price: atual, originalPrice: atual < base ? base : null, basePrice: base,
      available: b.available_quantity, sold: b.sold_quantity ?? null, thumbnail: b.thumbnail, status: b.status, permalink: b.permalink,
      listingType: b.listing_type_id || null, logisticType: b.shipping?.logistic_type || null, categoryId: b.category_id || null };
  });
}
