// Gestão de anúncios (Fase 3): a tela de anúncios do Mercado Livre dentro do sistema, com o que só o sistema calcula
// (custo, margem e lucro, quanto sobra em cada preço, preço mínimo pela margem, cobertura de estoque) e as ações:
// pausar, reativar, finalizar, preço, estoque (por variação ou por depósito), título, descrição, fotos, ficha técnica e tipo de anúncio.
// Toda ação passa por acoes.js (token de escrita + registro); a confirmação é na tela.
import { db, getRaw, saveRaw } from './db.js';
import { LOJAS, mlGet } from './ml.js';
import { calcular, getCustos, skuDe, aliquotaPctFn } from './margem.js';
import { LOG, hoje, addDias, r2 } from './painel.js';
import { acaoML, acaoMLCom, leML, enviaArquivos, HA, SIMULADO } from './acoes.js';
import { regras } from './preferencias.js';

const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const lojaOk = l => { if (!LOJAS[l]) throw erro('Conta desconhecida.'); return l; };
const ph = a => a.map(() => '?').join(',') || "''";
const TIPO = { gold_special: 'Clássico', gold_pro: 'Premium', gold_premium: 'Diamante', free: 'Grátis' };
const STATUS = { active: 'Ativo', paused: 'Pausado', closed: 'Finalizado', under_review: 'Em revisão', inactive: 'Inativo', payment_required: 'Aguardando pagamento' };
const SUBST = { out_of_stock: 'sem estoque', waiting_for_patch: 'aguardando correção', held: 'retido', warning: 'com aviso', forbidden: 'proibido', deleted: 'apagado', freezed: 'congelado', suspended: 'suspenso' };
const CATALOGO = { winning: 'Ganhando', competing: 'Competindo', sharing_first_place: 'Dividindo o 1º lugar', listed: 'Listado', penalized: 'Penalizado' };
const comissaoPadrao = t => (t === 'gold_pro' ? 0.17 : 0.12); // sem venda nem tarifa coletada: média do tipo

const itemDe = (loja, id) => { const b = getRaw(lojaOk(loja), 'item', String(id))?.body; if (!b?.id) throw erro('Anúncio não encontrado no banco.', 404); return b; };
const somaVisitas = (loja, id, dias) => { const lim = Date.now() - dias * 864e5; return (getRaw(loja, 'item_visits', id)?.body?.results || []).reduce((t, r) => t + (Date.parse(r.date) >= lim ? r.total || 0 : 0), 0); };
// tarifa de venda do anúncio (a última cotada para ele): porcentagem e valor fixo
const tarifas = () => { const m = {}; for (const r of db.prepare(`SELECT loja, chave, body, coletado_em FROM raw WHERE recurso='listing_fee' AND status=200`).all()) {
  const id = r.chave.split(':')[0], b = parse(r.body), k = r.loja + ':' + id; if (!b?.sale_fee_details || (m[k] && m[k].t > r.coletado_em)) continue;
  m[k] = { t: r.coletado_em, pct: (b.sale_fee_details.percentage_fee || 0) / 100, fixa: b.sale_fee_details.fixed_fee || 0 }; } return m; };

