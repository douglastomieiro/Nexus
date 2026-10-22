// Vendas (Fase 2): a lista de despacho como a do Mercado Livre (envios de hoje, próximos dias, Full, em trânsito, finalizadas),
// com o resultado de cada venda, e as ações da venda: etiqueta (PDF ou térmica), nota interna, anexar NF-e e iniciar conversa.
// Contas Shopee entram na mesma lista (só consulta). Toda ação passa por acoes.js (token de escrita + registro); a confirmação é na tela.
import { db, getRaw, saveRaw } from './db.js';
import { LOJAS, mlGet } from './ml.js';
import { SHOPEE } from './shopee.js';
import { calcular } from './margem.js';
import { calcularShopee } from './shopee-margem.js';
import { LOG, SUBSTATUS, hoje, addDias, r2, anuncios, spThumb } from './painel.js';
import { shopeeDoFiltro } from './recompra.js';
import { acaoML, enviaArquivos, baixaML, HA, SIMULADO } from './acoes.js';

const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const iso = d => { const t = typeof d === 'number' ? d * 1000 : d ? Date.parse(d) : NaN; return isNaN(t) ? null : new Date(t).toISOString(); };
const lojaOk = l => { if (!LOJAS[l]) throw erro('Conta desconhecida.'); return l; };
const pedidoDe = (loja, id) => { const o = getRaw(lojaOk(loja), 'order', String(id))?.body; if (!o?.id) throw erro('Venda não encontrada no banco.', 404); return o; };
const ph = a => a.map(() => '?').join(',') || "''";

const ST = { pending: 'Pendente', handling: 'Em preparação', ready_to_ship: 'Pronto para envio', shipped: 'A caminho', delivered: 'Entregue', not_delivered: 'Não entregue', cancelled: 'Cancelado' };
const SUB = SUBSTATUS;
const SP_ST = { READY_TO_SHIP: 'Pronto para envio', PROCESSED: 'Etiqueta gerada', RETRY_SHIP: 'Reenvio', SHIPPED: 'Enviado', TO_CONFIRM_RECEIVE: 'Entregue (aguardando confirmação)', COMPLETED: 'Concluído',
  IN_CANCEL: 'Cancelando', CANCELLED: 'Cancelado', TO_RETURN: 'Em devolução', INVOICE_PENDING: 'Aguardando nota' };
const FINAL = new Set(['delivered', 'not_delivered', 'cancelled']);
const TRANSITO = new Set(['dropped_off', 'picked_up', 'in_hub', 'authorized_by_carrier']);
const IMPRIMIVEL = new Set(['ready_to_print', 'printed']);
const NAO_PAGO = new Set(['payment_required', 'payment_in_process', 'invalid']);
// motivos para o vendedor puxar conversa (action guide do ML)
const OPCOES = { REQUEST_VARIANTS: 'Pedir a variação (cor, tamanho…)', REQUEST_BILLING_INFO: 'Pedir dados para a nota fiscal', SEND_INVOICE_LINK: 'Enviar o link da nota fiscal',
  DELIVERY_PROMISE: 'Informar o prazo de entrega (Flex)', OTHER: 'Outro assunto' };

