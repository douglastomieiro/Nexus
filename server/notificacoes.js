// Notificações de atendimento: o que está esperando resposta agora, item a item, para o sino da tela.
// Mercado Livre: perguntas sem resposta, mensagens pós-venda não lidas e reclamações abertas.
// Shopee: devoluções esperando ação e conversas não lidas do chat (quando o app tem permissão de chat).
// Cada item tem um id estável: a tela guarda os já vistos e avisa só dos novos.
import { db, getRaw } from './db.js';
import { LOJAS } from './ml.js';
import { SHOPEE } from './shopee.js';

const all = (sql, ...p) => db.prepare(sql).all(...p);
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const TIPO_REC = { returns: 'Devolução', mediations: 'Mediação', cancel_purchase: 'Cancelamento', fulfillment: 'Reclamação (Full)' };
const SP_ABERTA = new Set(['REQUESTED', 'PROCESSING', 'JUDGING', 'SELLER_DISPUTE']);
const iso = d => { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toISOString() : null; }; // datas do ML vêm com fuso -04:00; a lista ordena em UTC
const ML_VENDA = id => `https://www.mercadolivre.com.br/vendas/${id}/detalhe`;

function mercadoLivre(loja, itens) {
  const nome = LOJAS[loja]?.nome || loja;
  const titulo = id => parse(all(`SELECT body FROM raw WHERE loja=? AND recurso='item' AND chave=? AND status=200`, loja, id)[0]?.body || 'null')?.title || id;

  // perguntas: a lista de sem resposta guardada pelos avisos (até 15 min); sem ela, o status de cada pergunta no banco
  const snap = all(`SELECT body, coletado_em FROM raw WHERE loja=? AND recurso='avisos_perguntas' AND status=200`, loja)[0];
  const ids = snap && Date.now() - snap.coletado_em < 15 * 60e3 ? new Set((parse(snap.body)?.ids || []).map(String)) : null;
  for (const r of all(`SELECT chave, body FROM raw WHERE loja=? AND recurso='question' AND status=200 AND ${ids ? '1' : `json_extract(body,'$.status')='UNANSWERED'`}`, loja)) {
    if (ids && !ids.has(r.chave)) continue;
    const q = parse(r.body); if (!q) continue;
    itens.push({ id: `q:${loja}:${r.chave}`, tipo: 'pergunta', canal: 'ml', loja, nomeLoja: nome, data: iso(q.date_created), titulo: titulo(q.item_id), texto: q.text, link: 'https://www.mercadolivre.com.br/perguntas/vendedor' });
  }

  // mensagens pós-venda não lidas: a última mensagem do comprador em cada conversa
  const unread = parse(all(`SELECT body FROM raw WHERE loja=? AND recurso='messages_unread' AND status=200`, loja)[0]?.body || 'null');
  for (const x of unread?.results || []) {
    const pack = JSON.stringify(x).match(/packs\/(\d+)/)?.[1]; if (!pack) continue;
    const msgs = getRaw(loja, 'messages_pack', pack)?.body?.messages || [];
    const ult = msgs.filter(m => String(m.from?.user_id) !== String(unread.user_id)).sort((a, b) => String(b.message_date?.created).localeCompare(String(a.message_date?.created)))[0];
    itens.push({ id: `m:${loja}:${pack}:${ult?.id || x.count || 1}`, tipo: 'mensagem', canal: 'ml', loja, nomeLoja: nome, data: iso(ult?.message_date?.created),
      titulo: `Mensagem do comprador · venda ${pack}`, texto: ult?.text || `${x.count || 1} mensagem(ns) não lida(s)`, link: ML_VENDA(pack) });
  }

  // reclamações abertas
  for (const r of all(`SELECT chave, body FROM raw WHERE loja=? AND recurso='claim' AND status=200 AND json_extract(body,'$.status')='opened'`, loja)) {
    const c = parse(r.body); if (!c) continue;
    const motivo = getRaw(loja, 'claim_reason', c.reason_id)?.body?.detail;
    itens.push({ id: `c:${loja}:${r.chave}`, tipo: 'reclamacao', canal: 'ml', loja, nomeLoja: nome, data: iso(c.date_created),
      titulo: `${TIPO_REC[c.type] || 'Reclamação'} aberta · venda ${c.resource_id}`, texto: motivo || c.reason_id || '', link: ML_VENDA(c.resource_id) });
  }
}

function shopee(loja, itens, avisos) {
  const nome = SHOPEE[loja]?.nome || loja, curto = nome.replace(' (Shopee)', '');
  for (const r of all(`SELECT chave, body FROM raw WHERE loja=? AND recurso='sp_return' AND status=200 AND json_extract(body,'$.create_time') > ?`, loja, Date.now() / 1000 - 60 * 86400)) {
    const x = parse(r.body); if (!x || !SP_ABERTA.has(x.status)) continue;
    itens.push({ id: `r:${loja}:${r.chave}`, tipo: 'devolucao', canal: 'shopee', loja, nomeLoja: nome, data: new Date(x.create_time * 1000).toISOString(),
      titulo: `Devolução · ${x.item?.[0]?.name || r.chave}`, texto: [x.text_reason, x.refund_amount != null ? `reembolso R$ ${Number(x.refund_amount).toFixed(2).replace('.', ',')}` : ''].filter(Boolean).join(' · '),
      link: 'https://seller.shopee.com.br/portal/sale/return' });
  }
  const chat = getRaw(loja, 'sp_chat', 'nao_lidas');
  if (chat?.body?.erro) avisos.push(`Chat da Shopee (${curto}): a Shopee não liberou o chat para este app, então as conversas não aparecem aqui (${chat.body.msg || chat.body.erro}).`);
  for (const c of chat?.status === 200 ? chat.body?.conversas || [] : []) {
    if (!(c.unread_count > 0)) continue;
    const ts = Number(c.last_message_timestamp) || 0;
    itens.push({ id: `ch:${loja}:${c.conversation_id}:${c.latest_message_id || ts}`, tipo: 'chat', canal: 'shopee', loja, nomeLoja: nome,
      data: ts ? new Date(ts > 1e15 ? ts / 1e6 : ts > 1e12 ? ts : ts * 1000).toISOString() : null,
      titulo: `Chat · ${c.to_name || 'comprador'}`, texto: c.latest_message_content?.text || `${c.unread_count} mensagem(ns) não lida(s)`, link: 'https://seller.shopee.com.br/webchat/conversations' });
  }
}

export function notificacoes() {
  const itens = [], avisos = [];
  for (const l of Object.keys(LOJAS)) mercadoLivre(l, itens);
  for (const l of Object.keys(SHOPEE)) shopee(l, itens, avisos);
  itens.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  return { itens, avisos, agora: Date.now() };
}

export function registrarNotificacoes(app, { H }) {
  app.get('/api/notificacoes', H(() => notificacoes()));
}
