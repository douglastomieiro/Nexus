// Central de atendimento (Fase 1): perguntas, mensagens pós-venda e reclamações/devoluções, com as ações do Mercado Livre.
// Listas saem do banco (coletas de 1 e 5 min); conversa e reclamação abertas na tela são lidas ao vivo do ML.
// Toda ação passa por acoes.js (token de escrita + registro); a confirmação é feita na tela antes de chamar a rota.
import { db, getRaw, saveRaw } from './db.js';
import { LOJAS, mlGet } from './ml.js';
import { calcular } from './margem.js';
import { setConfig } from './margem.js';
import { anuncios, addDias, hoje } from './painel.js';
import { acaoML, enviaArquivo, contaDaLoja, HA, SIMULADO } from './acoes.js';

const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const iso = d => { const t = d ? Date.parse(d) : NaN; return isNaN(t) ? null : new Date(t).toISOString(); };
const lojaOk = l => { if (!LOJAS[l]) throw erro('Conta desconhecida.'); return l; };
const AGENTE_MLB = '3037675074'; // agente de mensagens do ML no Brasil (conversas intermediadas)
const LIMITE_MSG = 350;
const sp = s => String(s ?? '').replace(/\r\n?/g, '\n'); // o ML recusa CRLF

// id do vendedor da conta: o da conta de escrita; sem ela, o da conta coletada
const idVendedor = loja => contaDaLoja(loja)?.id || db.prepare(`SELECT chave FROM raw WHERE loja=? AND recurso='user_me' AND status=200`).get(loja)?.chave
  || db.prepare(`SELECT json_extract(body,'$.user_id') u FROM raw WHERE loja=? AND recurso='messages_unread'`).get(loja)?.u;

// margem e lucro dos últimos 30 dias por anúncio (para mostrar ao lado da pergunta)
let cacheMg = { t: 0, m: {} };
const margens = () => {
  if (Date.now() - cacheMg.t < 120e3) return cacheMg.m;
  const m = {}; try { for (const p of calcular({ lojas: Object.keys(LOJAS), desde: addDias(hoje(), -29) }).porItem) m[p.loja + ':' + p.item] = { margem: p.receita ? p.lucro / p.receita : null, unidades: p.unidades, semCusto: p.semCusto }; } catch { /* sem dados */ }
  cacheMg = { t: Date.now(), m }; return m;
};
const anuncio = (loja, item) => { const a = anuncios()[loja + ':' + item] || {}, mg = margens()[loja + ':' + item] || {};
  const tit = a.titulo || parse(db.prepare(`SELECT body FROM raw WHERE loja=? AND recurso='item' AND chave=?`).get(loja, item)?.body || 'null')?.title || item;
  return { id: item, titulo: tit, thumb: a.thumb || null, preco: a.preco ?? null, estoque: a.estoque ?? null, lg: a.lg || null, link: a.link || null, status: a.status || null, margem30: mg.margem ?? null, vendidos30: mg.unidades ?? 0, semCusto: !!mg.semCusto }; };

// perda real de cada venda devolvida ou cancelada nos últimos 180 dias (o mesmo cálculo da tela Devoluções), por conta:pedido
const r2 = v => Math.round((v || 0) * 100) / 100;
let cachePd = { t: 0, m: {} };
const perdas = () => {
  if (Date.now() - cachePd.t < 120e3) return cachePd.m;
  const m = {}; try { for (const d of calcular({ lojas: Object.keys(LOJAS), desde: addDias(hoje(), -179) }).devolucoes) m[d.loja + ':' + d.id] = d; } catch (e) { console.error('[atendimento] perdas:', e.message); }
  cachePd = { t: Date.now(), m }; return m;
};
// quanto a reclamação custou: a conta final quando o reembolso já saiu; antes disso, só o frete de volta que o ML vai cobrar
const contaPerda = (loja, pedido, claim) => {
  const d = perdas()[loja + ':' + pedido];
  if (d) return { final: true, reembolsado: r2(d.reembolsado), reembolsoPor: d.reembolsoPor || '', freteIda: r2(d.freteIda), freteVolta: r2(d.freteVolta), tarifas: r2(d.tarifasPerdidas), custoProduto: r2(d.custoProd),
    mantida: !!d.mantida, resultadoMantido: r2(d.resultadoMantido), perda: r2(d.perda - (d.resultadoMantido || 0)), fonte: d.fonte, aguardandoEstorno: !!d.aguardandoEstorno };
  const volta = getRaw(loja, 'claim_return_cost', claim)?.body?.amount;
  return volta ? { final: false, freteVolta: r2(volta), perda: r2(volta) } : null;
};

