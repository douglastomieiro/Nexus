// Motor de lucro real pedido a pedido:
//   lucro = receita − devolução − comissão ML − frete (parte do vendedor) − imposto − custo do produto − Ads
import { db } from './db.js';
import { LOJAS } from './ml.js';
import { agendarBackup, fazerBackup, restaurar } from './backup.js';

db.exec(`
CREATE TABLE IF NOT EXISTS custos (sku TEXT PRIMARY KEY, custo REAL NOT NULL, atualizado_em INTEGER);
CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);
-- vigência do custo: cada SKU tem um custo base (desde '0000-00-00' = vale para todo o passado) e as trocas, cada uma a partir de um dia.
-- O pedido usa o custo em vigor na data dele. A tabela custos guarda o custo de hoje (telas e backup).
CREATE TABLE IF NOT EXISTS custos_hist (sku TEXT NOT NULL, desde TEXT NOT NULL, custo REAL NOT NULL, atualizado_em INTEGER, PRIMARY KEY (sku, desde));
`);
export const CUSTO_BASE = '0000-00-00';
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const diaBR = ms => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
// custos digitados à mão são insubstituíveis: restaura do backup se a tabela estiver vazia e garante um backup inicial.
// Custos de antes da vigência (sem histórico) viram o custo base do SKU. Só acrescenta: nada é apagado.
{
  const r = restaurar(); if (r.restaurado) console.log(`[backup] ${r.restaurado} custos restaurados do backup (${r.de})`);
  db.prepare(`INSERT OR IGNORE INTO custos_hist (sku, desde, custo, atualizado_em) SELECT sku, '${CUSTO_BASE}', custo, atualizado_em FROM custos WHERE sku NOT IN (SELECT sku FROM custos_hist)`).run();
  fazerBackup('inicialização');
}

// ── Alíquota do Simples ──
// Por enquanto só MANUAL: o usuário informa a alíquota (%) de cada conta em Configurações.
// A automática (RBT12 + faixa do anexo, pelas NF-e) volta depois; `aliquotaAuto` fica como ponto de encaixe e devolve null.
export function aliquotaAuto() { return null; }

export const getConfig = () => {
  const c = Object.fromEntries(db.prepare('SELECT chave, valor FROM config').all().map(r => [r.chave, r.valor]));
  return { ...Object.fromEntries(Object.keys(LOJAS).map(l => ['aliquota_' + l, Number(c['aliquota_' + l] ?? 0)])), devolucao_perde_produto: Number(c.devolucao_perde_produto ?? 0), aliquota_modo: 'manual' };
};
export const setConfig = (k, v) => { db.prepare('INSERT INTO config (chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor').run(k, String(v)); cache.clear(); versaoDados++; agendarBackup('config ' + k); };
// custo de hoje de cada SKU (o em vigor no histórico; sem histórico, o da tabela custos)
export const getCustos = () => Object.fromEntries(db.prepare(`SELECT c.sku, COALESCE((SELECT h.custo FROM custos_hist h WHERE h.sku=c.sku AND h.desde<=? ORDER BY h.desde DESC LIMIT 1), c.custo) custo FROM custos c`).all(hojeBR()).map(r => [r.sku, r.custo]));
// histórico de vigência: { sku: [[desde, custo], ...] } em ordem de data
export const getCustosHist = () => { const h = {}; for (const r of db.prepare('SELECT sku, desde, custo FROM custos_hist ORDER BY sku, desde').all()) (h[r.sku] ||= []).push([r.desde, r.custo]); return h; };
// custo em vigor num dia (AAAA-MM-DD); SKU sem histórico usa o custo atual
export const custoNoDia = (hist, atuais, sku, dia) => {
  const h = hist[sku]; if (!h) return atuais[sku];
  let v; for (const [d, c] of h) { if (d > dia) break; v = c; } return v;
};
// desde: dia em que o custo novo passa a valer (padrão: hoje). O 1º custo do SKU vale para todo o passado.
// Correção no mesmo dia: se o último registro do SKU foi gravado hoje (e não veio data), só troca o valor dele.
export const setCusto = (sku, custo, desde) => {
  if (typeof custo === 'string') custo = custo.trim().replace(',', '.');
  if (desde != null && desde !== '' && desde !== CUSTO_BASE && !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(desde)) throw Object.assign(new Error('data de vigência inválida'), { status: 400 });
  if (custo === null || custo === '' || custo === undefined) { db.prepare('DELETE FROM custos WHERE sku=?').run(sku); db.prepare('DELETE FROM custos_hist WHERE sku=?').run(sku); }
  else if (!Number.isFinite(Number(custo)) || Number(custo) < 0) throw Object.assign(new Error('custo inválido'), { status: 400 });
  else {
    const agora = Date.now(), hist = db.prepare('SELECT desde, atualizado_em FROM custos_hist WHERE sku=? ORDER BY desde').all(sku), ult = hist.at(-1);
    const d = !hist.length ? CUSTO_BASE : desde ? desde : ult.atualizado_em && diaBR(ult.atualizado_em) === hojeBR() ? ult.desde : hojeBR();
    db.prepare('INSERT INTO custos_hist (sku,desde,custo,atualizado_em) VALUES (?,?,?,?) ON CONFLICT(sku,desde) DO UPDATE SET custo=excluded.custo, atualizado_em=excluded.atualizado_em').run(sku, d, Number(custo), agora);
    const vig = db.prepare('SELECT custo FROM custos_hist WHERE sku=? AND desde<=? ORDER BY desde DESC LIMIT 1').get(sku, hojeBR()) ?? { custo: Number(custo) };
    db.prepare('INSERT INTO custos (sku,custo,atualizado_em) VALUES (?,?,?) ON CONFLICT(sku) DO UPDATE SET custo=excluded.custo, atualizado_em=excluded.atualizado_em').run(sku, vig.custo, agora);
  }
  cache.clear(); versaoDados++; agendarBackup("custo " + sku);
};