// ───────── lista ─────────
let cache = { k: '', t: 0, v: null };
function lista(lojas) {
  const R = regras(), k = lojas.join(',') + '|' + R.coberturaDias + '|' + R.qualidadeMin; if (cache.k === k && Date.now() - cache.t < 60e3) return cache.v;
  const calc = (() => { try { return calcular({ lojas, desde: addDias(hoje(), -29) }); } catch (e) { console.error('[anuncios] conta:', e.message); return null; } })();
  const pi = {}; for (const p of calc?.porItem || []) { const x = pi[p.loja + ':' + p.item] ||= { unidades: 0, pedidos: 0, receita: 0, comissao: 0, frete: 0, ads: 0, lucro: 0, custo: 0, semCusto: false }; for (const c of Object.keys(x)) if (c !== 'semCusto') x[c] += p[c] || 0; if (p.semCusto) x.semCusto = true; }
  const custos = getCustos(), tf = tarifas(), mes = hoje().slice(0, 7), aliq = Object.fromEntries(lojas.map(l => [l, (aliquotaPctFn(l)(mes) || 0) / 100]));
  const auto = new Set(); for (const r of db.prepare(`SELECT body FROM raw WHERE recurso='pricing_automation_items' AND status=200`).all()) for (const i of parse(r.body)?.items || []) auto.add(i);
  const itens = [];
  for (const r of db.prepare(`SELECT loja, body FROM raw WHERE recurso='item' AND status=200 AND loja IN (${ph(lojas)})`).iterate(...lojas)) {
    const it = parse(r.body); if (!it?.id || it.status === 'closed' && Date.parse(it.last_updated) < Date.now() - 60 * 864e5) continue;
    const kk = r.loja + ':' + it.id, v = pi[kk], sku = skuDe(r.loja, { id: it.id });
    // custo: o do SKU do anúncio; com variações (SKU por variação), a média das vendas dos últimos 30 dias
    const custo = sku && custos[sku] != null ? custos[sku] : v?.unidades && !v.semCusto && v.custo > 0 ? r2(v.custo / v.unidades) : null;
    const sp = getRaw(r.loja, 'item_sale_price', it.id)?.body, venda = sp?.amount && sp.amount < it.price ? sp.amount : it.price;
    const perf = getRaw(r.loja, 'item_performance', it.id)?.body, ptw = it.catalog_listing ? getRaw(r.loja, 'price_to_win', it.id)?.body : null;
    const ehFull = it.shipping?.logistic_type === 'fulfillment';
    // no Full o disponível do anúncio já é o estoque do centro do ML
    const full = it.inventory_id ? getRaw(r.loja, 'inventory_fulfillment', it.inventory_id)?.body?.available_quantity ?? (ehFull ? it.available_quantity || 0 : null) : ehFull ? it.available_quantity || 0 : null;
    const t = tf[kk], com = t ? t.pct : v?.receita ? v.comissao / v.receita : comissaoPadrao(it.listing_type_id);
    const freteU = v?.unidades ? v.frete / v.unidades : null, adsU = v?.unidades ? v.ads / v.unidades : 0;
    const est = it.available_quantity || 0, diario = (v?.unidades || 0) / 30;
    const v30 = somaVisitas(r.loja, it.id, 30);
    itens.push({ loja: r.loja, nomeLoja: LOJAS[r.loja].nome, id: it.id, titulo: it.title, thumb: (it.thumbnail || '').replace('http://', 'https://') || null, link: it.permalink || null, status: it.status, statusTxt: STATUS[it.status] || it.status,
      sub: (it.sub_status || []).map(s => SUBST[s] || s.replace(/_/g, ' ')), tipo: TIPO[it.listing_type_id] || it.listing_type_id, tipoId: it.listing_type_id, lg: LOG[it.shipping?.logistic_type] || 'Padrão', sku: sku !== it.id ? sku : null,
      preco: it.price, venda: r2(venda), promo: venda < it.price, estoque: est, full, variacoes: (it.variations || []).length, vendidos: it.sold_quantity || 0,
      v30: v?.unidades || 0, lucro30: v && !v.semCusto ? r2(v.lucro) : null, margem30: v?.receita && !v.semCusto ? v.lucro / v.receita : null, visitas7: somaVisitas(r.loja, it.id, 7), visitas30: v30, conversao: v30 ? (v?.pedidos || 0) / v30 : null,
      qualidade: perf?.score != null ? { score: Math.round(perf.score), nivel: perf.level } : null, saude: it.health ?? null,
      catalogo: it.catalog_listing ? { status: ptw?.status || null, txt: CATALOGO[ptw?.status] || ptw?.status || 'sem dados', ptw: ptw?.price_to_win ?? null } : null, automatico: auto.has(it.id),
      cobertura: diario ? Math.floor((ehFull ? full : est + (full || 0)) / diario) : null, sugFull: ehFull && diario ? Math.max(0, Math.ceil(diario * R.coberturaDias) - (full || 0)) : null,
      // para o preço mínimo e o "você recebe": custo, comissão (fração), tarifa fixa, frete e Ads por unidade, imposto (fração)
      conta: { custo, com: r2(com * 10000) / 10000, fixa: t?.fixa || 0, frete: freteU != null ? r2(freteU) : null, ads: r2(adsU), imp: aliq[r.loja] || 0 } });
  }
  const c = x => itens.filter(x).length;
  const v = { itens: itens.sort((a, b) => (b.status === 'active') - (a.status === 'active') || b.v30 - a.v30 || b.vendidos - a.vendidos),
    cards: { ativos: c(x => x.status === 'active'), pausados: c(x => x.status === 'paused'), semEstoque: c(x => x.status !== 'closed' && x.lg !== 'Full' && !x.estoque), qualidade: c(x => x.status === 'active' && x.qualidade && x.qualidade.score < R.qualidadeMin),
      semCusto: c(x => x.status === 'active' && x.conta.custo == null), catalogo: c(x => x.status === 'active' && x.catalogo && x.catalogo.status && x.catalogo.status !== 'winning'), repor: c(x => x.status === 'active' && x.sugFull > 0) },
    lojas: lojas.map(l => ({ loja: l, nome: LOJAS[l].nome })) };
  cache = { k, t: Date.now(), v }; return v;
}

