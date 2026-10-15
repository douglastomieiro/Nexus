// Margem unitária de um anúncio a um preço qualquer (o preço do desconto), com os mesmos dados da tela Promoções:
// preço − comissão − frete − imposto − custo. Só lê o que o dashboard já coletou; nada é gravado.
import { db } from '../db.js';
import { calcular, getCustos } from '../margem.js';
import { LIMITE_FRETE_GRATIS } from '../collectors.js';

const r2 = n => Math.round(n * 100) / 100;
const diaBR = n => new Date(Date.now() - 3 * 3600e3 - (n - 1) * 864e5).toISOString().slice(0, 10);
const um = (sql, ...a) => db.prepare(sql).get(...a);

let cache = { t: 0, loja: null, v: null };
function base(loja) {
  if (cache.v && cache.loja === loja && Date.now() - cache.t < 60e3) return cache.v;
  const R = calcular({ lojas: [loja], desde: diaBR(90) });
  const un = R.porItem.reduce((t, x) => t + x.unidades, 0);
  const u = R.aliquotasUsadas[loja] || {}, ks = Object.keys(u).sort();
  const v = { porItem: Object.fromEntries(R.porItem.map(x => [x.item, x])), custos: getCustos(), freteGlobal: un ? R.porItem.reduce((t, x) => t + x.frete, 0) / un : 0,
    aliq: ks.length ? u[ks.at(-1)] / 100 : (R.config['aliquota_' + loja] || 0) / 100 };
  cache = { t: Date.now(), loja, v };
  return v;
}

// pares: [{ mlb, preco, skus? }]  (skus = SKUs do anúncio vistos ao vivo, inclusive os de variação / user-product) → { [mlb]: { preco, comissao, frete, imposto, custo, margem, margemPct, estimado } }
export function margemNoPreco(loja, pares) {
  const B = base(loja), out = {};
  for (const { mlb, preco, skus = [] } of pares) {
    if (!(preco > 0)) continue;
    const raw = um("SELECT body FROM raw WHERE loja=? AND recurso='item' AND chave=? AND status=200", loja, mlb), item = raw ? JSON.parse(raw.body) : null;
    const st = B.porItem[mlb], sku = item?.seller_custom_field || st?.sku;
    const custo = B.custos[st?.sku] ?? B.custos[mlb] ?? (sku ? B.custos[sku] : undefined) ?? skus.map(k => B.custos[k]).find(v => v != null);
    const fee = um("SELECT body FROM raw WHERE loja=? AND recurso='listing_fee' AND chave=? AND status=200", loja, `${mlb}:${preco}`);
    const feeExata = fee ? JSON.parse(fee.body).sale_fee_amount : null;
    const comissao = feeExata != null ? feeExata : preco * (st && st.receita ? st.comissao / st.receita : 0.16);
    const temHist = !!(st && st.unidades), frete = temHist ? st.frete / st.unidades : B.freteGlobal;
    const refPreco = item?.price, cruza = refPreco != null && (refPreco >= LIMITE_FRETE_GRATIS) !== (preco >= LIMITE_FRETE_GRATIS);
    const imposto = preco * B.aliq, margem = custo == null ? null : preco - comissao - frete - imposto - custo;
    out[mlb] = { preco, comissao: r2(comissao), frete: r2(frete), imposto: r2(imposto), custo: custo ?? null, margem: margem == null ? null : r2(margem),
      margemPct: margem == null ? null : margem / preco, estimado: feeExata == null || !temHist || cruza };
  }
  return out;
}