// SKU do item vendido: o do pedido; se o pedido veio sem, o atributo SELLER_SKU / campo do vendedor do anúncio; senão o próprio id do anúncio.
// Assim um custo digitado vale para TODOS os anúncios (e lojas) com o mesmo SKU.
let skuAnuncio = null, skuAnuncioT = 0;
export const skuDe = (loja, item) => {
  const sku = item.seller_sku && String(item.seller_sku).trim();
  if (sku) return sku;
  if (!skuAnuncio || Date.now() - skuAnuncioT > 5 * 60e3) {
    skuAnuncio = {}; skuAnuncioT = Date.now();
    for (const r of db.prepare("SELECT loja, chave, body FROM raw WHERE recurso='item' AND status=200").all()) {
      const b = JSON.parse(r.body), v = b.seller_custom_field || (b.attributes || []).find(a => a.id === 'SELLER_SKU')?.value_name;
      if (v && String(v).trim()) skuAnuncio[r.loja + ':' + r.chave] = String(v).trim();
    }
  }
  return skuAnuncio[loja + ':' + item.id] || item.id;
};

// Alíquota (%) por competência (AAAA-MM) de uma loja do ML — mesma regra do `calcular`, exposta para o motor da Shopee
// (cada conta Shopee pertence à mesma empresa/CNPJ de uma conta ML, então usa o mesmo DAS).
export function aliquotaPctFn(loja) {
  const cfg = getConfig(), auto = cfg.aliquota_modo === 'auto' ? aliquotaAuto(loja) : null;
  const ks = Object.keys(auto?.meses || {}).sort();
  return comp => {
    const a = auto?.meses, perto = ks.length ? (ks.filter(k => k <= comp).at(-1) ?? ks[0]) : null;
    return a ? (a[comp]?.pct ?? a[perto]?.pct ?? cfg['aliquota_' + loja]) : cfg['aliquota_' + loja];
  };
}

const cache = new Map();
// muda a cada custo ou configuração salvos: o cálculo da Shopee (outro módulo, com cache próprio) usa no nome do cache
export let versaoDados = 0;
// O ML devolve datas com offset -04:00; o dia comercial é o de Brasília (UTC-3).
const dia = s => new Date(Date.parse(s) - 3 * 3600e3).toISOString().slice(0, 10);
const r2 = n => Math.round(n * 100) / 100;

function carregarAds(lojas) {
  // ads[loja][item][dia] = custo. Janela de 90 dias da API (ads_item_daily) + dias que a coleta guardou depois que saíram dela
  // (ads_item_daily_hist, corpo { 'AAAA-MM-DD': dia }); no mesmo dia vale a janela.
  const out = {}, custo = d => (d?.results || []).reduce((t, x) => t + (x.metrics?.cost || 0), 0);
  for (const loja of lojas) {
    out[loja] = {};
    for (const row of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='ads_item_daily_hist' AND status=200").all(loja)) {
      const m = out[loja][row.chave] = {};
      for (const [d, x] of Object.entries(JSON.parse(row.body))) m[d] = custo(x);
    }
    for (const row of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='ads_item_daily' AND status=200").all(loja)) {
      const j = {};
      for (const d of JSON.parse(row.body)) j[d.date] = (j[d.date] || 0) + custo(d);
      Object.assign(out[loja][row.chave] ||= {}, j);
    }
  }
  return out;
}