// cartões da lista (para o Resumo)
export const cartoesAnuncios = lojas => lista(lojas).cards;

// ───────── ficha de edição ─────────
async function ficha(loja, id) {
  let it = itemDe(loja, id), aoVivo = false;
  if (!SIMULADO) { const r = await mlGet(loja, `/items/${id}`).catch(() => null); if (r?.status === 200 && r.body?.id) { it = r.body; aoVivo = true; saveRaw(loja, 'item', id, `/items/${id}`, 200, it); } }
  const cat = getRaw(loja, 'category_attributes', it.category_id)?.body, perf = getRaw(loja, 'item_performance', id)?.body;
  const up = !it.variations?.length && it.user_product_id ? getRaw(loja, 'user_product_stock', it.user_product_id)?.body : null;
  const atual = Object.fromEntries((it.attributes || []).map(a => [a.id, a.value_name]));
  const editaveis = (Array.isArray(cat) ? cat : []).filter(a => !a.tags?.read_only && !a.tags?.hidden && !a.tags?.fixed && !a.tags?.variation_attribute && !['SELLER_SKU', 'GTIN', 'ITEM_CONDITION'].includes(a.id))
    .map(a => ({ id: a.id, nome: a.name, valor: atual[a.id] ?? '', obrigatorio: !!(a.tags?.required || a.tags?.catalog_required), opcoes: (a.values || []).slice(0, 200).map(v => v.name), unidade: a.value_type === 'number_unit' ? a.default_unit || '' : '' }))
    .sort((a, b) => b.obrigatorio - a.obrigatorio || (b.valor !== '') - (a.valor !== ''));
  const pend = []; for (const b of perf?.buckets || []) for (const v of b.variables || []) if (v.status === 'PENDING') pend.push({ grupo: b.title, txt: v.title });
  const L = lista([loja]).itens.find(x => x.id === id);
  return { loja, nomeLoja: LOJAS[loja].nome, id, aoVivo, titulo: it.title, status: it.status, tipoId: it.listing_type_id, tipo: TIPO[it.listing_type_id] || it.listing_type_id, link: it.permalink, preco: it.price,
    vendidos: it.sold_quantity || 0, podeTitulo: !it.sold_quantity, estoque: it.available_quantity || 0, full: it.shipping?.logistic_type === 'fulfillment', lg: LOG[it.shipping?.logistic_type] || 'Padrão',
    variacoes: (it.variations || []).map(v => ({ id: v.id, nome: (v.attribute_combinations || []).map(a => a.value_name).join(' · '), preco: v.price, estoque: v.available_quantity, sku: (v.attributes || []).find(a => a.id === 'SELLER_SKU')?.value_name || null })),
    depositos: (up?.locations || []).filter(l => l.type === 'seller_warehouse').map(l => ({ store: String(l.store_id), node: l.network_node_id || null, qtd: l.quantity })), estoquePorEndereco: !!(up?.locations || []).some(l => l.type === 'selling_address'),
    fotos: (it.pictures || []).map(p => ({ id: p.id, url: (p.secure_url || p.url || '').replace('http://', 'https://') })),
    descricao: getRaw(loja, 'item_description', id)?.body?.plain_text || '', atributos: editaveis, pendencias: pend, qualidade: perf?.score != null ? Math.round(perf.score) : null,
    upgrades: (getRaw(loja, 'item_available_listing_types', id)?.body || []).map(t => ({ id: t.id, nome: t.name })), conta: L?.conta || null, catalogo: L?.catalogo || null, venda: L?.venda ?? it.price };
}