// ───────── lista ─────────
let cache = { k: '', t: 0, v: null };
function lista(lojas) {
  const k = lojas.join(','); if (cache.k === k && Date.now() - cache.t < 45e3) return cache.v;
  const desde = addDias(hoje(), -44), spL = shopeeDoFiltro(lojas), an = anuncios(), agora = Date.now(), lim30 = agora - 30 * 864e5;
  const fimHoje = Date.parse(addDias(hoje(), 1) + 'T03:00:00Z');
  const contas = {}; try { for (const p of calcular({ lojas, desde }).pedidosTodos) contas[p.loja + ':' + p.id] = p; } catch (e) { console.error('[vendas] conta:', e.message); }
  const conta = p => p ? { receita: r2(p.receita), frete: r2(p.frete), freteNF: r2(p.freteNF), ads: r2(p.ads), lucro: r2(p.lucro), margem: p.receita ? p.lucro / p.receita : 0, semCusto: (p.flags || []).includes('sem custo') } : null;
  const abertas = db.prepare(`SELECT loja, json_extract(body,'$.resource_id') r, json_extract(body,'$.type') t FROM raw WHERE recurso='claim' AND status=200 AND json_extract(body,'$.status')='opened'`).all().filter(x => lojas.includes(x.loja));
  const recAberta = new Set(abertas.map(x => x.loja + ':' + x.r));
  const linhas = [];
  for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='order' AND status=200 AND loja IN (${ph(lojas)}) AND json_extract(body,'$.date_created') >= ?`).iterate(...lojas, desde)) {
    const o = parse(r.body); if (!o?.id || NAO_PAGO.has(o.status)) continue;
    const sid = o.shipping?.id, s0 = sid ? getRaw(r.loja, 'shipment', sid)?.body : null, s = s0?.id ? s0 : null;
    const sla = sid ? getRaw(r.loja, 'shipment_sla', sid)?.body : null, prazo = iso(sla?.expected_date), st = s?.status || null, sub = s?.substatus || null, full = s?.logistic_type === 'fulfillment';
    const aba = o.status === 'cancelled' || (st && FINAL.has(st)) ? 'finalizadas' : st === 'shipped' || TRANSITO.has(sub) ? 'transito' : full ? 'full'
      : !st ? 'proximos' : !prazo ? (st === 'ready_to_ship' ? 'hoje' : 'proximos') : Date.parse(prazo) < fimHoje ? 'hoje' : 'proximos';
    if (aba === 'finalizadas' && Date.parse(o.date_created) < lim30) continue;
    const p = contas[r.loja + ':' + o.id], nf = getRaw(r.loja, 'invoice', String(o.id)), i0 = o.order_items?.[0];
    linhas.push({ canal: 'ml', loja: r.loja, nomeLoja: LOJAS[r.loja].nome, id: String(o.id), pack: o.pack_id ? String(o.pack_id) : null, data: iso(o.date_created), aba, comprador: o.buyer?.nickname || null,
      itens: (o.order_items || []).map(i => ({ titulo: i.item.title, qtd: i.quantity, sku: i.item.seller_sku || null, variacao: (i.item.variation_attributes || []).map(v => v.value_name).join(' · ') })),
      thumb: an[r.loja + ':' + i0?.item?.id]?.thumb || null, total: o.total_amount, cancelado: o.status === 'cancelled',
      envio: s ? { id: String(sid), status: ST[st] || st, sub: SUB[sub] || (sub ? sub.replace(/_/g, ' ') : null), subId: sub, logistica: LOG[s.logistic_type] || 'Padrão', prazo, rastreio: s.tracking_number || null,
        atrasado: aba === 'hoje' && (sla?.status === 'delayed' || (!!prazo && Date.parse(prazo) < agora)), imprimir: !full && st === 'ready_to_ship' && IMPRIMIVEL.has(sub),
        impressa: !!s.date_first_printed || sub === 'printed', nfPendente: sub === 'invoice_pending', uf: (s.receiver_address?.state?.id || '').replace('BR-', '') || null } : null,
      nota: nf?.status === 200 && nf.body?.status ? (nf.body.status === 'authorized' ? 'emitida' : String(nf.body.status)) : null,
      conta: conta(p), reclamacao: recAberta.has(r.loja + ':' + o.id), publicidade: !!(p?.ads > 0) });
  }
  if (spL.length) {
    const cs = {}; try { for (const p of calcularShopee({ lojas: spL, desde }).pedidosTodos) cs[p.loja + ':' + p.id] = p; } catch (e) { console.error('[vendas] conta Shopee:', e.message); }
    const ini = Date.parse(desde + 'T03:00:00Z') / 1000;
    for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='sp_order' AND status=200 AND loja IN (${ph(spL)}) AND json_extract(body,'$.create_time') >= ?`).iterate(...spL, ini)) {
      const o = parse(r.body), st = o?.order_status; if (!o?.order_sn || st === 'UNPAID') continue;
      const prazo = iso(o.ship_by_date);
      const aba = ['READY_TO_SHIP', 'PROCESSED', 'RETRY_SHIP', 'INVOICE_PENDING'].includes(st) ? (prazo && Date.parse(prazo) >= fimHoje ? 'proximos' : 'hoje') : ['SHIPPED', 'TO_CONFIRM_RECEIVE'].includes(st) ? 'transito' : 'finalizadas';
      if (aba === 'finalizadas' && o.create_time * 1000 < lim30) continue;
      const p = cs[r.loja + ':' + o.order_sn], i0 = o.item_list?.[0];
      linhas.push({ canal: 'shopee', loja: r.loja, nomeLoja: SHOPEE[r.loja]?.nome || r.loja, id: o.order_sn, pack: null, data: iso(o.create_time), aba, comprador: o.buyer_username || null,
        itens: (o.item_list || []).map(i => ({ titulo: i.item_name, qtd: i.model_quantity_purchased || 1, sku: String(i.model_sku || i.item_sku || '').trim() || null, variacao: i.model_name || '' })),
        thumb: spThumb(r.loja, i0?.item_id), total: o.total_amount, cancelado: st === 'CANCELLED',
        envio: { id: null, status: SP_ST[st] || st, sub: null, subId: st, logistica: 'Shopee', prazo, rastreio: null, atrasado: aba === 'hoje' && !!prazo && Date.parse(prazo) < agora, imprimir: false, impressa: st === 'PROCESSED', nfPendente: st === 'INVOICE_PENDING', uf: null },
        nota: null, conta: conta(p), reclamacao: st === 'TO_RETURN', publicidade: !!(p?.ads > 0) });
    }
  }
  const quando = x => Date.parse(x.envio?.prazo || x.data) || 0;
  linhas.sort((a, b) => ['hoje', 'proximos', 'full'].includes(a.aba) && a.aba === b.aba ? quando(a) - quando(b) : Date.parse(b.data) - Date.parse(a.data));
  const H = linhas.filter(x => x.aba === 'hoje'), aDespachar = linhas.filter(x => x.aba === 'hoje' || x.aba === 'proximos');
  const limite = H.filter(x => x.envio?.prazo && !x.envio.atrasado).map(x => x.envio.prazo).sort()[0] || null;
  const v = { agora, temShopee: spL.length > 0, contagem: Object.fromEntries(['hoje', 'proximos', 'full', 'transito', 'finalizadas'].map(a => [a, linhas.filter(x => x.aba === a).length])),
    cards: { paraImprimir: H.filter(x => x.envio?.imprimir && !x.envio.impressa).length, impressas: H.filter(x => x.envio?.imprimir && x.envio.impressa).length, atrasadas: H.filter(x => x.envio?.atrasado).length, limite,
      nfPendente: aDespachar.filter(x => x.envio?.nfPendente).length, devolucoes: abertas.filter(x => x.t === 'returns').length, full: linhas.filter(x => x.aba === 'full').length,
      naAgencia: linhas.filter(x => x.envio?.subId === 'dropped_off' && Date.parse(x.data) > agora - 7 * 864e5).length },
    ultimaColeta: db.prepare(`SELECT max(coletado_em) t FROM raw WHERE recurso IN ('order','shipment') AND loja IN (${ph(lojas)})`).get(...lojas)?.t || null, linhas };
  cache = { k, t: Date.now(), v }; return v;
}