export function calcular({ lojas, desde, ate = '9999' }) {
  const key = JSON.stringify([lojas, desde, ate]);
  const hit = cache.get(key); if (hit && Date.now() - hit.t < 30e3) return hit.v;
  const cfg = getConfig(), custos = getCustos(), histCusto = getCustosHist();
  const cEm = (k, d) => custoNoDia(histCusto, custos, k, d); // custo em vigor no dia do pedido
  const ph = lojas.map(() => '?').join(',');
  const orders = db.prepare(`SELECT loja, body FROM raw WHERE recurso='order' AND status=200 AND loja IN (${ph})
    AND date(json_extract(body,'$.date_created'),'-3 hours') >= ? AND date(json_extract(body,'$.date_created'),'-3 hours') <= ?`).all(...lojas, desde, ate).map(r => ({ loja: r.loja, o: JSON.parse(r.body) }));

  // custo de frete do vendedor por envio
  const frete = {};
  for (const loja of lojas) for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='shipment_costs' AND status=200").all(loja)) {
    const j = JSON.parse(r.body); frete[loja + ':' + r.chave] = (j.senders || []).reduce((s, x) => s + (x.cost || 0), 0);
  }
  const ads = carregarAds(lojas);

  // Frete cobrado do comprador: entra na NF-e (base do imposto no Simples), mas NÃO é receita do vendedor.
  // Fonte preferida: a própria NF (items[].shipping_buyer_cost); senão, receiver.cost do envio.
  const recvCost = {}, nfFrete = {};
  for (const loja of lojas) {
    for (const r of db.prepare("SELECT chave, json_extract(body,'$.receiver.cost') rc FROM raw WHERE loja=? AND recurso='shipment_costs' AND status=200").all(loja)) recvCost[loja + ':' + r.chave] = r.rc || 0;
    for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='invoice' AND status=200").all(loja)) {
      const inv = JSON.parse(r.body);
      if (inv.status !== 'authorized') continue;
      nfFrete[loja + ':' + r.chave] = (inv.items || []).filter(i => String(i.external_order_id) === String(r.chave)).reduce((s, i) => s + (i.shipping_buyer_cost || 0), 0);
    }
  }

  // Reclamações por pedido (para classificar devoluções) e custo de devolução cobrado do vendedor
  const claimPorPedido = {}, custoRetorno = {};
  for (const loja of lojas) {
    for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='claim_return_cost' AND status=200").all(loja)) custoRetorno[loja + ':' + r.chave] = JSON.parse(r.body).amount || 0;
    for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='claim' AND status=200").all(loja)) {
      const cl = JSON.parse(r.body); if (cl.resource !== 'order') continue;
      (claimPorPedido[loja + ':' + cl.resource_id] ||= []).push({ id: r.chave, tipo: cl.type, status: cl.status, motivo: cl.reason_id });
    }
  }
  // O /costs de um envio mostra o custo COTADO, mesmo se o envio foi cancelado antes de sair (nesse caso o ML não cobra do vendedor).
  // Só conta frete de ida se há prova de que o envio saiu (data de despacho / status de trânsito). Sem o registro do envio
  // (coletado só p/ 90 dias), só conta se houve devolução com retorno do produto.
  const despachado = {};
  for (const loja of lojas) for (const r of db.prepare("SELECT chave, json_extract(body,'$.status') st, json_extract(body,'$.status_history.date_shipped') ds FROM raw WHERE loja=? AND recurso='shipment' AND status=200").all(loja))
    despachado[loja + ':' + r.chave] = !!r.ds || ['shipped', 'delivered', 'not_delivered'].includes(r.st);
  // Pagamentos do Mercado Pago (coletor `pagamentos`): o que foi COBRADO do vendedor e o que o ML ESTORNOU, por cobrança.
  const TARIFAS = new Set(['ml_sale_fee', 'mp_processing_fee', 'mp_financing_1x_fee', 'mp_financing_fee']); // custos do vendedor; o resto (financing_transfer, fee_spl, cupom, cashback) não é custo dele
  const mpPay = {};
  for (const loja of lojas) for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='mp_payment' AND status=200").all(loja)) {
    const p = JSON.parse(r.body), cs = p.charges_details || [];
    const soma = f => cs.filter(f).reduce((t, c) => ({ cobrado: t.cobrado + (c.amounts?.original || 0), estornado: t.estornado + Math.min(c.amounts?.refunded || 0, c.amounts?.original || 0), perdido: t.perdido + Math.max((c.amounts?.original || 0) - (c.amounts?.refunded || 0), 0) }), { cobrado: 0, estornado: 0, perdido: 0 });
    // cobertura "bpp_covered": o ML pagou o reembolso do comprador e NÃO estornou frete/comissão ao vendedor — a venda é mantida e o líquido (net_received) fica com ele
    // (a tela da venda no ML diz "Te demos o dinheiro"). Pode haver estorno só do parcelamento (financing_transfer) em refund.charges_details.
    const fee = cs.find(c => c.name === 'ml_sale_fee');
    const coberto = (p.refunds || []).length > 0 && p.refunds.every(f => f.metadata?.status_detail === 'bpp_covered');
    const mantido = coberto && (!fee || (fee.amounts?.refunded || 0) < (fee.amounts?.original || 0));
    // Cobranças do MP que podem ficar sem estorno e NÃO estão no extrato do ML (conferido nos pagamentos reais):
    //  · fee_spl (retenção de 20% em reembolsos) — nas vendas mantidas por cobertura não é estornada e sai do líquido recebido;
    //  · parcelamento: o repasse do acréscimo (financing_transfer) é estornado mas a taxa (financing_fee) não → o vendedor perde a taxa.
    const naoEst = n => cs.filter(c => c.name === n).reduce((t, c) => t + Math.max((c.amounts?.original || 0) - (c.amounts?.refunded || 0), 0), 0);
    const splPerdido = naoEst('fee_spl'), finPerdido = Math.max(naoEst('financing_fee') - naoEst('financing_transfer'), 0);
    mpPay[loja + ':' + r.chave] = { detalhe: p.status_detail, mantido, coberto, splPerdido, finPerdido, recebido: mantido ? (p.transaction_details?.net_received_amount || 0) : 0, fluxo: (p.refunds || []).map(f => f.metadata?.coverage?.flow).filter(Boolean).join(','), frete: soma(c => c.type === 'shipping'), tarifas: soma(c => c.type === 'fee' && TARIFAS.has(c.name)),
      quem: [...new Set((p.refunds || []).map(f => f.source?.type))].filter(Boolean), dataEstorno: (p.refunds || []).map(f => f.date_created).sort().at(-1) || null };
  }
  // Extrato do pedido na fatura do ML (mesma conta da tela "Detalhe da venda"): C* = cobrança, B* = cancelamento/bonificação.
  // Perda = cobrado − cancelado, por classe. Parcelamento (CFONPN) é repasse do acréscimo pago pelo comprador: não é custo.
  const extrato = {};
  for (const loja of lojas) for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='billing_order' AND status=200").all(loja)) {
    const det = JSON.parse(r.body).results?.[0]?.details; if (!det?.length) continue;
    const e = { frete: { cobrado: 0, estornado: 0 }, comissao: { cobrado: 0, estornado: 0 }, devolucao: { cobrado: 0, estornado: 0 } };
    // decisão revertida: o ML cancelou a comissão e depois a cobrou de novo (ex.: mediação revista). Nesses casos a tela do ML traz um ajuste que a API não entrega.
    let cancelouComissao = false;
    for (const dd of [...det].sort((a, b) => String(a.charge_info?.creation_date_time).localeCompare(String(b.charge_info?.creation_date_time)))) {
      const tp = dd.charge_info?.detail_sub_type || '', cl = CLASSE_FATURA(tp), v = dd.charge_info?.detail_amount || 0;
      if (e[cl]) e[cl][tp.startsWith('B') ? 'estornado' : 'cobrado'] += v;
      if (cl === 'comissao') { if (tp.startsWith('B')) cancelouComissao = true; else if (cancelouComissao) e.revertida = true; } }
    for (const k of ['frete', 'comissao', 'devolucao']) e[k].perdido = Math.max(e[k].cobrado - e[k].estornado, 0);
    extrato[loja + ':' + r.chave] = e;
  }
  const devolucoes = [];

  // 1ª passada: linhas por item (e unidades por item/dia para ratear Ads, receita por envio para ratear frete)
  const unidDia = {}, recEnvio = {}, freteUnit = {}, ordensOk = [];
  let canceladas = 0;
  for (const x of orders) {
    const o = x.o;
    if (o.status === 'cancelled') {
      canceladas++;
      const reemb = (o.payments || []).reduce((t, p) => t + (p.transaction_amount_refunded || 0), 0);
      if (reemb > 0) {
        const fk0 = x.loja + ':' + o.shipping?.id, cls = claimPorPedido[x.loja + ':' + o.id] || [];
        const voltou = cls.some(c => c.tipo === 'returns');
        const saiu = despachado[fk0] ?? voltou; // sem registro do envio: só presume que saiu se o produto retornou
        const freteCotado = o.shipping?.id && saiu ? (frete[fk0] || 0) : 0; // estimativa (cotação do /costs) — só usada se não houver o pagamento do MP
        const pagos = (o.payments || []).filter(p => (p.transaction_amount_refunded || 0) > 0).map(p => mpPay[x.loja + ':' + p.id]);
        const comMp = pagos.length > 0 && pagos.every(Boolean);
        const sm = k => pagos.reduce((t, p) => t + (p.mantido && k.endsWith('perdido') ? 0 : p[k.split('.')[0]][k.split('.')[1]]), 0); // venda mantida por cobertura: cobrança não é perda
        const ex = extrato[x.loja + ':' + o.id];
        const valorVenda = (o.order_items || []).reduce((t, i) => t + i.unit_price * i.quantity, 0);
        // Venda mantida por cobertura (bpp_covered): o ML pagou o reembolso do comprador e a comissão NÃO foi cancelada (às vezes é cancelada e cobrada de novo
        // depois, quando o ML reverte a decisão). Tela do ML: "Te demos o dinheiro" — líquido = preço − comissão − frete. Frete/comissão são custo normal, não perda.
        const coberto = comMp && pagos.some(p => p.coberto || p.detalhe === 'bpp_covered');
        const mantida = ex ? coberto && ex.comissao.perdido > 0.004 : comMp && pagos.some(p => p.mantido);
        // fonte preferida: extrato da fatura (frete de ida, tarifa de devolução e comissão, cobrado − cancelado); senão pagamento do MP; senão estimativa
        const revertida = !!ex?.revertida;
        const mantidaOk = mantida && !revertida;
        // retenção fee_spl e taxa de parcelamento não estornadas (só o pagamento do MP mostra; o extrato do ML não tem)
        const spl = comMp ? pagos.reduce((t, p) => t + p.splPerdido, 0) : 0, fin = comMp ? pagos.reduce((t, p) => t + p.finPerdido, 0) : 0;
        const freteIda = ex ? (mantida || revertida ? 0 : ex.frete.perdido) : comMp ? sm('frete.perdido') : freteCotado;
        const tarifasPerdidas = (ex ? (mantida || revertida ? 0 : ex.comissao.perdido) : comMp ? sm('tarifas.perdido') : 0) + (mantidaOk || revertida ? 0 : spl + fin);
        const estimativaRevertida = revertida ? Math.max(valorVenda - ex.comissao.perdido - ex.frete.perdido - spl - fin, 0) : 0; // pelo extrato; a tela do ML pode mostrar menos
        // líquido da venda mantida: preço − comissão − frete − fee_spl − parcelamento não estornados. Pode ser NEGATIVO (ex.: frete maior que o que sobrou) — é perda real, não zera.
        // Sem extrato: net_received do MP (já sem comissão, frete do MP e fee_spl; não reflete a taxa de parcelamento perdida depois).
        const vendaMantida = !mantidaOk ? 0 : ex ? valorVenda - ex.comissao.perdido - ex.frete.perdido - spl - fin : pagos.reduce((t, p) => t + p.recebido, 0) - fin;
        const freteVolta = ex ? ex.devolucao.perdido : cls.reduce((t, cl) => t + (custoRetorno[x.loja + ':' + cl.id] || 0), 0);
        // produto não voltou (extraviado/não entregue/mediação) → o custo dele é perdido; se voltou ("return"), volta ao estoque
        const produtoVoltou = comMp && pagos.some(p => (p.coberto || p.detalhe === 'bpp_covered') && /return/.test(p.fluxo));
        const custoPedido = (o.order_items || []).reduce((t, i) => t + (cEm(skuDe(x.loja, i.item), dia(o.date_created)) ?? cEm(i.item.id, dia(o.date_created)) ?? 0) * i.quantity, 0);
        const custoMantido = mantidaOk && !produtoVoltou ? custoPedido : 0;
        // "custo perdido nas devoluções" (Configurações): só se o produto chegou a sair (cancelado antes do envio não perde nada)
        // e não é a venda mantida sem retorno (lá o custo já entra em custoMantido — antes contava duas vezes)
        const custoProd = cfg.devolucao_perde_produto && saiu && !custoMantido ? custoPedido : 0;
        const tipo = cls.find(c => c.tipo === 'returns') ? 'devolução (produto retornou)' : cls.find(c => c.tipo === 'cancel_purchase') ? 'cancelamento pelo comprador' : cls.find(c => c.tipo === 'mediations') ? 'mediação' : freteCotado > 0 ? 'cancelado após envio' : 'cancelado antes do envio';
        devolucoes.push({ loja: x.loja, id: o.id, data: o.date_created, comprador: o.buyer?.nickname, envio: o.shipping?.id, tipo, reclamacoes: cls.map(c => c.id).join(','),
          reembolsado: reemb, freteIda, freteVolta, custoProd, tarifasPerdidas, perda: freteIda + freteVolta + tarifasPerdidas + custoProd,
          fonte: ex ? 'Fatura ML + Mercado Pago' : comMp ? 'Mercado Pago' : 'estimado', freteCobrado: ex ? ex.frete.cobrado : comMp ? sm('frete.cobrado') : freteCotado, freteEstornado: ex ? ex.frete.estornado : comMp ? sm('frete.estornado') : 0, tarifasCobradas: ex ? ex.comissao.cobrado : comMp ? sm('tarifas.cobrado') : 0, tarifasEstornadas: ex ? ex.comissao.estornado : comMp ? sm('tarifas.estornado') : 0, freteVoltaCobrado: ex ? ex.devolucao.cobrado : freteVolta,
          mantida: mantidaOk, vendaMantida, custoMantido, valorVenda, revertida, estimativaRevertida, retencaoMp: spl + fin, reembolsoPor: comMp ? [...new Set(pagos.flatMap(p => p.quem))].map(q => ({ bpp: 'Mercado Livre (proteção ao comprador)', collector: 'vendedor', admin: 'automático (pagamento não concluído)' }[q] || q)).join(', ') : '', estornoEm: comMp ? pagos.map(p => p.dataEstorno).filter(Boolean).sort().at(-1) || null : null,
          aguardandoEstorno: comMp && (freteIda + tarifasPerdidas) > 0.004 && cls.some(c => c.status !== 'closed'), motivos: cls.map(c => c.motivo).filter(Boolean), itensDet: (o.order_items || []).map(i => ({ id: i.item.id, sku: skuDe(x.loja, i.item), titulo: i.item.title, qtd: i.quantity, valor: i.unit_price * i.quantity })), itens: (o.order_items || []).map(i => i.item.title + ' x' + i.quantity).join(' | ') });
      }
      continue;
    }
    ordensOk.push(x);
    const d = dia(o.date_created);
    const rec = (o.order_items || []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
    x.rec = rec;
    if (o.shipping?.id) recEnvio[x.loja + ':' + o.shipping.id] = (recEnvio[x.loja + ':' + o.shipping.id] || 0) + rec;
    for (const i of o.order_items || []) { const k = x.loja + '|' + i.item.id + '|' + d; unidDia[k] = (unidDia[k] || 0) + i.quantity; }
  }
  // frete médio por unidade (por item) para estimar pedidos sem custo de envio coletado
  const somaFrete = {};
  for (const x of ordensOk) {
    const sid = x.o.shipping?.id, fk = x.loja + ':' + sid;
    if (!sid || frete[fk] === undefined || !recEnvio[fk]) continue;
    const parte = frete[fk] * (x.rec / recEnvio[fk]);
    for (const i of x.o.order_items) {
      const s = somaFrete[x.loja + '|' + i.item.id] ||= { f: 0, u: 0 };
      s.f += parte * (i.unit_price * i.quantity / x.rec); s.u += i.quantity;
    }
  }

  // alíquota (%) por loja/competência: automática (DAS do sistema fiscal) ou manual
  const autoPorLoja = Object.fromEntries(lojas.map(l => [l, cfg.aliquota_modo === 'auto' ? aliquotaAuto(l) : null]));
  const usadas = {};
  // mês sem alíquota calculada: usa a do mês conhecido mais próximo ANTERIOR (ou a primeira, se o mês é anterior a todo o histórico)
  const compsAuto = Object.fromEntries(lojas.map(l => [l, Object.keys(autoPorLoja[l]?.meses || {}).sort()]));
  const aliqPct = (loja, comp) => {
    const a = autoPorLoja[loja]?.meses, ks = compsAuto[loja];
    const perto = ks?.length ? (ks.filter(k => k <= comp).at(-1) ?? ks[0]) : null;
    const pct = a ? (a[comp]?.pct ?? a[perto]?.pct ?? cfg['aliquota_' + loja]) : cfg['aliquota_' + loja];
    (usadas[loja] ||= {})[comp] = pct; return pct;
  };
  const tot = { receita: 0, devolucao: 0, comissao: 0, frete: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, freteNF: 0, impostoFrete: 0 };
  const porDia = {}, porSku = {}, pedidos = [], porMes = {}, porItem = {};
  const mesDe = (mes, loja) => porMes[mes + '|' + loja] ||= { mes, loja, pedidos: 0, receita: 0, devolucao: 0, comissao: 0, frete: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, freteNF: 0, devolvido: 0, perdaDevolucao: 0, perdaPura: 0, adsSemVenda: 0 };
  let recSemCusto = 0, recFreteEst = 0, recSemAds = 0;
  const adsAlocado = {};

  for (const x of ordensOk) {
    const o = x.o, d = dia(o.date_created), aliq = aliqPct(x.loja, d.slice(0, 7)) / 100;
    const fk = x.loja + ':' + o.shipping?.id;
    const temFrete = o.shipping?.id && frete[fk] !== undefined;
    const reembolso = (o.payments || []).reduce((s, p) => s + (p.transaction_amount_refunded || 0), 0);
    const fracRef = x.rec ? Math.min(reembolso / x.rec, 1) : 0;
    const pedido = { loja: x.loja, id: o.id, data: o.date_created, comprador: o.buyer?.nickname, envio: o.shipping?.id, status: o.status, receita: 0, devolucao: 0, comissao: 0, frete: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, freteNF: 0, impostoFrete: 0, flags: [], itens: [] };
    // detalhe por item (análise por SKU); não enumerável para não pesar o JSON de /api/lucro
    Object.defineProperty(pedido, 'det', { value: [], enumerable: false });
    // Reembolso parcial (mediação decidida pelo ML, na maioria): as tarifas são estornadas na mesma proporção (conferido no MP),
    // mas o comprador em geral FICA com o produto — o custo só volta ao estoque quando o reembolso corresponde a unidades inteiras
    // de um pedido com mais de uma unidade (ou reembolso total) e a opção "custo perdido nas devoluções" está desligada.
    const unidDevolvidas = i => {
      if (!fracRef || cfg.devolucao_perde_produto) return 0;
      if (fracRef >= 0.99) return i.quantity;
      if ((o.order_items || []).length !== 1 || i.quantity < 2 || !i.unit_price) return 0;
      const k = reembolso / i.unit_price; return Math.abs(k - Math.round(k)) < 0.01 ? Math.min(Math.round(k), i.quantity) : 0;
    };
    for (const i of o.order_items || []) {
      const bruto = i.unit_price * i.quantity, sku = skuDe(x.loja, i.item);
      const dev = bruto * fracRef, comissao = (i.sale_fee || 0) * i.quantity * (1 - fracRef);
      let f;
      if (temFrete) f = frete[fk] * (bruto / recEnvio[fk]);
      else if (!o.shipping?.id) f = 0; // sem envio do ML (retirada/combinar): não há frete a pagar — antes recebia a média estimada
      else { const s = somaFrete[x.loja + '|' + i.item.id]; f = s ? (s.f / s.u) * i.quantity : 0; recFreteEst += bruto; pedido.flags.includes('frete estimado') || pedido.flags.push('frete estimado'); }
      const freteNF = (nfFrete[x.loja + ':' + o.id] ?? ((recvCost[fk] ?? 0) * (recEnvio[fk] ? x.rec / recEnvio[fk] : 0))) * (x.rec ? bruto / x.rec : 0) * (1 - fracRef);
      const imposto = (bruto - dev + freteNF) * aliq, impostoFrete = freteNF * aliq;
      const cUnit = cEm(sku, d) ?? cEm(i.item.id, d);
      const custo = cUnit == null ? 0 : cUnit * (i.quantity - unidDevolvidas(i));
      if (cUnit == null) { recSemCusto += bruto; pedido.flags.includes('sem custo') || pedido.flags.push('sem custo'); }
      let a = 0;
      const cd = ads[x.loja]?.[i.item.id]?.[d];
      if (cd) { a = cd * i.quantity / unidDia[x.loja + '|' + i.item.id + '|' + d]; adsAlocado[x.loja + '|' + i.item.id + '|' + d] = true; }
      const lucro = bruto - dev - comissao - f - imposto - custo - a;
      Object.assign(pedido, { receita: pedido.receita + bruto, devolucao: pedido.devolucao + dev, comissao: pedido.comissao + comissao, frete: pedido.frete + f, imposto: pedido.imposto + imposto, custo: pedido.custo + custo, ads: pedido.ads + a, lucro: pedido.lucro + lucro, freteNF: pedido.freteNF + freteNF, impostoFrete: pedido.impostoFrete + impostoFrete });
      const s = porSku[sku] ||= { sku, titulo: i.item.title, item: i.item.id, itens: new Set(), lojas: new Set(), unidades: 0, receita: 0, devolucao: 0, comissao: 0, frete: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, semCusto: false, custoUnit: custos[sku] ?? null };
      if (cUnit == null) s.semCusto = true; // basta um anúncio do SKU sem custo para o aviso aparecer
      const pi = porItem[x.loja + '|' + i.item.id] ||= { loja: x.loja, item: i.item.id, titulo: i.item.title, sku, categoria: i.item.category_id, unidades: 0, pedidos: 0, receita: 0, comissao: 0, frete: 0, imposto: 0, custo: 0, ads: 0, lucro: 0, semCusto: cUnit == null };
      pi.unidades += i.quantity; pi.pedidos++; pi.receita += bruto; pi.comissao += comissao; pi.frete += f; pi.imposto += imposto; pi.custo += custo; pi.ads += a; pi.lucro += lucro;
      s.lojas.add(x.loja); s.itens.add(i.item.id); s.unidades += i.quantity; s.receita += bruto; s.devolucao += dev; s.comissao += comissao; s.frete += f; s.imposto += imposto; s.custo += custo; s.ads += a; s.lucro += lucro;
      pedido.itens.push(`${i.item.title} x${i.quantity}`);
      pedido.itemId ||= i.item.id; pedido.qtd = (pedido.qtd || 0) + i.quantity;
      pedido.det.push({ sku, item: i.item.id, titulo: i.item.title, categoria: i.item.category_id, qtd: i.quantity, preco: i.unit_price, receita: bruto, devolucao: dev, comissao, frete: f, imposto, custo, ads: a, lucro });
    }
    if (fracRef > 0) pedido.flags.push(fracRef >= 0.99 ? 'devolvido' : 'reembolso parcial');
    for (const k of Object.keys(tot)) tot[k] += pedido[k] ?? 0;
    const pd = porDia[d + '|' + x.loja] ||= { dia: d, loja: x.loja, pedidos: 0, receita: 0, lucro: 0 };
    pd.pedidos++; pd.receita += pedido.receita; pd.lucro += pedido.lucro;
    const pm = mesDe(d.slice(0, 7), x.loja); pm.pedidos++;
    for (const k of ['receita', 'devolucao', 'comissao', 'frete', 'imposto', 'custo', 'ads', 'lucro', 'freteNF']) pm[k] += pedido[k];
    pedidos.push(pedido);
  }

  // Ads gasto sem venda no dia (custo que não pôde ser ligado a nenhum pedido)
  let adsSemVenda = 0;
  for (const loja of lojas) for (const [item, dias] of Object.entries(ads[loja])) for (const [d, v] of Object.entries(dias))
    if (d >= desde && d <= ate && !adsAlocado[loja + '|' + item + '|' + d]) { adsSemVenda += v; mesDe(d.slice(0, 7), loja).adsSemVenda += v; }

  const devolv = devolucoes.filter(d => dia(d.data) >= desde);
  // venda mantida por cobertura do ML: resultado = líquido recebido (já sem frete/comissão) − imposto da NF − custo do produto (se não voltou)
  for (const d of devolv) { d.imposto = d.mantida ? d.valorVenda * aliqPct(d.loja, dia(d.data).slice(0, 7)) / 100 : 0; d.resultadoMantido = d.mantida ? d.vendaMantida - d.imposto - d.custoMantido : 0; }
  for (const d of devolv) { const pm = mesDe(dia(d.data).slice(0, 7), d.loja); pm.devolvido += d.reembolsado; pm.perdaDevolucao += d.perda - d.resultadoMantido; pm.perdaPura += d.perda; }
  const totDev = { resultadoMantido: devolv.reduce((t, d) => t + d.resultadoMantido, 0), vendaMantida: devolv.reduce((t, d) => t + (d.vendaMantida || 0), 0), qtdVendaMantida: devolv.filter(d => d.mantida).length, devolvido: devolv.reduce((t, d) => t + d.reembolsado, 0), perdaDevolucao: devolv.reduce((t, d) => t + d.perda, 0), qtdDevolucoes: devolv.length,
    freteDevolucao: devolv.reduce((t, d) => t + d.freteIda + d.freteVolta, 0) };
  const lista = Object.values(porSku).map(s => ({ ...s, lojas: [...s.lojas], anuncios: s.itens.size, margem: s.receita ? s.lucro / s.receita : 0 })).sort((a, b) => b.receita - a.receita);
  const out = {
    config: cfg, desde, ate, aliquotasUsadas: usadas, aliquotaAuto: Object.fromEntries(lojas.map(l => [l, autoPorLoja[l] ? { cnpj: autoPorLoja[l].cnpj, nome: autoPorLoja[l].nome, anexo: autoPorLoja[l].anexo } : null])),
    total: { ...Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, r2(v)])), adsSemVenda: r2(adsSemVenda), ...Object.fromEntries(Object.entries(totDev).map(([k, v]) => [k, r2(v)])), lucroFinal: r2(tot.lucro - adsSemVenda - totDev.perdaDevolucao + totDev.resultadoMantido), margem: tot.receita ? (tot.lucro - adsSemVenda - totDev.perdaDevolucao + totDev.resultadoMantido) / tot.receita : 0, pedidos: ordensOk.length, canceladas },
    cobertura: { pctReceitaSemCusto: tot.receita ? recSemCusto / tot.receita : 0, pctReceitaFreteEstimado: tot.receita ? recFreteEst / tot.receita : 0, skusSemCusto: lista.filter(s => s.semCusto).length, skus: lista.length },
    porMes: Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes)).map(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v]))),
    diario: Object.values(porDia).sort((a, b) => a.dia.localeCompare(b.dia)).map(d => ({ ...d, receita: r2(d.receita), lucro: r2(d.lucro) })),
    skus: lista,
    porItem: Object.values(porItem),
    devolucoes: devolv.sort((a, b) => b.data.localeCompare(a.data)),
    pedidos: pedidos.sort((a, b) => a.lucro - b.lucro).slice(0, 300).map(p => ({ ...p, itens: p.itens.join(' | ') })),
  };
  // lista completa de pedidos (fora do JSON: não é enumerável, então /api/lucro e cia. continuam leves)
  Object.defineProperty(out, 'pedidosTodos', { value: pedidos, enumerable: false });
  cache.set(key, { t: Date.now(), v: out });
  return out;
}