// ───────── ações ─────────
// depois da ação: relê o anúncio no ML (no teste, aplica a mudança na cópia local) e limpa a lista em cache
async function atualiza(loja, id, local) {
  cache.t = 0;
  if (SIMULADO) { const b = getRaw(loja, 'item', id)?.body; if (b) saveRaw(loja, 'item', id, `/items/${id}`, 200, { ...b, ...local }); return; }
  const r = await mlGet(loja, `/items/${id}`).catch(() => null); if (r?.status === 200 && r.body?.id) saveRaw(loja, 'item', id, `/items/${id}`, 200, r.body);
}
async function acao(b) {
  const loja = lojaOk(b.loja), id = String(b.id || ''), it = itemDe(loja, id), tipo = String(b.acao || '');
  const put = (t, corpo, local) => acaoML(loja, `anuncio.${t}`, id, 'PUT', `/items/${id}`, corpo).then(() => atualiza(loja, id, local ?? corpo));
  if (tipo === 'status') {
    const st = String(b.status); if (!['active', 'paused', 'closed'].includes(st)) throw erro('Situação inválida.');
    if (it.status === 'closed') throw erro('Anúncio finalizado não volta: é preciso republicar no Mercado Livre.');
    await put(st === 'active' ? 'reativar' : st === 'paused' ? 'pausar' : 'finalizar', { status: st });
  } else if (tipo === 'preco') {
    const p = Math.round(Number(b.preco) * 100) / 100; if (!(p > 0)) throw erro('Preço inválido.');
    await put('preco', it.variations?.length ? { variations: it.variations.map(v => ({ id: v.id, price: p })) } : { price: p }, { price: p });
  } else if (tipo === 'estoque') {
    if (it.shipping?.logistic_type === 'fulfillment') throw erro('Anúncio Full: o estoque é o que está no centro do Mercado Livre.');
    const n = v => { const q = Math.floor(Number(v)); if (!(q >= 0)) throw erro('Quantidade inválida.'); return q; };
    if (it.variations?.length) {
      const vs = (b.variacoes || []).filter(v => it.variations.some(x => String(x.id) === String(v.id))).map(v => ({ id: Number(v.id) || v.id, available_quantity: n(v.qtd) }));
      if (!vs.length) throw erro('Informe o estoque das variações.');
      await put('estoque', { variations: vs }, { variations: it.variations.map(x => ({ ...x, available_quantity: vs.find(v => String(v.id) === String(x.id))?.available_quantity ?? x.available_quantity })), available_quantity: vs.reduce((t, v) => t + v.available_quantity, 0) });
    } else {
      const up = it.user_product_id ? getRaw(loja, 'user_product_stock', it.user_product_id)?.body : null, dep = (up?.locations || []).filter(l => l.type === 'seller_warehouse');
      const porEndereco = (up?.locations || []).some(l => l.type === 'selling_address');
      if (dep.length || porEndereco) {
        // estoque do produto (user product): precisa da versão atual do estoque (x-version)
        const g = await leML(loja, `/user-products/${it.user_product_id}/stock`), ver = g?.headers?.get?.('x-version') || (SIMULADO ? '1' : null);
        if (!ver) throw erro('Não consegui ler a versão atual do estoque no Mercado Livre. Tente de novo.', 502);
        const corpo = dep.length ? { locations: dep.map(l => ({ store_id: String(l.store_id), network_node_id: l.network_node_id, quantity: n((b.depositos || []).find(d => String(d.store) === String(l.store_id))?.qtd ?? b.quantidade ?? l.quantity) })) } : { quantity: n(b.quantidade) };
        await acaoMLCom(loja, 'anuncio.estoque', id, 'PUT', `/user-products/${it.user_product_id}/stock/type/${dep.length ? 'seller_warehouse' : 'selling_address'}`, corpo, { 'x-version': String(ver) });
        const tot = dep.length ? corpo.locations.reduce((t, l) => t + l.quantity, 0) : corpo.quantity;
        if (SIMULADO && dep.length) saveRaw(loja, 'user_product_stock', it.user_product_id, '', 200, { ...up, locations: up.locations.map(l => l.type === 'seller_warehouse' ? { ...l, quantity: corpo.locations.find(x => x.store_id === String(l.store_id))?.quantity ?? l.quantity } : l) });
        await atualiza(loja, id, { available_quantity: tot });
      } else await put('estoque', { available_quantity: n(b.quantidade) });
    }
  } else if (tipo === 'titulo') {
    const t = String(b.titulo || '').trim(); if (t.length < 5) throw erro('Título curto demais.'); if (t.length > 60) throw erro('O Mercado Livre aceita até 60 caracteres no título.');
    if (it.sold_quantity) throw erro('O Mercado Livre não deixa mudar o título de anúncio que já vendeu.');
    await put('titulo', { title: t });
  } else if (tipo === 'descricao') {
    const t = String(b.texto || '').replace(/\r\n?/g, '\n').trim(); if (!t) throw erro('Escreva a descrição.'); if (t.length > 50000) throw erro('Descrição longa demais (limite de 50 mil caracteres).');
    await acaoML(loja, 'anuncio.descricao', id, 'PUT', `/items/${id}/description?api_version=2`, { plain_text: t });
    saveRaw(loja, 'item_description', id, `/items/${id}/description`, 200, { ...(getRaw(loja, 'item_description', id)?.body || {}), plain_text: t }); cache.t = 0;
  } else if (tipo === 'fotos') {
    const atuais = new Set((it.pictures || []).map(p => p.id)), ordem = (b.ordem || []).map(String).filter(x => atuais.has(x));
    const novas = []; for (const a of (b.novas || []).slice(0, 10)) novas.push((await enviaArquivos(loja, 'anuncio.foto', id, '/pictures/items/upload', [a])).id);
    const fotos = [...ordem, ...novas]; if (!fotos.length) throw erro('O anúncio precisa de pelo menos uma foto.'); if (fotos.length > 12) throw erro('O Mercado Livre aceita até 12 fotos por anúncio.');
    await put('fotos', { pictures: fotos.map(x => ({ id: x })) }, { pictures: fotos.map(x => (it.pictures || []).find(p => p.id === x) || { id: x, secure_url: '' }) });
  } else if (tipo === 'ficha') {
    const at = (b.atributos || []).filter(a => /^[A-Z0-9_]+$/.test(a.id || '')).map(a => ({ id: a.id, value_name: String(a.valor ?? '').trim() || null }));
    if (!at.length) throw erro('Nada mudou na ficha técnica.');
    await put('ficha', { attributes: at }, { attributes: [...(it.attributes || []).filter(x => !at.some(a => a.id === x.id)), ...at.map(a => ({ id: a.id, value_name: a.value_name }))] });
  } else if (tipo === 'tipo') {
    const t = String(b.tipo || ''); if (!(getRaw(loja, 'item_available_listing_types', id)?.body || []).some(x => x.id === t)) throw erro('Esse tipo de anúncio não está disponível para este anúncio.');
    await acaoML(loja, 'anuncio.tipo', id, 'POST', `/items/${id}/listing_type`, { id: t }); await atualiza(loja, id, { listing_type_id: t });
  } else throw erro('Ação desconhecida.');
  return { ok: true, item: lista([loja]).itens.find(x => x.id === id) || null };
}

export function registrarAnuncios(app, { H, lojasSel }) {
  app.get('/api/anuncios/lista', H(q => lista(lojasSel(q).filter(l => LOJAS[l]))));
  app.get('/api/anuncios/item', HA(q => ficha(String(q.loja || ''), String(q.id || ''))));
  app.post('/api/anuncios/acao', HA((_, req) => acao(req.body || {})));
}
