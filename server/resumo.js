// Resumo do vendedor (Fase 5): a tela inicial da central. Junta o que está pendente em cada parte (atendimento, envios, anúncios, Ads),
// a reputação de cada conta com o que pesou nela, vendas e lucro da semana, visitas e conversão, desempenho de envios e a fatura do ML.
import { db, getRaw } from './db.js';
import { LOJAS } from './ml.js';
import { calcular } from './margem.js';
import { hoje, addDias, diaBR, r2 } from './painel.js';
import { notificacoes } from './notificacoes.js';
import { cartoesVendas } from './vendas.js';
import { cartoesAnuncios } from './anuncios.js';
import { cartoesPub } from './publicidade.js';
import { ligado, modulos, regras } from './preferencias.js';

const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const NIVEL = { '1_red': 'Vermelho', '2_orange': 'Laranja', '3_yellow': 'Amarelo', '4_light_green': 'Verde-claro', '5_green': 'Verde' };
const LIDER = { platinum: 'MercadoLíder Platinum', gold: 'MercadoLíder Gold', silver: 'MercadoLíder', null: null };
// o ML responde "affected" / "not_affected" (texto), não true/false
const afeta = v => v === true || /^affect/i.test(String(v ?? ''));
const seguro = (f, padrao) => { try { return f(); } catch (e) { console.error('[resumo]', e.message); return padrao; } };