// ───────── Perguntas ─────────
const faixa = d => { const x = new Date(Date.parse(d) - 3 * 3600e3), dw = x.getUTCDay(), h = x.getUTCHours(); return dw === 0 || dw === 6 ? 'fds' : h >= 9 && h < 18 ? 'comercial' : 'fora'; };
function perguntas(q) {
  const abertas = q.status !== 'respondidas', desde = Date.now() - (Math.min(Math.max(parseInt(q.dias) || 15, 1), 90)) * 864e5;
  const ids = {}; // lista das sem resposta guardada pelos avisos (até 15 min); sem ela, o status no banco
  for (const r of db.prepare(`SELECT loja, body, coletado_em FROM raw WHERE recurso='avisos_perguntas' AND status=200`).all())
    if (Date.now() - r.coletado_em < 15 * 60e3) ids[r.loja] = new Set((parse(r.body)?.ids || []).map(String));
  const todas = db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='question' AND status=200`).all().filter(r => LOJAS[r.loja]).map(r => ({ loja: r.loja, id: r.chave, q: parse(r.body) })).filter(x => x.q);
  const porComprador = {}; for (const x of todas) { const c = String(x.q.from?.id || ''); if (c) (porComprador[c] ||= []).push(x); }
  const lista = todas.filter(x => abertas ? (ids[x.loja] ? ids[x.loja].has(x.id) : x.q.status === 'UNANSWERED') : x.q.status === 'ANSWERED' && Date.parse(x.q.date_created) >= desde)
    .sort((a, b) => abertas ? Date.parse(a.q.date_created) - Date.parse(b.q.date_created) : Date.parse(b.q.date_created) - Date.parse(a.q.date_created)).slice(0, 300)
    .map(({ loja, id, q: p }) => {
      const comp = String(p.from?.id || ''), outras = (porComprador[comp] || []).filter(x => x.id !== id).sort((a, b) => Date.parse(b.q.date_created) - Date.parse(a.q.date_created));
      return { loja, nomeLoja: LOJAS[loja].nome, id, data: iso(p.date_created), texto: p.text, status: p.status, comprador: comp || null,
        resposta: p.answer?.text ? { texto: p.answer.text, data: iso(p.answer.date_created), minutos: Math.round((Date.parse(p.answer.date_created) - Date.parse(p.date_created)) / 60e3) } : null,
        anteriores: outras.slice(0, 5).map(x => ({ data: iso(x.q.date_created), texto: x.q.text, resposta: x.q.answer?.text || null, item: x.q.item_id })), totalAnteriores: outras.length,
        anuncio: anuncio(loja, p.item_id) };
    });
  // tempo de resposta dos últimos 14 dias, por faixa de horário da pergunta (como na tela Perguntas do ML)
  const lim = Date.now() - 14 * 864e5, F = { comercial: [], fora: [], fds: [] };
  for (const x of todas) if (x.q.answer?.date_created && Date.parse(x.q.date_created) >= lim) F[faixa(x.q.date_created)].push((Date.parse(x.q.answer.date_created) - Date.parse(x.q.date_created)) / 60e3);
  const media = a => (a.length ? Math.round(a.reduce((t, v) => t + v, 0) / a.length) : null), tudo = [...F.comercial, ...F.fora, ...F.fds];
  return { abertas: todas.filter(x => ids[x.loja] ? ids[x.loja].has(x.id) : x.q.status === 'UNANSWERED').length, lista,
    tempo: { geral: media(tudo), n: tudo.length, comercial: media(F.comercial), fora: media(F.fora), fds: media(F.fds), ateUmaHora: tudo.length ? tudo.filter(v => v <= 60).length / tudo.length : null } };
}
// depois de uma ação, tira a pergunta da lista de sem resposta (o sino e a tela mudam na hora) e guarda a versão nova
async function atualizaPergunta(loja, id, local) {
  const snap = db.prepare(`SELECT chave, body FROM raw WHERE loja=? AND recurso='avisos_perguntas'`).get(loja);
  if (snap) { const b = parse(snap.body) || {}; b.ids = (b.ids || []).filter(x => String(x) !== String(id)); saveRaw(loja, 'avisos_perguntas', snap.chave, 'questions/search', 200, b); }
  const r = SIMULADO ? null : await mlGet(loja, `/questions/${id}?api_version=4`).catch(() => null); // simulado: o ML não mudou, fica a versão local
  if (r?.status === 200 && r.body?.id) saveRaw(loja, 'question', id, 'questions', 200, r.body);
  else { const at = getRaw(loja, 'question', id)?.body; if (at && typeof at === 'object') saveRaw(loja, 'question', id, 'questions', 200, { ...at, ...local }); }
}

// ───────── Mensagens ─────────
// pedidos recentes por pack (e por id, quando a venda não tem pack): comprador, produto e valor da conversa
const pedidosPorPack = loja => {
  const m = {};
  for (const r of db.prepare(`SELECT chave, body FROM raw WHERE loja=? AND recurso='order' AND status=200 AND coletado_em > ?`).all(loja, Date.now() - 120 * 864e5)) {
    const o = parse(r.body); if (!o) continue; const k = String(o.pack_id || o.id); (m[k] ||= []).push(o);
  }
  return m;
};
const resumoPedido = (loja, os) => { if (!os?.length) return null; const o = os[0], i = o.order_items?.[0];
  return { pedido: String(o.id), comprador: o.buyer?.nickname || null, compradorId: String(o.buyer?.id || ''), data: iso(o.date_created), status: o.status, total: os.reduce((t, x) => t + (x.total_amount || 0), 0),
    titulo: i?.item?.title || '', item: i?.item?.id || null, thumb: anuncios()[loja + ':' + i?.item?.id]?.thumb || null, itens: os.reduce((t, x) => t + (x.order_items?.length || 0), 0) }; };
const msgsDe = (body, vendedor) => (body?.messages || []).map(m => ({ id: m.id, de: String(m.from?.user_id) === String(vendedor) ? 'voce' : 'comprador', texto: m.text, data: iso(m.message_date?.created),
  lida: !!m.message_date?.read, moderada: m.message_moderation?.status === 'rejected', anexos: (m.message_attachments || []).map(a => a.original_filename || a.filename) }))
  .sort((a, b) => String(a.data).localeCompare(String(b.data)));
function conversas() {
  const out = [];
  for (const loja of Object.keys(LOJAS)) {
    const vend = idVendedor(loja), peds = pedidosPorPack(loja), nao = {};
    const un = parse(db.prepare(`SELECT body FROM raw WHERE loja=? AND recurso='messages_unread' AND status=200`).get(loja)?.body || 'null');
    for (const x of un?.results || []) { const pk = JSON.stringify(x).match(/packs\/(\d+)/)?.[1]; if (pk) nao[pk] = x.count || 1; }
    const vistos = new Set();
    const add = (pack, body) => { if (vistos.has(pack)) return; vistos.add(pack); const ms = msgsDe(body, vend), ult = ms.at(-1);
      out.push({ loja, nomeLoja: LOJAS[loja].nome, pack, naoLidas: nao[pack] || 0, ultima: ult ? { texto: ult.texto, data: ult.data, de: ult.de } : null, ...resumoPedido(loja, peds[pack]),
        bloqueada: body?.conversation_status?.status && body.conversation_status.status !== 'active' ? (body.conversation_status.substatus || body.conversation_status.status) : null }); };
    for (const r of db.prepare(`SELECT chave, body FROM raw WHERE loja=? AND recurso='messages_pack' AND status=200 AND coletado_em > ?`).all(loja, Date.now() - 60 * 864e5)) {
      const b = parse(r.body); if (b?.messages?.length || nao[r.chave]) add(r.chave, b);
    }
    for (const pk of Object.keys(nao)) add(pk, null);
  }
  return out.sort((a, b) => (b.naoLidas > 0) - (a.naoLidas > 0) || String(b.ultima?.data || b.data || '').localeCompare(String(a.ultima?.data || a.data || '')));
}
// abre a conversa: lê ao vivo no ML (isso a marca como lida lá, como quando se abre no ML)
async function conversa(loja, pack) {
  lojaOk(loja); const vend = idVendedor(loja); if (!vend) throw erro('Não achei o id do vendedor desta conta.');
  const caminho = `/messages/packs/${pack}/sellers/${vend}?tag=post_sale&limit=50`;
  const r = await mlGet(loja, caminho);
  if (r.status === 200) saveRaw(loja, 'messages_pack', pack, caminho, 200, r.body);
  const b = r.status === 200 ? r.body : getRaw(loja, 'messages_pack', pack)?.body;
  const st = b?.conversation_status || {}, peds = pedidosPorPack(loja)[pack];
  return { loja, nomeLoja: LOJAS[loja].nome, pack, aoVivo: r.status === 200, mensagens: msgsDe(b, vend), limite: b?.seller_max_message_length || LIMITE_MSG,
    status: st.status || null, motivo: st.substatus || null, podeEnviar: !st.status || st.status === 'active', pedido: resumoPedido(loja, peds) };
}
async function enviaMensagem(b) {
  const loja = lojaOk(b.loja), pack = String(b.pack || ''), texto = sp(b.texto).trim();
  if (!/^\d+$/.test(pack)) throw erro('Conversa inválida.');
  if (!texto && !b.anexos?.length) throw erro('Escreva a mensagem.');
  if (texto.length > LIMITE_MSG) throw erro(`A mensagem tem ${texto.length} caracteres; o limite do Mercado Livre é ${LIMITE_MSG}.`);
  const vend = idVendedor(loja), conv = getRaw(loja, 'messages_pack', pack)?.body, ped = pedidosPorPack(loja)[pack]?.[0];
  // conversa intermediada pelo agente do ML (caminho com /conversations/ ou mensagens do agente) → a mensagem vai para o agente
  const viaAgente = /\/conversations\//.test(conv?.conversation_status?.path || '') || (conv?.messages || []).some(m => String(m.from?.user_id) === AGENTE_MLB || String(m.to?.user_id) === AGENTE_MLB);
  const para = viaAgente ? AGENTE_MLB : String(ped?.buyer?.id || (conv?.messages || []).find(m => String(m.from?.user_id) !== String(vend))?.from?.user_id || '');
  if (!para) throw erro('Não achei o comprador desta conversa. Abra a conversa de novo e tente outra vez.');
  const anexos = [];
  for (const a of (b.anexos || []).slice(0, 5)) anexos.push((await enviaArquivo(loja, 'mensagem.anexo', pack, '/messages/attachments?tag=post_sale&site_id=MLB', a)).id);
  await acaoML(loja, 'mensagem.enviar', pack, 'POST', `/messages/packs/${pack}/sellers/${vend}?tag=post_sale`, { from: { user_id: vend }, to: { user_id: para }, text: texto, ...(anexos.length ? { attachments: anexos } : {}) });
  const C = await conversa(loja, pack);
  // sem leitura ao vivo (ou simulado) a cópia guardada ainda não tem a mensagem: mostra a que acabou de ir
  if (!C.aoVivo || SIMULADO) C.mensagens.push({ id: 'enviada_' + Date.now(), de: 'voce', texto, data: new Date().toISOString(), lida: false, moderada: false, anexos: (b.anexos || []).slice(0, 5).map(a => a.nome) });
  return C;
}

// ───────── Reclamações e devoluções ─────────
const TIPO = { returns: 'Devolução', mediations: 'Mediação', cancel_purchase: 'Cancelamento', fulfillment: 'Reclamação (Full)' };
const ETAPA = { claim: 'Reclamação', dispute: 'Mediação (com o ML)', recontact: 'Recontato', none: '—', stale: 'Parada' };
// ações que o vendedor pode tomar, como o ML as lista em players[respondent].available_actions
export const ACOES_REC = {
  send_message_to_complainant: { txt: 'Enviar mensagem ao comprador', msg: 'complainant' },
  send_message_to_mediator: { txt: 'Enviar mensagem ao mediador do ML', msg: 'mediator' },
  refund: { txt: 'Reembolsar o comprador (total)', caminho: 'expected-resolutions/refund', perigo: 'O comprador recebe o dinheiro de volta e a reclamação se encerra. Não dá para desfazer.' },
  allow_return: { txt: 'Aceitar a devolução', caminho: 'expected-resolutions/allow-return', perigo: 'O comprador recebe a etiqueta para devolver o produto e o reembolso sai quando ele chegar.' },
  allow_partial_refund: { txt: 'Oferecer reembolso parcial', caminho: 'expected-resolutions/partial-refund', percentual: true, perigo: 'O comprador recebe a parte do valor que você escolher, se aceitar.' },
  partial_refund: { txt: 'Oferecer reembolso parcial', caminho: 'expected-resolutions/partial-refund', percentual: true, perigo: 'O comprador recebe a parte do valor que você escolher, se aceitar.' },
  open_dispute: { txt: 'Pedir mediação do Mercado Livre', caminho: 'actions/open-dispute', perigo: 'O Mercado Livre passa a decidir o caso. Depois disso, as mensagens vão para o mediador.' },
  return_review_ok: { txt: 'Produto devolvido chegou bem', revisao: 'ok', perigo: 'Você confirma ao Mercado Livre que o produto voltou em boas condições. O reembolso ao comprador segue e não dá para contestar depois.' },
  return_review_fail: { txt: 'Reportar problema no produto devolvido', revisao: 'falha' },
};
// motivos da revisão com problema (POST /returns/{id}/return-review); o ML pede foto para SRF2 e SRF4
const MOTIVOS_REV = { SRF2: 'O produto chegou danificado', SRF3: 'A devolução está incompleta', SRF4: 'Devolveram um produto diferente do que enviei', SRF5: 'O produto não está no pacote', SRF6: 'Outro problema no produto', SRF7: 'A devolução ainda não chegou' };
const FOTO_OBRIGATORIA = new Set(['SRF2', 'SRF4']);
const DEV_ST = { pending: 'Criando o envio', label_generated: 'Etiqueta pronta: o comprador ainda não postou', scheduled: 'Coleta agendada', shipped: 'A caminho', pending_delivered: 'Chegando', delivered: 'Entregue',
  not_delivered: 'Não entregue', return_to_buyer: 'Voltando para o comprador', cancelled: 'Cancelada', expired: 'Expirou: o comprador não postou', failed: 'Falhou', pending_cancel: 'Cancelando', pending_expiration: 'Expirando', pending_failure: 'Falhando' };
const ENV_ST = { pending: 'criado', ready_to_ship: 'pronto para postar', shipped: 'a caminho', not_delivered: 'não entregue', delivered: 'entregue', cancelled: 'cancelado' };
const DINHEIRO = { retained: 'retido pelo Mercado Livre', refunded: 'devolvido ao comprador', available: 'liberado para você' };
const REEMB = { shipped: 'quando o comprador postar o produto', delivered: '3 dias depois de o produto chegar', 'n/a': 'sem devolução do produto (baixo valor)' };
const acoesDe = c => (c?.players || []).find(p => p.role === 'respondent')?.available_actions || [];
function reclamacoes(q) {
  const desde = Date.now() - (Math.min(Math.max(parseInt(q.dias) || 60, 1), 365)) * 864e5, out = [];
  for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='claim' AND status=200`).all()) {
    if (!LOJAS[r.loja]) continue; const c = parse(r.body); if (!c) continue;
    if (c.status !== 'opened' && Date.parse(c.last_updated || c.date_created) < desde) continue;
    const o = parse(db.prepare(`SELECT body FROM raw WHERE loja=? AND recurso='order' AND chave=?`).get(r.loja, String(c.resource_id))?.body || 'null');
    const ac = acoesDe(c), prazo = ac.map(a => a.due_date).filter(Boolean).sort()[0] || null, af = getRaw(r.loja, 'claim_affects-reputation', c.id)?.body;
    out.push({ loja: r.loja, nomeLoja: LOJAS[r.loja].nome, id: String(c.id), tipo: TIPO[c.type] || c.type, etapa: ETAPA[c.stage] || c.stage, aberta: c.status === 'opened', data: iso(c.date_created), atualizada: iso(c.last_updated),
      motivo: getRaw(r.loja, 'claim_reason', c.reason_id)?.body?.detail || c.reason_id, pedido: String(c.resource_id), prazo: iso(prazo),
      acoes: ac.map(a => ({ acao: a.action, txt: ACOES_REC[a.action]?.txt || a.action, obrigatoria: !!a.mandatory, prazo: iso(a.due_date) })),
      afetaReputacao: af && typeof af === 'object' ? !!(af.affects_reputation ?? af.affectsReputation) : null,
      resolucao: c.resolution ? (c.resolution.reason || c.resolution.benefited?.join?.(', ') || 'resolvida') : null,
      produto: o?.order_items?.[0]?.item?.title || null, thumb: anuncios()[r.loja + ':' + o?.order_items?.[0]?.item?.id]?.thumb || null, valor: o?.total_amount ?? null, comprador: o?.buyer?.nickname || null,
      perda: contaPerda(r.loja, String(c.resource_id), c.id) });
  }
  return out.sort((a, b) => b.aberta - a.aberta || String(a.prazo || '9').localeCompare(String(b.prazo || '9')) || String(b.data).localeCompare(String(a.data)));
}
// produtos com mais reclamações no período (sem cancelamentos de compra), com a perda real e a taxa sobre as vendas
const NAO_DEVOLUCAO = new Set(['cancel_purchase', 'cancel_sale']);
let cacheVd = { k: '', t: 0, v: {} };
function rankingReclamacoes(q) {
  const dias = Math.min(Math.max(parseInt(q.dias) || 60, 7), 365), desde = Date.now() - dias * 864e5;
  if (cacheVd.k !== String(dias) || Date.now() - cacheVd.t > 120e3) {
    const v = {}; try { for (const p of calcular({ lojas: Object.keys(LOJAS), desde: addDias(hoje(), -(dias - 1)) }).porItem) v[p.loja + ':' + p.item] = (v[p.loja + ':' + p.item] || 0) + p.unidades; } catch (e) { console.error('[atendimento] ranking:', e.message); }
    cacheVd = { k: String(dias), t: Date.now(), v };
  }
  const P = {}, an = anuncios(), vistos = new Set();
  for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='claim' AND status=200`).all()) {
    if (!LOJAS[r.loja]) continue; const c = parse(r.body);
    if (!c || NAO_DEVOLUCAO.has(c.type) || !(Date.parse(c.date_created) >= desde)) continue;
    const o = parse(db.prepare(`SELECT body FROM raw WHERE loja=? AND recurso='order' AND chave=?`).get(r.loja, String(c.resource_id))?.body || 'null');
    const mo = getRaw(r.loja, 'claim_reason', c.reason_id)?.body?.detail || c.reason_id;
    (o?.order_items || []).forEach((i, n) => {
      const k = r.loja + ':' + i.item.id, x = P[k] ||= { loja: r.loja, nomeLoja: LOJAS[r.loja].nome, item: i.item.id, titulo: an[k]?.titulo || i.item.title, thumb: an[k]?.thumb || null, reclamacoes: 0, unidades: 0, perda: 0, motivos: {} };
      x.reclamacoes++; x.unidades += i.quantity || 1; if (mo) x.motivos[mo] = (x.motivos[mo] || 0) + 1;
      // a perda é da venda inteira: entra uma vez só, no primeiro item
      if (n === 0 && !vistos.has(r.loja + ':' + c.resource_id)) { vistos.add(r.loja + ':' + c.resource_id); x.perda += contaPerda(r.loja, String(c.resource_id), c.id)?.perda || 0; }
    });
  }
  return { dias, lista: Object.values(P).map(({ motivos, ...x }) => { const v = cacheVd.v[x.loja + ':' + x.item] || 0;
    return { ...x, perda: r2(x.perda), vendidos: v, taxa: v + x.unidades ? x.unidades / (v + x.unidades) : null, motivo: Object.entries(motivos).sort((a, b) => b[1] - a[1])[0]?.[0] || null }; })
    .sort((a, b) => b.reclamacoes - a.reclamacoes || b.perda - a.perda).slice(0, 15) };
}
async function reclamacao(loja, id) {
  lojaOk(loja); if (!/^\d+$/.test(String(id))) throw erro('Reclamação inválida.');
  // simulado (teste): nada vai ao ML, usa as cópias coletadas como se fossem ao vivo
  const guardado = rec => ({ status: getRaw(loja, rec, id)?.body ? 200 : 0, body: getRaw(loja, rec, id)?.body });
  const [c, m0, e0] = SIMULADO ? [guardado('claim'), { status: 0 }, { status: 0 }]
    : await Promise.all([mlGet(loja, `/post-purchase/v1/claims/${id}`), mlGet(loja, `/post-purchase/v1/claims/${id}/messages`), mlGet(loja, `/post-purchase/v1/claims/${id}/expected-resolutions`)]);
  if (c.status === 200 && !SIMULADO) saveRaw(loja, 'claim', id, `/post-purchase/v1/claims/${id}`, 200, c.body);
  const cl = c.status === 200 ? c.body : getRaw(loja, 'claim', id)?.body;
  // mensagens e resoluções: sem leitura ao vivo, a última cópia coletada
  const m = m0.status === 200 ? m0 : guardado('claim_messages'), e = e0.status === 200 ? e0 : guardado('claim_expected-resolutions');
  if (!cl) throw erro('Não consegui ler esta reclamação no Mercado Livre agora.', 502);
  // devolução do produto: envio de volta, dinheiro, revisão (GET v2/claims/{id}/returns)
  let dev = null;
  if (cl.type === 'returns' || (cl.related_entities || []).includes('return')) {
    const rr = SIMULADO ? guardado('claim_returns') : await mlGet(loja, `/post-purchase/v2/claims/${id}/returns`);
    if (rr.status === 200 && rr.body?.id && !SIMULADO) saveRaw(loja, 'claim_returns', id, `/post-purchase/v2/claims/${id}/returns`, 200, rr.body);
    dev = rr.status === 200 && rr.body?.id ? rr.body : getRaw(loja, 'claim_returns', id)?.body?.id ? getRaw(loja, 'claim_returns', id).body : null;
  }
  // motivos para reportar problema no produto devolvido (os do ML; sem leitura, a lista conhecida)
  let motivosRevisao = null;
  if (acoesDe(cl).some(a => a.action === 'return_review_fail')) {
    const mr = SIMULADO ? { status: 0 } : await mlGet(loja, `/post-purchase/v1/returns/reasons?flow=seller_return_failed&claim_id=${id}`);
    const L = mr.status === 200 && Array.isArray(mr.body) && mr.body.length ? mr.body.filter(x => (x.apply || ['order']).includes('order') || x.id === 'SRF7').sort((a, b) => (a.position || 0) - (b.position || 0)).map(x => ({ id: x.id, txt: MOTIVOS_REV[x.id] || x.detail || x.id }))
      : Object.entries(MOTIVOS_REV).map(([k, t]) => ({ id: k, txt: t }));
    motivosRevisao = L.map(x => ({ ...x, foto: FOTO_OBRIGATORIA.has(x.id) }));
  }
  const QUEM = { complainant: 'Comprador', respondent: 'Você', mediator: 'Mercado Livre' };
  return { loja, nomeLoja: LOJAS[loja].nome, id: String(id), aoVivo: c.status === 200, tipo: TIPO[cl.type] || cl.type, etapa: ETAPA[cl.stage] || cl.stage, aberta: cl.status === 'opened', pedido: String(cl.resource_id),
    motivo: getRaw(loja, 'claim_reason', cl.reason_id)?.body?.detail || cl.reason_id, data: iso(cl.date_created),
    acoes: acoesDe(cl).map(a => ({ acao: a.action, txt: ACOES_REC[a.action]?.txt || a.action, conhecida: !!ACOES_REC[a.action], perigo: ACOES_REC[a.action]?.perigo || null, mensagem: !!ACOES_REC[a.action]?.msg,
      percentual: !!ACOES_REC[a.action]?.percentual, revisao: ACOES_REC[a.action]?.revisao || null, obrigatoria: !!a.mandatory, prazo: iso(a.due_date) })),
    perda: contaPerda(loja, String(cl.resource_id), id), motivosRevisao,
    devolucao: dev ? { id: String(dev.id), status: DEV_ST[dev.status] || dev.status, dinheiro: DINHEIRO[dev.status_money] || dev.status_money || null, reembolso: REEMB[dev.refund_at] || dev.refund_at || null,
      envios: (dev.shipments || []).map(s => ({ status: ENV_ST[s.status] || s.status, rastreio: s.tracking_number || null, para: s.destination?.name === 'warehouse' ? 'depósito do Mercado Livre (revisão)' : s.destination?.name === 'seller_address' ? 'seu endereço' : s.destination?.name || '',
        de: s.type === 'return_from_triage' ? 'depósito do Mercado Livre' : 'comprador' })), revisada: (dev.related_entities || []).includes('reviews'), fechada: iso(dev.date_closed) } : null,
    mensagens: (m.status === 200 && Array.isArray(m.body) ? m.body : []).map(x => ({ de: QUEM[x.sender_role] || x.sender_role, para: QUEM[x.receiver_role] || x.receiver_role, texto: x.message, data: iso(x.message_date || x.date_created),
      anexos: (x.attachments || []).map(a => a.original_filename || a.filename), moderada: x.message_moderation?.status === 'rejected' })).sort((a, b) => String(a.data).localeCompare(String(b.data))),
    resolucoesEsperadas: e.status === 200 ? e.body : null, resolucao: cl.resolution || null, link: `https://www.mercadolivre.com.br/vendas/${cl.resource_id}/detalhe` };
}
async function acaoReclamacao(b) {
  const loja = lojaOk(b.loja), id = String(b.id || ''); if (!/^\d+$/.test(id)) throw erro('Reclamação inválida.');
  const A = ACOES_REC[b.acao]; if (!A) throw erro('Ação desconhecida: faça pelo Mercado Livre.');
  // confere na hora se o ML ainda libera essa ação (simulado: a versão do banco)
  const atual = SIMULADO ? { status: 200, body: getRaw(loja, 'claim', id)?.body } : await mlGet(loja, `/post-purchase/v1/claims/${id}`);
  if (atual.status !== 200) throw erro('Não consegui conferir a reclamação no Mercado Livre agora. Tente de novo.', 502);
  if (!acoesDe(atual.body).some(a => a.action === b.acao)) throw erro('O Mercado Livre não libera mais essa ação nesta reclamação. Atualize a tela.');
  if (A.revisao) {
    // a revisão é feita na devolução (return_id), não na reclamação
    const rr = SIMULADO ? { status: 200, body: getRaw(loja, 'claim_returns', id)?.body || { id: 'simulado' } } : await mlGet(loja, `/post-purchase/v2/claims/${id}/returns`);
    const rid = rr.status === 200 && rr.body?.id; if (!rid) throw erro('Não achei a devolução desta reclamação no Mercado Livre. Tente de novo.', 502);
    if (A.revisao === 'ok') await acaoML(loja, `reclamacao.${b.acao}`, id, 'POST', `/post-purchase/v1/returns/${rid}/return-review`, {});
    else {
      const motivo = String(b.motivo || ''), texto = sp(b.mensagem).trim();
      if (!MOTIVOS_REV[motivo] && !/^SRF\d+$/.test(motivo)) throw erro('Escolha qual é o problema.');
      if (!texto) throw erro('Descreva o problema para o Mercado Livre.');
      if (FOTO_OBRIGATORIA.has(motivo) && !b.anexos?.length) throw erro('Para esse problema o Mercado Livre pede pelo menos uma foto.');
      const anexos = [];
      for (const a of (b.anexos || []).slice(0, 5)) { const r = await enviaArquivo(loja, 'reclamacao.anexo', id, `/post-purchase/v1/claims/${id}/returns/attachments`, a); anexos.push(r.file_name || r.filename); }
      await acaoML(loja, `reclamacao.${b.acao}`, id, 'POST', `/post-purchase/v1/returns/${rid}/return-review`, [{ reason: motivo, message: texto, ...(anexos.length ? { attachments: anexos } : {}) }]);
    }
  } else if (A.msg) {
    const texto = sp(b.mensagem).trim(); if (!texto) throw erro('Escreva a mensagem.');
    const anexos = [];
    for (const a of (b.anexos || []).slice(0, 5)) anexos.push((await enviaArquivo(loja, 'reclamacao.anexo', id, `/post-purchase/v1/claims/${id}/attachments`, a)).filename);
    await acaoML(loja, `reclamacao.${b.acao}`, id, 'POST', `/post-purchase/v1/claims/${id}/actions/send-message`, { receiver_role: A.msg, message: texto, attachments: anexos });
  } else if (A.percentual) {
    const p = Number(b.percentual); if (!(p > 0 && p < 100)) throw erro('Informe a porcentagem do reembolso (entre 1 e 99).');
    await acaoML(loja, `reclamacao.${b.acao}`, id, 'POST', `/post-purchase/v1/claims/${id}/${A.caminho}`, { percentage: Math.round(p) });
  } else await acaoML(loja, `reclamacao.${b.acao}`, id, 'POST', `/post-purchase/v1/claims/${id}/${A.caminho}`);
  return reclamacao(loja, id);
}