// relê os envios no ML depois de uma ação (etiqueta impressa, NF-e anexada), para a lista mostrar o estado novo sem esperar a coleta
async function atualizaEnvios(loja, ids) {
  cache.t = 0;
  for (const id of ids) {
    if (SIMULADO) { const s = getRaw(loja, 'shipment', id)?.body; if (s?.id && s.substatus === 'ready_to_print') saveRaw(loja, 'shipment', id, `/shipments/${id}`, 200, { ...s, substatus: 'printed', date_first_printed: new Date().toISOString() }); continue; }
    const r = await mlGet(loja, `/shipments/${id}`).catch(() => null);
    if (r?.status === 200 && r.body?.id) saveRaw(loja, 'shipment', id, `/shipments/${id}`, 200, r.body);
  }
}

// PDF de uma página com algumas linhas de texto (etiqueta do modo de teste)
function pdfSimples(linhas) {
  const txt = linhas.map((l, i) => `BT /F1 14 Tf 40 ${780 - i * 22} Td (${String(l).replace(/[()\\]/g, '')}) Tj ET`).join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${txt.length} >>\nstream\n${txt}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return new TextEncoder().encode(out);
}

// ───────── notas internas da venda (só o vendedor vê; até 300 caracteres) ─────────
const notasSim = (loja, pedido) => getRaw(loja, 'order_notes_sim', pedido)?.body?.lista || [];
async function notas(loja, pedido) {
  if (SIMULADO) return notasSim(loja, pedido);
  const r = await mlGet(loja, `/orders/${pedido}/notes`);
  if (r.status !== 200) throw erro('Não consegui ler as notas desta venda no Mercado Livre agora.', 502);
  const arr = Array.isArray(r.body) ? (r.body[0]?.results ?? r.body) : (r.body?.results || []);
  return arr.filter(n => n?.id).map(n => ({ id: String(n.id), texto: n.note, data: iso(n.date_last_updated || n.date_created) }));
}

