// Ficha completa de um pedido (Mercado Livre ou Shopee) e painel de vendas ao vivo (hoje × ontem até a mesma hora).
// A conta de cada pedido vem do mesmo cálculo das outras telas (calcular / calcularShopee), então os números batem com a lista de pedidos e o DRE.
import { db, getRaw } from './db.js';
import { LOJAS } from './ml.js';
import { SHOPEE } from './shopee.js';
import { calcular } from './margem.js';
import { calcularShopee } from './shopee-margem.js';
import { LOG, hoje, addDias, diaBR, r2, envios, anuncios, spThumb } from './painel.js';
import { shopeeDoFiltro } from './recompra.js';

const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const iso = d => { const t = typeof d === 'number' ? d * 1000 : d ? Date.parse(d) : NaN; return isNaN(t) ? null : new Date(t).toISOString(); };
const semQtd = t => String(t || '').replace(/ x\d+$/, '');
const STATUS_ML = { paid: 'Pago', confirmed: 'Confirmado', cancelled: 'Cancelado', payment_required: 'Aguardando pagamento', payment_in_process: 'Pagamento em análise', partially_paid: 'Pago em parte', partially_refunded: 'Reembolso parcial', pending_cancel: 'Cancelando', invalid: 'Inválido' };
const ENVIO_ML = { pending: 'Pendente', handling: 'Em preparação', ready_to_ship: 'Pronto para envio', shipped: 'A caminho', delivered: 'Entregue', not_delivered: 'Não entregue', cancelled: 'Cancelado' };
const PAGTO = { pix: 'Pix', account_money: 'Saldo Mercado Pago', bolbradesco: 'Boleto', pec: 'Boleto (lotérica)', consumer_credits: 'Linha de crédito MP', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', ticket: 'Boleto', bank_transfer: 'Transferência / Pix' };
const STATUS_SP = { UNPAID: 'Aguardando pagamento', READY_TO_SHIP: 'Pronto para envio', PROCESSED: 'Processado', RETRY_SHIP: 'Reenvio', SHIPPED: 'Enviado', TO_CONFIRM_RECEIVE: 'Entregue (aguardando confirmação)', COMPLETED: 'Concluído', IN_CANCEL: 'Cancelando', CANCELLED: 'Cancelado', TO_RETURN: 'Em devolução', INVOICE_PENDING: 'Aguardando nota' };
const TIPO_REC = { returns: 'Devolução', mediations: 'Mediação', cancel_purchase: 'Cancelamento', fulfillment: 'Reclamação (Full)' };

// conta do pedido (mesmos campos da lista de pedidos), arredondada
const conta = p => p && {
  receita: r2(p.receita), devolucao: r2(p.devolucao), comissao: r2(p.comissao), frete: r2(p.frete), ajustes: r2(p.ajustes || 0), freteNF: r2(p.freteNF), impostoFrete: r2(p.impostoFrete || 0),
  imposto: r2(p.imposto), custo: r2(p.custo), ads: r2(p.ads), lucro: r2(p.lucro), margem: p.receita ? p.lucro / p.receita : 0, flags: p.flags,
  repasse: r2(p.receita - p.devolucao - p.comissao - p.frete - (p.ajustes || 0)),
  det: p.det.map(d => ({ sku: d.sku, item: d.item, titulo: d.titulo, qtd: d.qtd, preco: r2(d.preco), receita: r2(d.receita), comissao: r2(d.comissao), frete: r2(d.frete), imposto: r2(d.imposto), custo: r2(d.custo), custoUnit: d.qtd ? r2(d.custo / d.qtd) : 0, ads: r2(d.ads), lucro: r2(d.lucro) })),
};

function fichaML(loja, id) {
  const o = getRaw(loja, 'order', id)?.body;
  if (!o || typeof o !== 'object' || !o.id) throw erro('Pedido não encontrado no banco (ainda não coletado?).', 404);
  const dia = diaBR(o.date_created), calc = calcular({ lojas: [loja], desde: addDias(dia, -30), ate: dia }); // 30 dias: a mesma média de frete estimado da lista
  const p = calc.pedidosTodos.find(x => String(x.id) === String(id)), dv = calc.devolucoes.find(x => String(x.id) === String(id));
  const sid = o.shipping?.id, s = sid ? getRaw(loja, 'shipment', sid)?.body : null, sc = sid ? getRaw(loja, 'shipment_costs', sid)?.body : null, sla = sid ? getRaw(loja, 'shipment_sla', sid)?.body : null;
  const inv = getRaw(loja, 'invoice', id), nf = inv?.status === 200 && inv.body?.status ? inv.body : null;
  const an = anuncios();
  const claims = db.prepare(`SELECT chave, body FROM raw WHERE loja=? AND recurso='claim' AND status=200 AND CAST(json_extract(body,'$.resource_id') AS TEXT)=?`).all(loja, String(id)).map(r => JSON.parse(r.body));
  const vendedor = String(o.seller?.id || '');
  const msgs = (getRaw(loja, 'messages_pack', o.pack_id || id)?.body?.messages || []).map(m => ({ de: String(m.from?.user_id) === vendedor ? 'voce' : 'comprador', texto: m.text, data: iso(m.message_date?.created) }))
    .filter(m => m.texto).sort((a, b) => String(a.data).localeCompare(String(b.data))).slice(-12);
  const h = s?.status_history || {};
  const pagos = (o.payments || []).filter(x => x.status === 'approved' || x.status === 'refunded');
  const tempo = [
    [o.date_created, 'Compra feita'], [pagos[0]?.date_approved, 'Pagamento aprovado'], [nf?.attributes?.authorization_date || nf?.issued_date, `Nota fiscal ${nf?.invoice_number || ''} autorizada`],
    [h.date_ready_to_ship, 'Pronto para envio'], [h.date_shipped, 'Despachado'], [h.date_first_visit && h.date_first_visit !== h.date_delivered ? h.date_first_visit : null, 'Primeira tentativa de entrega'],
    [h.date_delivered, 'Entregue'], [h.date_not_delivered, 'Não entregue'], [h.date_returned, 'Voltou para você'],
    ...claims.map(c => [c.date_created, `${TIPO_REC[c.type] || 'Reclamação'} aberta${c.status === 'closed' ? ' (encerrada)' : ''}`]),
    [o.status === 'cancelled' ? (o.cancel_detail?.date || o.date_closed || o.last_updated) : null, 'Pedido cancelado'],
    ...(o.payments || []).filter(x => x.transaction_amount_refunded > 0).map(x => [x.date_last_modified, `Reembolso de R$ ${String(r2(x.transaction_amount_refunded).toFixed(2)).replace('.', ',')}`]),
  ].filter(([d]) => d).map(([d, t]) => ({ data: iso(d), txt: t })).sort((a, b) => a.data.localeCompare(b.data));
  return {
    canal: 'ml', loja, nomeLoja: LOJAS[loja]?.nome || loja, id: String(o.id), pack: o.pack_id ? String(o.pack_id) : null, data: iso(o.date_created),
    status: STATUS_ML[o.status] || o.status, cancelado: o.status === 'cancelled', link: `https://www.mercadolivre.com.br/vendas/${o.pack_id || o.id}/detalhe`,
    comprador: { apelido: o.buyer?.nickname || null, cidade: s?.receiver_address?.city?.name || null, uf: (s?.receiver_address?.state?.id || '').replace('BR-', '') || null },
    itens: (o.order_items || []).map(i => {
      const a = an[loja + ':' + i.item.id] || {};
      return { item: i.item.id, titulo: i.item.title, sku: i.item.seller_sku || i.item.seller_custom_field || null, variacao: (i.item.variation_attributes || []).map(v => `${v.name}: ${v.value_name}`).join(' · '),
        qtd: i.quantity, preco: i.unit_price, precoCheio: i.gross_price ?? null, tarifa: i.sale_fee ?? null, tipo: i.listing_type_id === 'gold_pro' ? 'Premium' : i.listing_type_id === 'gold_special' ? 'Clássico' : i.listing_type_id, thumb: a.thumb || null, link: a.link || null };
    }),
    pagamentos: (o.payments || []).map(x => ({ metodo: PAGTO[x.payment_method_id] || PAGTO[x.payment_type] || x.payment_method_id, parcelas: x.installments || 1, valor: x.transaction_amount, pago: x.total_paid_amount,
      freteComprador: x.shipping_cost || 0, reembolsado: x.transaction_amount_refunded || 0, status: x.status, data: iso(x.date_approved) })),
    envio: sid ? { id: String(sid), logistica: s?.logistic_type ? LOG[s.logistic_type] || 'Padrão' : null, status: ENVIO_ML[s?.status] || s?.status || null, rastreio: s?.tracking_number || null, transportadora: s?.tracking_method || null,
      custoVendedor: sc ? r2((sc.senders || []).reduce((t, x) => t + (x.cost || 0), 0)) : null, freteComprador: sc?.receiver?.cost ?? null, prazoEntrega: iso(s?.shipping_option?.estimated_delivery_final?.date),
      atraso: sla?.status === 'delayed' } : null,
    nota: nf ? { status: nf.status === 'authorized' ? 'Autorizada' : nf.status, numero: nf.invoice_number, serie: nf.invoice_series, chave: nf.attributes?.invoice_key || null, data: iso(nf.attributes?.authorization_date || nf.issued_date),
      valor: nf.amount ?? null, frete: r2((nf.items || []).filter(i => String(i.external_order_id) === String(id)).reduce((t, i) => t + (i.shipping_buyer_cost || 0), 0)) } : null,
    conta: conta(p),
    devolucao: dv ? { tipo: dv.tipo, reembolsado: r2(dv.reembolsado), freteIda: r2(dv.freteIda), freteVolta: r2(dv.freteVolta), tarifas: r2(dv.tarifasPerdidas), custoProduto: r2(dv.custoProd), perda: r2(dv.perda),
      mantida: !!dv.mantida, resultadoMantido: r2(dv.resultadoMantido || 0), fonte: dv.fonte, motivos: dv.motivos || [] } : null,
    reclamacoes: claims.map(c => ({ id: String(c.id), tipo: TIPO_REC[c.type] || c.type, status: c.status === 'opened' ? 'Aberta' : 'Encerrada', etapa: c.stage, data: iso(c.date_created),
      motivo: getRaw(loja, 'claim_reason', c.reason_id)?.body?.detail || c.reason_id })),
    mensagens: msgs, tempo,
  };
}

// linhas do extrato da Shopee (escrow), na ordem em que somam o repasse
const ESCROW = [['order_selling_price', 'Preço de venda (com descontos)', 1], ['seller_discount', 'Desconto do vendedor', -1], ['voucher_from_seller', 'Cupom do vendedor', -1], ['buyer_paid_shipping_fee', 'Frete pago pelo comprador', 1],
  ['actual_shipping_fee', 'Frete real do envio', -1], ['shopee_shipping_rebate', 'Subsídio de frete da Shopee', 1], ['commission_fee', 'Comissão', -1], ['service_fee', 'Taxa de serviço', -1],
  ['seller_transaction_fee', 'Taxa de transação', -1], ['credit_card_transaction_fee', 'Taxa do cartão', -1], ['campaign_fee', 'Taxa de campanha', -1], ['reverse_shipping_fee', 'Frete de devolução', -1],
  ['seller_return_refund', 'Reembolso da devolução', 1], ['escrow_amount', 'Repasse (o que a Shopee paga)', 0]];

function fichaShopee(loja, id) {
  const o = getRaw(loja, 'sp_order', id)?.body;
  if (!o || typeof o !== 'object' || !o.order_sn) throw erro('Pedido não encontrado no banco (ainda não coletado?).', 404);
  const e = getRaw(loja, 'sp_escrow', id)?.body?.order_income || null;
  const dia = diaBR(iso(o.create_time)), calc = calcularShopee({ lojas: [loja], desde: addDias(dia, -30), ate: dia });
  const p = calc.pedidosTodos.find(x => x.id === id);
  const rets = db.prepare(`SELECT body FROM raw WHERE loja=? AND recurso='sp_return' AND status=200 AND json_extract(body,'$.order_sn')=?`).all(loja, id).map(r => JSON.parse(r.body));
  const pk = (o.package_list || [])[0];
  const tempo = [[o.create_time, 'Compra feita'], [o.pay_time, 'Pagamento confirmado'], ...rets.map(r => [r.create_time, `Devolução pedida (${r.status})`]),
    [o.order_status === 'CANCELLED' ? o.update_time : null, 'Pedido cancelado'], [o.order_status === 'COMPLETED' ? o.update_time : null, 'Pedido concluído']]
    .filter(([d]) => d).map(([d, t]) => ({ data: iso(d), txt: t })).sort((a, b) => a.data.localeCompare(b.data));
  return {
    canal: 'shopee', loja, nomeLoja: SHOPEE[loja]?.nome || loja, id: o.order_sn, data: iso(o.create_time), status: STATUS_SP[o.order_status] || o.order_status, cancelado: o.order_status === 'CANCELLED',
    link: `https://seller.shopee.com.br/portal/sale/order?keyword=${encodeURIComponent(o.order_sn)}`, prazoDespacho: iso(o.ship_by_date),
    comprador: { apelido: o.buyer_username || null, cidade: null, uf: null },
    itens: (o.item_list || []).map(i => ({ item: String(i.item_id), titulo: i.item_name, sku: String(i.model_sku || i.item_sku || '').trim() || null, variacao: i.model_name || '', qtd: i.model_quantity_purchased || 1,
      preco: i.model_discounted_price || i.model_original_price || 0, precoCheio: i.model_original_price ?? null, thumb: spThumb(loja, i.item_id), link: null })),
    pagamentos: [{ metodo: o.payment_method || null, valor: o.total_amount, pago: o.total_amount, parcelas: 1, data: iso(o.pay_time), status: o.pay_time ? 'approved' : 'pending' }],
    envio: { logistica: 'Shopee', status: STATUS_SP[o.order_status] || o.order_status, transportadora: o.shipping_carrier || pk?.shipping_carrier || null, rastreio: pk?.package_number || null,
      custoVendedor: e ? r2(Math.max((e.actual_shipping_fee || 0) - (e.shopee_shipping_rebate || 0) - (e.buyer_paid_shipping_fee || 0), 0)) : null, freteComprador: e?.buyer_paid_shipping_fee ?? null },
    nota: null,
    extrato: e ? ESCROW.filter(([k]) => e[k]).map(([k, t, sinal]) => ({ txt: t, valor: r2(sinal < 0 ? -Math.abs(e[k]) : e[k]), total: !sinal })) : null,
    conta: conta(p),
    devolucao: rets.length ? { tipo: 'Devolução Shopee', reembolsado: r2(rets.reduce((t, r) => t + (r.refund_amount || 0), 0)), status: rets.map(r => r.status).join(', '), motivos: rets.map(r => r.text_reason || r.reason).filter(Boolean) } : null,
    reclamacoes: [], mensagens: [], tempo,
  };
}

export function fichaPedido(loja, id) {
  if (LOJAS[loja]) return fichaML(loja, id);
  if (SHOPEE[loja]) return fichaShopee(loja, id);
  throw erro('Conta desconhecida.');
}

// Painel ao vivo: os pedidos de hoje (os mais novos primeiro) e a comparação com ontem até a mesma hora
export function aoVivo(lojas) {
  const spL = shopeeDoFiltro(lojas), hj = hoje(), on = addDias(hj, -1);
  const agoraBR = new Date(Date.now() - 3 * 3600e3), minAgora = agoraBR.getUTCHours() * 60 + agoraBR.getUTCMinutes();
  const ml = calcular({ lojas, desde: on, ate: hj }), sp = spL.length ? calcularShopee({ lojas: spL, desde: on, ate: hj }) : null;
  const env = envios(), an = anuncios();
  const pos = d => { const x = new Date(Date.parse(d) - 3 * 3600e3); return { dia: x.toISOString().slice(0, 10), min: x.getUTCHours() * 60 + x.getUTCMinutes() }; };
  const vazio = () => ({ pedidos: 0, unidades: 0, receita: 0, lucro: 0, ads: 0 });
  const K = { hoje: vazio(), ontemAteAgora: vazio(), ontem: vazio() }, horas = { hoje: Array(24).fill(0), ontem: Array(24).fill(0), hojeN: Array(24).fill(0), ontemN: Array(24).fill(0) };
  const soma = (k, p) => { k.pedidos++; k.unidades += p.qtd || p.det.reduce((t, d) => t + d.qtd, 0); k.receita += p.receita; k.lucro += p.lucro; k.ads += p.ads; };
  const feed = [];
  for (const [canal, lista] of [['ml', ml.pedidosTodos], ['shopee', sp?.pedidosTodos || []]]) for (const p of lista) {
    const { dia, min } = pos(p.data), h = Math.floor(min / 60);
    if (dia === hj) {
      soma(K.hoje, p); horas.hoje[h] += p.receita; horas.hojeN[h]++;
      const d0 = p.det[0] || {};
      feed.push({ canal, loja: p.loja, id: String(p.id), data: p.data, titulo: semQtd(p.itens[0]), outros: p.itens.length - 1, sku: d0.sku || null, qtd: p.qtd || p.det.reduce((t, d) => t + d.qtd, 0),
        thumb: canal === 'ml' ? an[p.loja + ':' + d0.item]?.thumb || null : spThumb(p.loja, d0.item), receita: r2(p.receita), lucro: r2(p.lucro), margem: p.receita ? p.lucro / p.receita : 0,
        ads: r2(p.ads), frete: r2(p.frete), lg: canal === 'ml' ? env[p.loja + ':' + p.id]?.lg || null : 'Shopee', uf: canal === 'ml' ? env[p.loja + ':' + p.id]?.uf || null : null, flags: p.flags });
    } else if (dia === on) { soma(K.ontem, p); horas.ontem[h] += p.receita; horas.ontemN[h]++; if (min <= minAgora) soma(K.ontemAteAgora, p); }
  }
  for (const k of Object.values(K)) for (const c of ['receita', 'lucro', 'ads']) k[c] = r2(k[c]);
  for (const k of ['hoje', 'ontem']) horas[k] = horas[k].map(r2);
  // cancelados hoje e hora da última coleta de pedidos (das contas do filtro)
  const ph = a => a.map(() => '?').join(',') || "''";
  const cancML = lojas.length ? db.prepare(`SELECT count(*) n FROM raw WHERE recurso='order' AND status=200 AND loja IN (${ph(lojas)}) AND coletado_em > ? AND json_extract(body,'$.status')='cancelled' AND date(json_extract(body,'$.date_created'),'-3 hours')=?`).get(...lojas, Date.now() - 2 * 864e5, hj).n : 0;
  const ini = Date.parse(hj + 'T03:00:00Z') / 1000;
  const cancSP = spL.length ? db.prepare(`SELECT count(*) n FROM raw WHERE recurso='sp_order' AND status=200 AND loja IN (${ph(spL)}) AND json_extract(body,'$.order_status')='CANCELLED' AND json_extract(body,'$.create_time') >= ?`).get(...spL, ini).n : 0;
  const ult = db.prepare(`SELECT max(coletado_em) t FROM raw WHERE recurso IN ('order','sp_order') AND loja IN (${ph([...lojas, ...spL])})`).get(...lojas, ...spL).t;
  return { hoje: hj, agora: Date.now(), minuto: minAgora, kpi: K, horas, cancelados: cancML + cancSP, ultimaColeta: ult || null, temShopee: spL.length > 0,
    adsHoje: K.hoje.ads > 0, feed: feed.sort((a, b) => Date.parse(b.data) - Date.parse(a.data)).slice(0, 300) };
}

export function registrarPedido(app, { H, lojasSel }) {
  app.get('/api/pedido', H(q => fichaPedido(String(q.loja || ''), String(q.id || ''))));
  app.get('/api/aovivo', H(q => aoVivo(lojasSel(q))));
}
