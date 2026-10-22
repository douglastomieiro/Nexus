// Publicidade (Fase 4): Product Ads gerenciado pelo sistema. Resumo de 30 dias contra os 30 anteriores, campanhas com as ações
// (pausar, ativar, orçamento, ROAS alvo, estratégia) e anúncios patrocinados com o lucro depois do Ads (incluir, pausar, mover, tirar da campanha).
// Os dados vêm da coleta de Ads (de 3 em 3 horas); as ações vão pela API nova de Product Ads (api-version 2) via acoes.js.
import { db, getRaw, saveRaw } from './db.js';
import { LOJAS } from './ml.js';
import { calcular } from './margem.js';
import { LOG, hoje, addDias, r2 } from './painel.js';
import { acaoMLCom, HA } from './acoes.js';

const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const lojaOk = l => { if (!LOJAS[l]) throw erro('Conta desconhecida.'); return l; };
const V2 = { 'api-version': '2' };
const BASE = '/marketplace/advertising/MLB/product_ads';
const ESTRATEGIA = { PROFITABILITY: 'Rentabilidade', INCREASE: 'Crescimento', VISIBILITY: 'Visibilidade' };
const ST_AD = { active: 'Ativo', paused: 'Pausado', idle: 'Fora de campanha', hold: 'Retido', deleted: 'Apagado' };
const soma = (L, k) => L.reduce((t, x) => t + (x[k] || 0), 0);

