// Gestão de Produtos › Recompra: por SKU, vendas do período (Mercado Livre + Shopee), estoque dos anúncios e o que comprar.
// Estoque próprio: anúncios do mesmo SKU fora do Full mostram o mesmo estoque físico (o seu depósito) → conta o MAIOR deles, não a soma.
// Full: estoque guardado no depósito do Mercado Livre, separado por anúncio → soma.
// O anúncio do ML não traz o SKU de cada variação: ele vem dos pedidos (anúncio + variação → seller_sku).
// A sugestão de compra (dias de cobertura, prazo do fornecedor, segurança) é calculada na tela, que tem esses campos.
import { db } from './db.js';
import { listarSkus, skuDe, getCustos } from './margem.js';
import { calcularShopee } from './shopee-margem.js';
import { SHOPEE } from './shopee.js';

const r2 = n => Math.round(n * 100) / 100;
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

// estoque de cada anúncio (ou variação/modelo) ativo ou pausado, com o SKU dele
function estoques(lojas, spLojas, add) {
  const varSku = skuDaVariacao();
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
  if (!spLojas.length) return;
  for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='sp_item' AND status=200 AND loja IN (${spLojas.map(() => '?').join(',')})`).all(...spLojas)) {
    const b = JSON.parse(r.body);
    if (b.item_status !== 'NORMAL' && b.item_status !== 'UNLIST') continue;
    const base = { canal: 'Shopee', loja: r.loja, anuncio: String(b.item_id), full: !!b.is_fulfillment_by_shopee, pausado: b.item_status === 'UNLIST' };
    for (const m of b.modelos?.model || []) {
      const sku = String(m.model_sku || '').trim() || String(b.item_sku || '').trim() || String(b.item_id); // mesma regra do cálculo da Shopee
      add(sku, { ...base, variacao: m.model_name || '', qtd: m.stock_info_v2?.summary_info?.total_available_stock ?? 0 });
    }
  }
}

export function recompra({ lojas, dias }) {
  const agora = Date.now() - 3 * 3600e3, desde = n => new Date(agora - (n - 1) * 864e5).toISOString().slice(0, 10);
  const spLojas = Object.keys(SHOPEE).filter(k => lojas.includes('loja' + SHOPEE[k].n)); // Shopee da mesma empresa das contas do filtro
  const custos = getCustos(), P = {};
  const linha = (sku, titulo) => (P[sku] ||= { sku, titulo, variacao: '', canais: new Set(), unidades: 0, receita: 0, unidades30: 0 });
  for (const s of listarSkus(lojas, desde(dias))) { const p = linha(s.sku, s.titulo); p.unidades += s.unidades; p.receita += s.receita; p.variacao ||= s.variacao || ''; p.canais.add('ML'); }
  for (const s of listarSkus(lojas, desde(30))) linha(s.sku, s.titulo).unidades30 += s.unidades;
  if (spLojas.length) {
    for (const s of calcularShopee({ lojas: spLojas, desde: desde(dias) }).skus) { const p = linha(s.sku, s.titulo); p.unidades += s.unidades; p.receita += s.receita; p.variacao ||= s.variacao || ''; p.canais.add('Shopee'); }
    for (const s of calcularShopee({ lojas: spLojas, desde: desde(30) }).skus) linha(s.sku, s.titulo).unidades30 += s.unidades;
  }
  const E = {};
  estoques(lojas, spLojas, (sku, a) => (E[sku] ||= []).push(a));
  // curva ABC pelo faturamento do período: A = até 80% do faturamento, B = até 95%, C = o resto
  const L = Object.values(P).filter(p => p.unidades > 0 || p.unidades30 > 0).sort((a, b) => b.receita - a.receita);
  const tot = L.reduce((t, p) => t + p.receita, 0); let ac = 0;
  return {
    dias,
    linhas: L.map(p => {
      ac += p.receita; const an = E[p.sku] || [];
      return { sku: p.sku, titulo: p.titulo, variacao: p.variacao, canais: [...p.canais], unidades: p.unidades, receita: r2(p.receita), unidades30: p.unidades30,
        estoqueProprio: Math.max(0, ...an.filter(a => !a.full).map(a => a.qtd)), estoqueFull: an.filter(a => a.full).reduce((t, a) => t + a.qtd, 0),
        anuncios: an.slice(0, 12), semAnuncio: !an.length, custo: custos[p.sku] ?? null, classe: !tot || ac - p.receita < tot * 0.8 ? 'A' : ac - p.receita < tot * 0.95 ? 'B' : 'C' };
    }),
  };
}