let cache = { k: '', t: 0, v: null };
function resumo(lojas) {
  const k = lojas.join(',') + JSON.stringify(modulos()) + JSON.stringify(regras().reputacao); if (cache.k === k && Date.now() - cache.t < 60e3) return cache.v;
  const hj = hoje(), ini7 = addDias(hj, -6), ini14 = addDias(hj, -13), lim60 = Date.now() - 60 * 864e5;

  // pendências: o mesmo que o sino mostra, contado por tipo
  const N = seguro(() => notificacoes(), { itens: [] }), conta = t => N.itens.filter(x => x.tipo === t && (x.canal !== 'ml' || lojas.includes(x.loja))).length;
  // módulo desligado em Personalizar: nem calcula
  const V = ligado('vendas') ? seguro(() => cartoesVendas(lojas), null) : null, A = ligado('anuncios') ? seguro(() => cartoesAnuncios(lojas), null) : null, P = ligado('ads') ? seguro(() => cartoesPub(lojas), null) : null;
  const prazoRec = db.prepare(`SELECT loja, body FROM raw WHERE recurso='claim' AND status=200 AND json_extract(body,'$.status')='opened'`).all().filter(r => lojas.includes(r.loja))
    .map(r => parse(r.body)).filter(c => (c?.players || []).some(p => p.role === 'respondent' && (p.available_actions || []).some(a => a.due_date && Date.parse(a.due_date) - Date.now() < 864e5))).length;
  const pendencias = { perguntas: conta('pergunta'), mensagens: conta('mensagem'), reclamacoes: conta('reclamacao'), reclamacoesPrazo: prazoRec, devolucoesShopee: conta('devolucao'),
    paraImprimir: V?.cards.paraImprimir ?? null, atrasadas: V?.cards.atrasadas ?? null, nfPendente: V?.cards.nfPendente ?? null, limite: V?.cards.limite ?? null, enviosHoje: V?.contagem.hoje ?? null,
    semEstoque: A?.semEstoque ?? null, qualidade: A?.qualidade ?? null, catalogo: A?.catalogo ?? null, semCusto: A?.semCusto ?? null, reporFull: A?.repor ?? null,
    adsPrejuizo: P?.cartoes.prejuizo ?? null, adsSugeridos: P?.cartoes.sugeridos ?? null };

  // semana: faturamento, pedidos e lucro dos últimos 7 dias contra os 7 anteriores, dia a dia
  // período de 30 dias: o mesmo cálculo de vendas, anúncios e Ads (já em cache)
  const sem = seguro(() => { const c = calcular({ lojas, desde: addDias(hj, -29) }), dias = {};
    for (const p of c.pedidosTodos) { const d = diaBR(p.data), x = dias[d] ||= { dia: d, receita: 0, lucro: 0, pedidos: 0 }; x.receita += p.receita; x.lucro += p.lucro; x.pedidos++; }
    const per = (a, b) => Object.values(dias).filter(x => x.dia >= a && x.dia <= b).reduce((t, x) => ({ receita: t.receita + x.receita, lucro: t.lucro + x.lucro, pedidos: t.pedidos + x.pedidos }), { receita: 0, lucro: 0, pedidos: 0 });
    return { atual: per(ini7, hj), anterior: per(ini14, addDias(ini7, -1)), dias: [...Array(7)].map((_, i) => { const d = addDias(ini7, i), x = dias[d]; return { dia: d, receita: r2(x?.receita), lucro: r2(x?.lucro), pedidos: x?.pedidos || 0 }; }) }; }, null);
  if (sem) for (const p of ['atual', 'anterior']) { sem[p].receita = r2(sem[p].receita); sem[p].lucro = r2(sem[p].lucro); }

  // visitas da conta (série diária do ML) e conversão em pedidos
  const visU = (a, b) => lojas.reduce((t, l) => { const r = db.prepare(`SELECT body FROM raw WHERE loja=? AND recurso='visitas_conta_dia' AND status=200`).get(l); return t + (parse(r?.body || 'null')?.results || []).reduce((s, x) => { const d = String(x.date).slice(0, 10); return s + (d >= a && d <= b ? x.total || 0 : 0); }, 0); }, 0);
  const visitas = { atual: visU(ini7, hj), anterior: visU(ini14, addDias(ini7, -1)) };

  // reputação de cada conta, com o que pesou nos últimos 60 dias
  const reputacao = lojas.map(l => {
    const u = parse(db.prepare(`SELECT body FROM raw WHERE loja=? AND recurso='user' AND status=200`).get(l)?.body || 'null'), R = u?.seller_reputation || {}, m = R.metrics || {};
    const afetam = db.prepare(`SELECT chave, body FROM raw WHERE loja=? AND recurso='claim_affects-reputation' AND status=200`).all(l).filter(r => { const b = parse(r.body); return b && afeta(b.affects_reputation ?? b.affectsReputation); }).map(r => r.chave);
    const recl = afetam.map(id => getRaw(l, 'claim', id)?.body).filter(c => c && Date.parse(c.date_created) >= lim60)
      .map(c => ({ id: String(c.id), pedido: String(c.resource_id), data: c.date_created, motivo: getRaw(l, 'claim_reason', c.reason_id)?.body?.detail || c.reason_id }));
    const atrasos = db.prepare(`SELECT s.chave, json_extract(s.body,'$.expected_date') d, json_extract(e.body,'$.order_id') pedido FROM raw s LEFT JOIN raw e ON e.loja=s.loja AND e.recurso='shipment' AND e.chave=s.chave
      WHERE s.loja=? AND s.recurso='shipment_sla' AND json_extract(s.body,'$.status')='delayed'`).all(l).filter(x => Date.parse(x.d) >= lim60).map(x => ({ envio: x.chave, pedido: x.pedido ? String(x.pedido) : null, data: x.d }));
    return { loja: l, nome: LOJAS[l].nome, apelido: u?.nickname || null, nivel: R.level_id || null, nivelTxt: NIVEL[R.level_id] || R.level_id || 'sem cor', lider: LIDER[R.power_seller_status] || null,
      vendas60: m.sales?.completed ?? null, reclamacoes: m.claims || null, atrasos: m.delayed_handling_time || null, cancelamentos: m.cancellations || null,
      positivas: R.transactions?.ratings?.positive ?? null, historico: R.transactions?.completed ?? null, reclamacoesQueAfetam: recl.slice(0, 20), enviosAtrasados: atrasos.slice(0, 20), totalAtrasos60: atrasos.length };
  });

  // desempenho de envios (logística própria): no prazo × com atraso, pela data limite de despacho
  const env = (a, b) => { let ok = 0, atr = 0; for (const r of db.prepare(`SELECT loja, json_extract(body,'$.status') s, json_extract(body,'$.expected_date') d FROM raw WHERE recurso='shipment_sla' AND status=200`).iterate()) {
    if (!lojas.includes(r.loja) || !r.d) continue; const d = diaBR(r.d); if (d < a || d > b) continue; if (r.s === 'delayed') atr++; else if (r.s) ok++; } return { noPrazo: ok, atrasados: atr }; };
  const envios = { semana: env(ini7, hj), quatroSemanas: env(addDias(hj, -27), hj) };

  // fatura do Mercado Livre: o período mais recente de cada conta
  const fatura = lojas.map(l => { const p = parse(db.prepare(`SELECT body FROM raw WHERE loja=? AND recurso='billing_periods' AND status=200`).get(l)?.body || 'null')?.results?.[0];
    return p ? { loja: l, nome: LOJAS[l].nome, valor: p.amount, emAberto: p.unpaid_amount, vence: p.expiration_date, de: p.period?.date_from, ate: p.period?.date_to, situacao: p.period_status === 'CLOSED' ? 'fechada' : 'em aberto' } : null; }).filter(Boolean);

  const v = { hoje: hj, pendencias, semana: sem, visitas, reputacao, envios, fatura, ads: P?.resumo?.atual || null, modulos: modulos(), limites: regras().reputacao };
  cache = { k, t: Date.now(), v }; return v;
}

export function registrarResumo(app, { H, lojasSel }) {
  app.get('/api/central', H(q => resumo(lojasSel(q).filter(l => LOJAS[l]))));
  // deixa as contas prontas pouco depois de o servidor subir: a primeira abertura do Resumo não espera o cálculo
  setTimeout(() => seguro(() => resumo(lojasSel({}).filter(l => LOJAS[l])), null), 20e3);
}
