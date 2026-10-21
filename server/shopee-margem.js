// Motor de lucro da Shopee — mesmo formato de saída do `calcular` (ML), mas a verdade do dinheiro é o ESCROW da Shopee:
//   escrow_amount = o que a Shopee repassa ao vendedor (já sem comissão, taxa de serviço, frete líquido, estornos de devolução…)
//   lucro = escrow − imposto − custo do produto  (receita − devolução − comissão − frete − ajustes = escrow, sempre fecha)
import { db } from './db.js';
import { getConfig, getCustos, getCustosHist, custoNoDia, aliquotaPctFn, versaoDados } from './margem.js';

const mlDe = l => 'loja' + l.replace('shopee', '');        // conta Shopee → conta ML da mesma empresa (alíquota do Simples)
const r2 = n => Math.round(n * 100) / 100;
const dia = ts => new Date(ts * 1000 - 3 * 3600e3).toISOString().slice(0, 10); // dia comercial = Brasília
const EFETIVA = new Set(['ACCEPTED', 'REFUND_PAID', 'COMPLETED']);
const cache = new Map();

const skuDe = i => String(i.model_sku || '').trim() || String(i.item_sku || '').trim() || String(i.item_id);

export function calcularShopee({ lojas, desde, ate = '9999' }) {
  const key = JSON.stringify([lojas, desde, ate, versaoDados]), hit = cache.get(key); // versaoDados: custo/config salvo = recalcula
  if (hit && Date.now() - hit.t < 30e3) return hit.v;
  const cfg = getConfig(), custos = getCustos(), histCusto = getCustosHist();
  const cEm = (k, d) => custoNoDia(histCusto, custos, k, d); // custo em vigor no dia do pedido
  const tot = { receita: 0, devolucao: 0, comissao: 0, frete: 0, ajustes: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, freteNF: 0 };
  const porDia = {}, porSku = {}, porMes = {}, pedidos = [], devolucoes = [];
  let recSemCusto = 0, recEstimado = 0, canceladas = 0, adsSemVenda = 0, adsGasto = 0;

  for (const loja of lojas) {
    const aliq = aliquotaPctFn(mlDe(loja));
    const escrow = {}, rets = {};
    for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='sp_escrow' AND status=200").all(loja)) escrow[r.chave] = JSON.parse(r.body).order_income;
    for (const r of db.prepare("SELECT body FROM raw WHERE loja=? AND recurso='sp_return' AND status=200").all(loja)) { const x = JSON.parse(r.body); (rets[x.order_sn] ||= []).push(x); }
    const ords = db.prepare("SELECT body FROM raw WHERE loja=? AND recurso='sp_order' AND status=200").all(loja).map(r => JSON.parse(r.body))
      .filter(o => dia(o.create_time) >= desde && dia(o.create_time) <= ate);

    // Ads (CPC): gasto diário da loja (a API só abre por campanha as campanhas antigas; as ativas só vêm somadas) → rateado entre os pedidos do dia pelo faturamento
    const adsDia = {}, recDia = {};
    for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='sp_ads_shop' AND status=200").all(loja)) adsDia[r.chave] = JSON.parse(r.body).expense || 0;
    const vale = o => o.order_status !== 'CANCELLED' && o.order_status !== 'UNPAID' && o.pay_time;
    for (const o of ords) if (vale(o)) recDia[dia(o.create_time)] = (recDia[dia(o.create_time)] || 0) + (o.item_list || []).reduce((s, i) => s + (i.model_discounted_price || i.model_original_price || 0) * (i.model_quantity_purchased || 1), 0);
    for (const [d, v] of Object.entries(adsDia)) if (d >= desde && d <= ate) { adsGasto += v; if (!recDia[d]) adsSemVenda += v; }

    // taxa média (comissão+serviço)/receita da loja nos pedidos com escrow, para estimar pedido que ainda não tem escrow
    let tr = 0, tt = 0;
    for (const o of ords) { const e = escrow[o.order_sn]; if (!e || !e.order_selling_price) continue; tr += e.order_selling_price; tt += (e.commission_fee || 0) + (e.service_fee || 0) + (e.seller_transaction_fee || 0) + (e.credit_card_transaction_fee || 0); }
    const taxaMedia = tr ? tt / tr : 0.2;

    for (const o of ords) {
      if (o.order_status === 'CANCELLED' || o.order_status === 'UNPAID' || !o.pay_time) { if (o.order_status === 'CANCELLED') canceladas++; continue; }
      const d = dia(o.create_time), e = escrow[o.order_sn], rs = (rets[o.order_sn] || []).filter(x => EFETIVA.has(x.status));
      const itens = (o.item_list || []).map(i => ({ i, q: i.model_quantity_purchased || 1, bruto: (i.model_discounted_price || i.model_original_price || 0) * (i.model_quantity_purchased || 1), sku: skuDe(i) }));
      const receita = itens.reduce((s, x) => s + x.bruto, 0);
      const pedido = { loja, id: o.order_sn, data: new Date(o.create_time * 1000).toISOString(), comprador: o.buyer_username, status: o.order_status, receita: 0, devolucao: 0, comissao: 0, frete: 0, ajustes: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, freteNF: 0, flags: [], itens: [] };
      Object.defineProperty(pedido, 'det', { value: [], enumerable: false });

      // valores do pedido (escrow é a fonte; sem escrow, estima pela taxa média da loja)
      let devolucao, comissao, frete, liquido;
      const compradorFrete = e?.buyer_paid_shipping_fee || 0;
      if (e) {
        devolucao = Math.min(Math.abs(Math.min(e.seller_return_refund || 0, 0)), receita);
        comissao = (e.commission_fee || 0) + (e.service_fee || 0) + (e.seller_transaction_fee || 0) + (e.credit_card_transaction_fee || 0) + (e.campaign_fee || 0);
        frete = Math.max((e.actual_shipping_fee || 0) - (e.shopee_shipping_rebate || 0) - compradorFrete, 0) + (e.reverse_shipping_fee || 0);
        liquido = e.escrow_amount;
      } else {
        devolucao = 0; comissao = receita * taxaMedia; frete = 0; liquido = receita - comissao; recEstimado += receita; pedido.flags.push('sem escrow (estimado)');
      }
      const ajustes = receita - devolucao - comissao - frete - liquido; // vouchers do vendedor, compensações, retenções… (fecha com o escrow)
      const fracRef = receita ? Math.min(devolucao / receita, 1) : 0;
      const imposto = Math.max(receita - devolucao + compradorFrete, 0) * aliq(d.slice(0, 7)) / 100;
      const perde = rs.length && cfg.devolucao_perde_produto;

      for (const x of itens) {
        const cU = cEm(x.sku, d) ?? cEm(String(x.i.item_id), d), part = receita ? x.bruto / receita : 1 / itens.length;
        const devI = devolucao * part, comI = comissao * part, frI = frete * part, ajI = ajustes * part, impI = imposto * part;
        const custo = cU == null ? 0 : cU * x.q * (perde ? 1 : 1 - fracRef);
        if (cU == null) { recSemCusto += x.bruto; pedido.flags.includes('sem custo') || pedido.flags.push('sem custo'); }
        const adsI = recDia[d] && adsDia[d] ? adsDia[d] * x.bruto / recDia[d] : 0;
        const lucro = x.bruto - devI - comI - frI - ajI - impI - custo - adsI;
        Object.assign(pedido, { ads: pedido.ads + adsI, receita: pedido.receita + x.bruto, devolucao: pedido.devolucao + devI, comissao: pedido.comissao + comI, frete: pedido.frete + frI, ajustes: pedido.ajustes + ajI, imposto: pedido.imposto + impI, custo: pedido.custo + custo, lucro: pedido.lucro + lucro });
        const s = porSku[x.sku] ||= { sku: x.sku, titulo: x.i.item_name, item: String(x.i.item_id), itens: new Set(), lojas: new Set(), unidades: 0, receita: 0, devolucao: 0, comissao: 0, frete: 0, ajustes: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, semCusto: false, custoUnit: custos[x.sku] ?? null };
        if (cU == null) s.semCusto = true;
        s.lojas.add(loja); s.itens.add(String(x.i.item_id)); s.unidades += x.q; s.receita += x.bruto; s.devolucao += devI; s.comissao += comI; s.frete += frI; s.ajustes += ajI; s.imposto += impI; s.custo += custo; s.ads += adsI; s.lucro += lucro;
        pedido.itens.push(`${x.i.item_name}${x.i.model_name ? ' (' + x.i.model_name + ')' : ''} x${x.q}`);
        pedido.det.push({ sku: x.sku, item: String(x.i.item_id), titulo: x.i.item_name, qtd: x.q, preco: x.bruto / x.q, receita: x.bruto, devolucao: devI, comissao: comI, frete: frI, ajustes: ajI, imposto: impI, custo, ads: adsI, lucro });
      }
      pedido.freteNF = compradorFrete;
      if (fracRef > 0) pedido.flags.push(fracRef >= 0.99 ? 'devolvido' : 'reembolso parcial');
      else if (rs.length) pedido.flags.push('devolução em andamento');
      for (const k of Object.keys(tot)) tot[k] += pedido[k] ?? 0;
      const pd = porDia[d + '|' + loja] ||= { dia: d, loja, pedidos: 0, receita: 0, lucro: 0 }; pd.pedidos++; pd.receita += pedido.receita; pd.lucro += pedido.lucro;
      const pm = porMes[d.slice(0, 7) + '|' + loja] ||= { mes: d.slice(0, 7), loja, pedidos: 0, receita: 0, devolucao: 0, comissao: 0, frete: 0, ajustes: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, freteNF: 0 };
      pm.pedidos++; for (const k of ['receita', 'devolucao', 'comissao', 'frete', 'ajustes', 'imposto', 'custo', 'ads', 'lucro', 'freteNF']) pm[k] += pedido[k];
      pedidos.push(pedido);
    }
    for (const x of Object.values(rets).flat()) {
      if (dia(x.create_time) < desde || dia(x.create_time) > ate) continue;
      devolucoes.push({ loja, id: x.return_sn, pedido: x.order_sn, data: new Date(x.create_time * 1000).toISOString(), status: x.status, motivo: x.reason, reembolsado: x.refund_amount || 0, efetiva: EFETIVA.has(x.status),
        itens: (x.item || []).map(i => `${i.name} x${i.amount}`).join(' | '), itensDet: (x.item || []).map(i => ({ id: String(i.item_id), sku: String(i.variation_sku || i.item_sku || '').trim(), titulo: i.name, qtd: i.amount, valor: i.refund_amount })) });
    }
  }

  const lista = Object.values(porSku).map(s => ({ ...s, lojas: [...s.lojas], anuncios: s.itens.size, margem: s.receita ? s.lucro / s.receita : 0 })).sort((a, b) => b.receita - a.receita);
  const rd = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v]));
  const out = {
    config: cfg, desde, ate, canal: 'shopee',
    total: { ...rd(tot), adsGasto: r2(adsGasto), adsSemVenda: r2(adsSemVenda), lucroFinal: r2(tot.lucro - adsSemVenda), margem: tot.receita ? (tot.lucro - adsSemVenda) / tot.receita : 0, pedidos: pedidos.length, canceladas, devolvido: r2(tot.devolucao), qtdDevolucoes: devolucoes.filter(d => d.efetiva).length },
    cobertura: { pctReceitaSemCusto: tot.receita ? recSemCusto / tot.receita : 0, pctReceitaEstimada: tot.receita ? recEstimado / tot.receita : 0, skusSemCusto: lista.filter(s => s.semCusto).length, skus: lista.length },
    porMes: Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes)).map(rd),
    diario: Object.values(porDia).sort((a, b) => a.dia.localeCompare(b.dia)).map(rd),
    skus: lista, devolucoes: devolucoes.sort((a, b) => b.data.localeCompare(a.data)),
    pedidos: pedidos.sort((a, b) => a.lucro - b.lucro).slice(0, 300).map(p => ({ ...p, itens: p.itens.join(' | ') })),
  };
  Object.defineProperty(out, 'pedidosTodos', { value: pedidos, enumerable: false });
  cache.set(key, { t: Date.now(), v: out });
  return out;
}