// ───────── Respostas prontas (guardadas na config: entram no backup) ─────────
const lerRespostas = () => { try { const v = JSON.parse(db.prepare(`SELECT valor FROM config WHERE chave='respostas_prontas'`).get()?.valor || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

export function registrarAtendimento(app) {
  app.get('/api/at/perguntas', HA(q => perguntas(q)));
  app.post('/api/at/perguntas/responder', HA(async (_, req) => {
    const { loja, id } = req.body || {}, texto = sp(req.body?.texto).trim(); lojaOk(loja);
    if (!/^\d+$/.test(String(id))) throw erro('Pergunta inválida.'); if (!texto) throw erro('Escreva a resposta.'); if (texto.length > 2000) throw erro('A resposta passa de 2.000 caracteres.');
    await acaoML(loja, 'pergunta.responder', id, 'POST', '/answers', { question_id: Number(id), text: texto });
    await atualizaPergunta(loja, id, { status: 'ANSWERED', answer: { text: texto, status: 'ACTIVE', date_created: new Date().toISOString() } });
    return { ok: true };
  }));
  app.post('/api/at/perguntas/apagar', HA(async (_, req) => {
    const { loja, id } = req.body || {}; lojaOk(loja); if (!/^\d+$/.test(String(id))) throw erro('Pergunta inválida.');
    await acaoML(loja, 'pergunta.apagar', id, 'DELETE', `/questions/${id}`);
    await atualizaPergunta(loja, id, { status: 'DELETED' });
    return { ok: true };
  }));
  app.post('/api/at/perguntas/bloquear', HA(async (_, req) => {
    const { loja, comprador, desbloquear } = req.body || {}; lojaOk(loja); if (!/^\d+$/.test(String(comprador))) throw erro('Comprador inválido.');
    const vend = idVendedor(loja);
    if (desbloquear) await acaoML(loja, 'pergunta.desbloquear', comprador, 'DELETE', `/users/${vend}/questions_blacklist/${comprador}`);
    else await acaoML(loja, 'pergunta.bloquear', comprador, 'POST', `/users/${vend}/questions_blacklist`, { user_id: Number(comprador) });
    return { ok: true };
  }));
  app.get('/api/at/mensagens', HA(() => conversas()));
  app.get('/api/at/conversa', HA(q => conversa(String(q.loja || ''), String(q.pack || ''))));
  app.post('/api/at/mensagens/enviar', HA((_, req) => enviaMensagem(req.body || {})));
  app.get('/api/at/reclamacoes', HA(q => reclamacoes(q)));
  app.get('/api/at/reclamacoes/ranking', HA(q => rankingReclamacoes(q)));
  app.get('/api/at/reclamacao', HA(q => reclamacao(String(q.loja || ''), String(q.id || ''))));
  app.post('/api/at/reclamacoes/acao', HA((_, req) => acaoReclamacao(req.body || {})));
  app.get('/api/at/respostas', HA(() => lerRespostas()));
  app.post('/api/at/respostas', HA((_, req) => {
    const L = (Array.isArray(req.body) ? req.body : []).slice(0, 200).map((r, i) => ({ id: String(r.id || Date.now() + '_' + i).slice(0, 40), titulo: String(r.titulo || '').trim().slice(0, 60), texto: sp(r.texto).trim().slice(0, 2000), uso: ['pergunta', 'mensagem', 'ambos'].includes(r.uso) ? r.uso : 'ambos' })).filter(r => r.titulo && r.texto);
    setConfig('respostas_prontas', JSON.stringify(L)); return L;
  }));
}