// SKUs conhecidos (dos pedidos) para a tela de custos
export function listarSkus(lojas, desde) {
  const custos = getCustos(), m = {};
  const ph = lojas.map(() => '?').join(',');
  for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='order' AND status=200 AND loja IN (${ph}) AND date(json_extract(body,'$.date_created'),'-3 hours') >= ?`).all(...lojas, desde)) {
    const o = JSON.parse(r.body); if (o.status === 'cancelled') continue;
    for (const i of o.order_items || []) {
      const sku = skuDe(r.loja, i.item);
      const s = m[sku] ||= { sku, titulo: i.item.title, item: i.item.id, itens: new Set(), lojas: new Set(), vars: new Set(), unidades: 0, receita: 0, preco: i.unit_price };
      const va = (i.item.variation_attributes || []).map(a => `${a.name}: ${a.value_name}`).join(', '); if (va) s.vars.add(va); // ex.: "Cor: Preto, Tamanho: M"
      s.lojas.add(r.loja); s.itens.add(i.item.id); s.unidades += i.quantity; s.receita += i.unit_price * i.quantity;
    }
  }
  return Object.values(m).map(s => ({ ...s, lojas: [...s.lojas], vars: undefined, variacao: [...s.vars].slice(0, 3).join(' · ') + (s.vars.size > 3 ? ' …' : ''), anuncios: s.itens.size, custo: custos[s.sku] ?? custos[s.item] ?? null })).sort((a, b) => b.receita - a.receita);
}

// ── Fatura do ML (billing): classifica cada cobrança/bonificação ──
// Já modeladas por pedido: comissão (CV*), frete do vendedor (CXDE/CFFE/CFFI) e Ads (PADS, via API de Ads).
// NÃO modeladas por pedido (entram no DRE como "outras cobranças"): parcelamento, Full, eShop, devolução, DIFAL, outros.
// Parcelamento (CFONPN) = "Taxa de parcelamento (equivalente ao acréscimo no preço pago pelo comprador)": o comprador paga o acréscimo,
// o MP repassa ao vendedor (financing_transfer) e cobra de volta (financing_fee) — soma zero, NÃO é custo.
// Devolução (CXDED/CXDID/CDSDB) já entra pedido a pedido na "perda com devoluções" (extrato do pedido / claims).
export const CLASSE_FATURA = (tipo) => {
  if (tipo === 'PADS' || tipo === 'BPAD') return 'ads'; // BPAD = bonificação de Product Ads (crédito)
  const t = tipo.replace(/^B/, 'C'); // bonificação B* anula a cobrança C* correspondente
  if (t === 'CVAF') return 'outros'; // não aparece no extrato por pedido nem no sale_fee: cobrança não modelada por pedido
  if (/^CV/.test(t)) return 'comissao';
  if (['CXDE', 'CXDI', 'CFFE', 'CFFI'].includes(t)) return 'frete';
  if (['CXDED', 'CXDID', 'CDSDB'].includes(t)) return 'devolucao';
  if (t === 'CFONPN') return 'parcelamento';
  if (['CFWA', 'CFCBE', 'CFBA', 'CFPB'].includes(t) || /^CF[A-Z]/.test(t) && !['CFFE', 'CFFI'].includes(t)) return 'full';
  if (t === 'CESM') return 'eshop';
  if (t === 'CDIFAL') return 'difal';
  return 'outros';
};
export function faturasML(lojas) {
  const out = [];
  for (const loja of lojas) for (const r of db.prepare("SELECT chave, body FROM raw WHERE loja=? AND recurso='billing_summary' AND status=200").all(loja)) {
    const [grupo, key] = r.chave.split(':'); const j = JSON.parse(r.body), bi = j.bill_includes || {};
    const classes = {}, linhas = [];
    for (const c of bi.charges || []) { const k = CLASSE_FATURA(c.type); classes[k] = (classes[k] || 0) + c.amount; linhas.push({ tipo: c.type, label: c.label, valor: c.amount, classe: k }); }
    for (const c of bi.bonuses || []) { const k = CLASSE_FATURA(c.type); classes[k] = (classes[k] || 0) + c.amount; linhas.push({ tipo: c.type, label: c.label, valor: c.amount, classe: k, bonus: true }); }
    out.push({ loja, grupo, key, mes: key.slice(0, 7), total: bi.total_amount, periodo: j.period, classes: Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, r2(v)])), linhas });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
