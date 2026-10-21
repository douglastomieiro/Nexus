// Recompra (Gestão de Produtos › Tabela de Produtos): estoque dos anúncios e vendas dos últimos 30 dias por SKU, somando Mercado Livre e Shopee.
// Estoque próprio: anúncios do mesmo SKU fora do Full mostram o mesmo estoque físico (o seu depósito) → conta o MAIOR deles, não a soma.
// Full: estoque guardado no depósito do Mercado Livre, separado por anúncio → soma.
// O anúncio do ML não traz o SKU de cada variação: ele vem dos pedidos (anúncio + variação → seller_sku).
// A decisão (repor / só o mínimo / não repor) e a quantidade são calculadas na tela, que tem os parâmetros.
import { db } from './db.js';
import { listarSkus, skuDe } from './margem.js';
import { calcularShopee } from './shopee-margem.js';
import { SHOPEE } from './shopee.js';

// contas da Shopee da mesma empresa das contas do ML do filtro (shopee<n> ↔ loja<n>)
export const shopeeDoFiltro = lojas => Object.keys(SHOPEE).filter(k => lojas.includes('loja' + SHOPEE[k].n));

const cacheVar = { t: 0, v: null };
// `${loja}:${anúncio}:${variação}` → SKU vendido (guardado por 10 min: varre os pedidos)
function skuDaVariacao() {
  if (cacheVar.v && Date.now() - cacheVar.t < 600e3) return cacheVar.v;
  const m = {};
  for (const r of db.prepare(`SELECT loja, json_extract(j.value,'$.item.id') item, json_extract(j.value,'$.item.variation_id') v, json_extract(j.value,'$.item.seller_sku') sku
      FROM raw, json_each(body,'$.order_items') j WHERE recurso='order' AND status=200 AND json_extract(j.value,'$.item.variation_id') IS NOT NULL`).all())
    if (r.sku && String(r.sku).trim()) m[`${r.loja}:${r.item}:${r.v}`] = String(r.sku).trim();
  cacheVar.t = Date.now(); cacheVar.v = m;
  return m;
}

// { sku: { proprio, full, anuncios: [{ canal, loja, anuncio, variacao, qtd, full, pausado }] } } — anúncios ativos ou pausados
export function estoquePorSku(lojas, spLojas) {
  const E = {}, add = (sku, a) => (E[sku] ||= []).push(a), varSku = skuDaVariacao();
  for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='item' AND status=200 AND loja IN (${lojas.map(() => '?').join(',')})`).all(...lojas)) {
    const b = JSON.parse(r.body);
    if (b.status !== 'active' && b.status !== 'paused') continue;
    const full = b.shipping?.logistic_type === 'fulfillment', vs = b.variations || [], base = { canal: 'ML', loja: r.loja, anuncio: r.chave, full, pausado: b.status === 'paused' };
    if (!vs.length) add(skuDe(r.loja, { id: r.chave }), { ...base, qtd: b.available_quantity || 0 });
    else for (const v of vs) {
      const sku = varSku[`${r.loja}:${r.chave}:${v.id}`] || (vs.length === 1 ? skuDe(r.loja, { id: r.chave }) : null);
      if (sku) add(sku, { ...base, variacao: (v.attribute_combinations || []).map(a => a.value_name).join(' / '), qtd: v.available_quantity || 0 });
    }
  }
  if (spLojas.length) for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='sp_item' AND status=200 AND loja IN (${spLojas.map(() => '?').join(',')})`).all(...spLojas)) {
    const b = JSON.parse(r.body);
    if (b.item_status !== 'NORMAL' && b.item_status !== 'UNLIST') continue;
    const base = { canal: 'Shopee', loja: r.loja, anuncio: String(b.item_id), full: !!b.is_fulfillment_by_shopee, pausado: b.item_status === 'UNLIST' };
    for (const m of b.modelos?.model || []) {
      const sku = String(m.model_sku || '').trim() || String(b.item_sku || '').trim() || String(b.item_id); // mesma regra do cálculo da Shopee
      add(sku, { ...base, variacao: m.model_name || '', qtd: m.stock_info_v2?.summary_info?.total_available_stock ?? 0 });
    }
  }
  return Object.fromEntries(Object.entries(E).map(([sku, an]) => [sku, {
    proprio: Math.max(0, ...an.filter(a => !a.full).map(a => a.qtd)), full: an.filter(a => a.full).reduce((t, a) => t + a.qtd, 0), anuncios: an.slice(0, 12),
  }]));
}

// { sku: unidades vendidas nos últimos 30 dias } (ML + Shopee)
export function vendas30(lojas, spLojas) {
  const desde = new Date(Date.now() - 3 * 3600e3 - 29 * 864e5).toISOString().slice(0, 10), V = {};
  for (const s of listarSkus(lojas, desde)) V[s.sku] = (V[s.sku] || 0) + s.unidades;
  if (spLojas.length) for (const s of calcularShopee({ lojas: spLojas, desde }).skus) V[s.sku] = (V[s.sku] || 0) + s.unidades;
  return V;
}