export function registrarVendas(app, { H, lojasSel }) {
  // a lista vem só da aba aberta (as finalizadas passam de mil); contagens e cartões são de todas
  app.get('/api/vendas/lista', H(q => { const { linhas, ...v } = lista(lojasSel(q)), aba = String(q.aba || 'hoje');
    return { ...v, aba, linhas: linhas.filter(x => x.aba === aba).slice(0, 1500), lojas: [...new Map(linhas.map(x => [x.loja, x.nomeLoja]))].map(([loja, nome]) => ({ loja, nome })) }; }));

  // etiquetas de várias vendas da mesma conta: PDF (impressora comum) ou ZPL (térmica; o ML devolve um .zip)
  app.post('/api/vendas/etiquetas', async (req, res) => {
    try {
      const loja = lojaOk(req.body?.loja), zpl = req.body?.tipo === 'zpl';
      const ids = [...new Set((req.body?.envios || []).map(String))].filter(x => /^\d+$/.test(x)).slice(0, 50);
      if (!ids.length) throw erro('Escolha ao menos uma venda com a etiqueta liberada.');
      for (const id of ids) {
        const s = getRaw(loja, 'shipment', id)?.body; if (!s?.id) throw erro(`Envio ${id} não encontrado.`);
        if (s.logistic_type === 'fulfillment') throw erro(`O envio ${id} é Full: quem despacha é o Mercado Livre.`);
        if (!(s.status === 'ready_to_ship' && IMPRIMIVEL.has(s.substatus))) throw erro(`A etiqueta do envio ${id} não está liberada (${SUB[s.substatus] || ST[s.status] || s.status}).`);
      }
      const sim = zpl ? { tipo: 'text/plain', buf: new TextEncoder().encode(ids.map(i => `^XA^FO40,40^ADN,36,20^FDEtiqueta simulada ${i}^FS^XZ`).join('\n')) }
        : { tipo: 'application/pdf', buf: pdfSimples(['Etiqueta simulada (modo de teste)', `Conta: ${LOJAS[loja].nome}`, ...ids.map(i => `Envio ${i}`)]) };
      const r = await baixaML(loja, zpl ? 'venda.etiqueta_termica' : 'venda.etiqueta', ids.join(','), `/shipment_labels?shipment_ids=${ids.join(',')}&response_type=${zpl ? 'zpl2' : 'pdf'}`, sim);
      const ext = zpl ? (/zip/.test(r.tipo) ? 'zip' : 'txt') : 'pdf', nome = `etiquetas-${LOJAS[loja].nome}-${hoje()}.${ext}`.replace(/[^\w.-]+/g, '_');
      res.setHeader('Content-Type', r.tipo || 'application/octet-stream'); res.setHeader('Content-Disposition', `attachment; filename="${nome}"`); res.end(r.buf);
      atualizaEnvios(loja, ids).catch(e => console.error('[vendas] envios:', e.message)); // o ML marca as etiquetas como impressas
    } catch (e) { if (!e.status) console.error(e); res.status(e.status || 500).json({ erro: e.message }); }
  });

  app.get('/api/vendas/notas', HA(q => { pedidoDe(q.loja, q.pedido); return notas(String(q.loja), String(q.pedido)); }));
  app.post('/api/vendas/notas', HA(async (_, req) => {
    const { loja, pedido } = req.body || {}, texto = String(req.body?.texto || '').replace(/\r\n?/g, '\n').trim(); pedidoDe(loja, pedido);
    if (!texto) throw erro('Escreva a nota.'); if (texto.length > 300) throw erro(`A nota tem ${texto.length} caracteres; o limite do Mercado Livre é 300.`);
    await acaoML(loja, 'venda.nota', pedido, 'POST', `/orders/${pedido}/notes`, { note: texto });
    if (SIMULADO) saveRaw(loja, 'order_notes_sim', String(pedido), '', 200, { lista: [...notasSim(loja, String(pedido)), { id: 'sim_' + Date.now(), texto, data: new Date().toISOString() }] });
    return notas(loja, String(pedido));
  }));
  app.post('/api/vendas/notas/apagar', HA(async (_, req) => {
    const { loja, pedido, nota } = req.body || {}; pedidoDe(loja, pedido); if (!/^[\w-]+$/.test(String(nota || ''))) throw erro('Nota inválida.');
    await acaoML(loja, 'venda.nota_apagar', pedido, 'DELETE', `/orders/${pedido}/notes/${nota}`);
    if (SIMULADO) saveRaw(loja, 'order_notes_sim', String(pedido), '', 200, { lista: notasSim(loja, String(pedido)).filter(n => n.id !== String(nota)) });
    return notas(loja, String(pedido));
  }));

  // NF-e emitida fora do ML: XML e/ou PDF anexados ao pacote da venda
  app.post('/api/vendas/nfe', HA(async (_, req) => {
    const { loja, pedido } = req.body || {}, o = pedidoDe(loja, pedido), arqs = (req.body?.anexos || []).slice(0, 2);
    if (!arqs.length) throw erro('Escolha o XML (e, se quiser, o PDF) da nota.');
    for (const a of arqs) if (!/\.(xml|pdf)$/i.test(a.nome || '')) throw erro(`${a.nome}: o Mercado Livre aceita só XML ou PDF.`);
    const mime = a => /\.pdf$/i.test(a.nome) ? 'application/pdf' : 'application/xml';
    const r = await enviaArquivos(loja, 'venda.nfe', String(pedido), `/packs/${o.pack_id || o.id}/fiscal_documents`, arqs.map(a => ({ ...a, mime: mime(a) })), 'fiscal_document');
    if (o.shipping?.id) atualizaEnvios(loja, [String(o.shipping.id)]).catch(() => {});
    return { ok: true, ids: r.ids || [] };
  }));

  // conversa: se já existe, a tela abre o Atendimento; senão, os motivos que o ML libera para o vendedor começar
  app.get('/api/vendas/conversa', HA(async q => {
    const loja = String(q.loja || ''), o = pedidoDe(loja, q.pedido), pack = String(o.pack_id || o.id);
    const existe = (getRaw(loja, 'messages_pack', pack)?.body?.messages || []).length > 0;
    let opcoes = [], motivo = null;
    if (!existe) {
      const r = SIMULADO ? { status: 200, body: { options: [{ id: 'REQUEST_BILLING_INFO', type: 'template', enabled: true, templates: [{ id: 'TEMPLATE___REQUEST_BILLING_INFO___1' }], cap_available: 1 }, { id: 'OTHER', type: 'free_text', enabled: true, char_limit: 350, cap_available: 1 }] } }
        : await mlGet(loja, `/messages/action_guide/packs/${pack}?tag=post_sale`);
      if (r.status === 200) opcoes = (r.body?.options || []).filter(x => x.enabled !== false && x.actionable !== false && x.cap_available !== 0)
        .map(x => ({ id: x.id, txt: OPCOES[x.id] || x.id, livre: x.type === 'free_text', template: x.templates?.[0]?.id || null, limite: x.char_limit || 350 }));
      else motivo = 'O Mercado Livre não liberou os motivos de contato agora.';
      if (r.status === 200 && !opcoes.length) motivo = 'O Mercado Livre não deixa você começar a conversa nesta venda agora (no Full, só depois da entrega; e o comprador precisa responder antes de uma nova mensagem).';
    }
    return { pack, existe, opcoes, motivo };
  }));
  app.post('/api/vendas/conversa', HA(async (_, req) => {
    const { loja, pedido, opcao } = req.body || {}, o = pedidoDe(loja, pedido), pack = String(o.pack_id || o.id), texto = String(req.body?.texto || '').replace(/\r\n?/g, '\n').trim();
    if (!OPCOES[opcao]) throw erro('Escolha o motivo da mensagem.');
    const g = SIMULADO ? null : await mlGet(loja, `/messages/action_guide/packs/${pack}?tag=post_sale`);
    const op = SIMULADO ? { type: opcao === 'OTHER' || opcao === 'SEND_INVOICE_LINK' ? 'free_text' : 'template', templates: [{ id: `TEMPLATE___${opcao}___1` }], char_limit: 350 } : (g?.body?.options || []).find(x => x.id === opcao);
    if (!op) throw erro('O Mercado Livre não libera mais esse motivo nesta venda. Abra a ficha de novo.');
    const livre = op.type === 'free_text';
    if (livre && !texto) throw erro('Escreva a mensagem.');
    if (livre && texto.length > (op.char_limit || 350)) throw erro(`A mensagem passa do limite de ${op.char_limit || 350} caracteres.`);
    await acaoML(loja, 'venda.iniciar_conversa', pack, 'POST', `/messages/action_guide/packs/${pack}/option?tag=post_sale`, livre ? { option_id: opcao, text: texto } : { option_id: opcao, template_id: op.templates?.[0]?.id });
    return { ok: true, pack };
  }));
}