let cache = { k: '', t: 0, v: null };
function painel(lojas) {
  const k = lojas.join(','); if (cache.k === k && Date.now() - cache.t < 60e3) return cache.v;
  const hj = hoje(), d30 = addDias(hj, -29), d60 = addDias(hj, -59), d7 = addDias(hj, -6);
  // resumo: série diária da conta (90 dias) → últimos 30 × 30 anteriores, e os 7 dias
  const dias = []; for (const l of lojas) for (const x of getRaw(l, 'ads_daily', 'conta')?.body?.results || []) dias.push(x);
  const per = (a, b) => { const L = dias.filter(x => x.date >= a && x.date <= b); return { custo: r2(soma(L, 'cost')), receita: r2(soma(L, 'total_amount')), vendas: soma(L, 'units_quantity'), impressoes: soma(L, 'prints'), cliques: soma(L, 'clicks') }; };
  const atual = per(d30, hj), anterior = per(d60, addDias(d30, -1)), semana = per(d7, hj);
  // conta de cada anúncio nos últimos 30 dias (lucro já com o Ads rateado) → margem antes e depois do Ads
  const pi = {}; try { for (const p of calcular({ lojas, desde: d30 }).porItem) { const x = pi[p.loja + ':' + p.item] ||= { receita: 0, lucro: 0, ads: 0, unidades: 0, semCusto: false }; x.receita += p.receita; x.lucro += p.lucro; x.ads += p.ads; x.unidades += p.unidades; if (p.semCusto) x.semCusto = true; } } catch (e) { console.error('[publicidade] conta:', e.message); }
  const campanhas = [], anuncios = [];
  for (const r of db.prepare(`SELECT loja, chave, body FROM raw WHERE recurso='ads_campaign' AND status=200`).all()) {
    if (!lojas.includes(r.loja)) continue; const c = parse(r.body); if (!c?.id) continue;
    const m30 = getRaw(r.loja, 'ads_campaign_30d', r.chave)?.body?.metrics || {};
    campanhas.push({ loja: r.loja, nomeLoja: LOJAS[r.loja].nome, id: String(c.id), nome: c.name, status: c.status, orcamento: c.budget ?? null, roas: c.roas_target ?? null, acosAlvo: c.acos_target ?? null,
      estrategia: ESTRATEGIA[c.strategy] || c.strategy || null, estrategiaId: String(c.strategy || '').toLowerCase(), custo: r2(m30.cost), receita: r2(m30.total_amount), vendas: m30.units_quantity || 0, acos: m30.total_amount ? m30.cost / m30.total_amount : null,
      parcela: m30.impression_share ?? null, perdidoOrcamento: m30.lost_impression_share_by_budget ?? null, perdidoRank: m30.lost_impression_share_by_ad_rank ?? null, acosReferencia: m30.acos_benchmark ?? null, anuncios: 0 });
  }
  const nomeCamp = Object.fromEntries(campanhas.map(c => [c.loja + ':' + c.id, c.nome]));
  for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='ads_ad' AND status=200`).all()) {
    if (!lojas.includes(r.loja)) continue; const a = parse(r.body); if (!a?.item_id || a.status === 'deleted') continue;
    const m = a.metrics || {}, p = pi[r.loja + ':' + a.item_id], cmp = campanhas.find(c => c.loja === r.loja && c.id === String(a.campaign_id));
    if (cmp && a.status === 'active') cmp.anuncios++;
    const margemPre = p && !p.semCusto && p.receita ? (p.lucro + p.ads) / p.receita : null, acos = m.total_amount ? m.cost / m.total_amount : null;
    anuncios.push({ loja: r.loja, nomeLoja: LOJAS[r.loja].nome, item: a.item_id, grupo: a.ad_group_id ? String(a.ad_group_id) : null, titulo: a.title, thumb: (a.thumbnail || '').replace('http://', 'https://') || null, preco: a.price,
      status: a.status, statusTxt: ST_AD[a.status] || a.status, campanha: a.campaign_id ? String(a.campaign_id) : null, nomeCampanha: nomeCamp[r.loja + ':' + a.campaign_id] || null, lg: LOG[a.logistic_type] || null,
      recomendado: !!a.recommended, custo90: r2(m.cost), receita90: r2(m.total_amount), vendas90: m.units_quantity || 0, cliques90: m.clicks || 0, acos,
      receita30: p ? r2(p.receita) : 0, ads30: p ? r2(p.ads) : 0, lucro30: p && !p.semCusto ? r2(p.lucro) : null, lucroAntes30: p && !p.semCusto ? r2(p.lucro + p.ads) : null, margemPre, margemPos: p && !p.semCusto && p.receita ? p.lucro / p.receita : null,
      prejuizo: margemPre != null && acos != null && acos > margemPre });
  }
  const v = { resumo: { atual, anterior, semana }, campanhas: campanhas.sort((a, b) => (b.status === 'active') - (a.status === 'active') || b.custo - a.custo),
    anuncios: anuncios.sort((a, b) => b.custo90 - a.custo90 || b.receita30 - a.receita30), lojas: lojas.map(l => ({ loja: l, nome: LOJAS[l].nome })),
    cartoes: { prejuizo: anuncios.filter(a => a.status === 'active' && a.prejuizo).length, sugeridos: anuncios.filter(a => a.status === 'idle' && a.recomendado).length,
      retidos: anuncios.filter(a => a.status === 'hold').length, semVenda: anuncios.filter(a => a.status === 'active' && a.custo90 > 0 && !a.receita90).length } };
  cache = { k, t: Date.now(), v }; return v;
}

// a mudança vale na hora na tela (a próxima coleta de Ads traz o estado do ML)
const patch = (loja, recurso, chave, mud) => { const b = getRaw(loja, recurso, chave)?.body; if (b) saveRaw(loja, recurso, chave, 'acao', 200, { ...b, ...mud }); cache.t = 0; };

async function acaoCampanha(b) {
  const loja = lojaOk(b.loja), id = String(b.id || ''), c = getRaw(loja, 'ads_campaign', id)?.body; if (!c?.id) throw erro('Campanha não encontrada.');
  const corpo = {};
  if (b.status != null) { if (!['active', 'paused'].includes(b.status)) throw erro('Situação inválida.'); corpo.status = b.status; }
  if (b.orcamento != null) { const v = Math.round(Number(b.orcamento) * 100) / 100; if (!(v > 0)) throw erro('Orçamento inválido.'); corpo.budget = v; }
  if (b.roas != null) { const v = Number(b.roas); if (!(v >= 1 && v <= 35)) throw erro('O ROAS alvo vai de 1 a 35.'); corpo.roas_target = v; }
  if (b.estrategia != null) { if (!['profitability', 'increase', 'visibility'].includes(b.estrategia)) throw erro('Estratégia inválida.'); corpo.strategy = b.estrategia; }
  if (!Object.keys(corpo).length) throw erro('Nada para mudar.');
  await acaoMLCom(loja, 'ads.campanha', id, 'PUT', `${BASE}/campaigns/${id}`, corpo, V2);
  patch(loja, 'ads_campaign', id, { ...corpo, ...(corpo.strategy ? { strategy: corpo.strategy.toUpperCase() } : {}), ...(corpo.roas_target ? { acos_target: r2(100 / corpo.roas_target) } : {}) });
  return { ok: true };
}
async function acaoAnuncio(b) {
  const loja = lojaOk(b.loja), item = String(b.item || ''), a = getRaw(loja, 'ads_ad', item)?.body; if (!a?.item_id) throw erro('Anúncio de Ads não encontrado.');
  if (!a.ad_group_id) throw erro('O Mercado Livre ainda não informou o grupo deste anúncio: espere a próxima coleta de Ads.');
  const ag = String(a.ad_group_id), acao = String(b.acao || '');
  if (acao === 'tirar') {
    if (!a.campaign_id) throw erro('O anúncio não está em campanha.');
    await acaoMLCom(loja, 'ads.tirar', item, 'DELETE', `${BASE}/campaigns/${a.campaign_id}/ad_groups/${ag}`, undefined, V2);
    patch(loja, 'ads_ad', item, { status: 'idle', campaign_id: null });
  } else if (['ativar', 'pausar', 'mover', 'incluir'].includes(acao)) {
    const camp = String(b.campanha || a.campaign_id || ''); if (!camp) throw erro('Escolha a campanha.');
    if (!getRaw(loja, 'ads_campaign', camp)?.body?.id) throw erro('Campanha não encontrada nesta conta.');
    const status = acao === 'pausar' ? 'paused' : 'active';
    await acaoMLCom(loja, `ads.${acao}`, item, 'PUT', `${BASE}/ad_groups/${ag}`, { status, campaign_id: Number(camp) }, V2);
    patch(loja, 'ads_ad', item, { status, campaign_id: Number(camp) });
  } else throw erro('Ação desconhecida.');
  return { ok: true };
}

export function registrarPublicidade(app, { H, lojasSel }) {
  app.get('/api/pub/painel', H(q => painel(lojasSel(q).filter(l => LOJAS[l]))));
  app.post('/api/pub/campanha', HA((_, req) => acaoCampanha(req.body || {})));
  app.post('/api/pub/anuncio', HA((_, req) => acaoAnuncio(req.body || {})));
}
