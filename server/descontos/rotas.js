// Rotas /api/descontos/*: aplicar/remover desconto (individual, lote, selecionados, falhas), categorias, campanhas do ML e margem no preço.
// Portado do sistema DESCONTOS (sem login/assinatura: o dashboard é de uso próprio). Cada conta tem seu próprio lote e sua fila.
import { contas, conta, tokenDe, temToken, req, createLogger } from './ml.js';
import { MLService, classifyError, friendlyMessage } from './mlservice.js';
import { ProcessingQueue, BatchState } from './queue.js';
import { DiscountStore, CategoriesStore, limparTravados } from './store.js';
import { listarAnuncios } from './itens.js';
import { margemNoPreco } from './margem.js';

const reply = (res, status, body) => res.status(status).json({ success: status < 400, ...body });

const mods = new Map();
function modulo(id) {
  const seller = String(id);
  if (mods.has(seller)) return mods.get(seller);
  const c = conta(seller);
  if (!c || !temToken(seller)) return null;
  const logger = createLogger(`descontos:${c.nickname || seller}`), getAccessToken = () => tokenDe(seller);
  const m = { seller, conta: c, logger, getAccessToken, store: new DiscountStore(seller, logger), mlService: new MLService({ getAccessToken, logger }),
    queue: new ProcessingQueue({ delayMs: 1500 }), batch: new BatchState() };
  mods.set(seller, m);
  return m;
}

function infoErro(err) {
  if (err.errorType) return { type: err.errorType, friendly: err.friendlyMessage || friendlyMessage(err.errorType), raw: err.message };
  const { type } = classifyError(err);
  return { type, friendly: friendlyMessage(type), raw: err.response?.data?.message || err.message };
}
const duracao = d => { const n = parseInt(d, 10); return Number.isFinite(n) ? Math.max(1, Math.min(30, n)) : 30; };

async function rodarLote(items, m, dias) {
  const { store, mlService, queue, batch, logger } = m;
  async function um(item) {
    if (!batch.isRunning) return;
    batch.setCurrent(item);
    store.updateStatus(item.mlb, { processing: true, lastAttemptAt: new Date().toISOString() });
    try {
      await queue.enqueue(item.mlb, () => mlService.applyPromotion(item.mlb, item.price, dias));
      batch.recordSuccess(item.mlb);
      store.updateStatus(item.mlb, { processing: false, lastAttemptFailed: false, lastErrorMessage: undefined, lastErrorCode: undefined, lastRawError: undefined,
        lastSuccessAt: new Date().toISOString(), promotionFinishAt: new Date(Date.now() + dias * 864e5).toISOString() });
    } catch (err) {
      const e = infoErro(err);
      batch.recordFailure(item.mlb, e.friendly, e.type, e.raw);
      store.updateStatus(item.mlb, { processing: false, lastAttemptFailed: true, lastErrorMessage: e.friendly, lastErrorCode: e.type, lastRawError: e.raw });
    }
  }
  for (const it of items) { if (!batch.isRunning) break; await um(it); }
  // fase 2: repete automaticamente as que falharam neste lote (o tempo da fase 1 já deixa o ML estabilizar)
  if (batch.isRunning) {
    const orig = new Set(items.map(i => i.mlb)), falhas = store.getFailedItems().filter(i => orig.has(i.mlb));
    if (falhas.length) {
      batch.startRetryPhase(falhas.length);
      logger.info('Lote fase 2 (repetição automática)', { jobId: batch.jobId, total: falhas.length });
      for (const it of falhas) { if (!batch.isRunning) break; await um(it); }
    }
  }
  batch.finish();
  logger.info(batch.isCancelled() ? 'Lote cancelado' : 'Lote finalizado', { jobId: batch.jobId, total: batch.total, ok: batch.successCount, falhas: batch.failureCount });
}

// campanhas em que o vendedor só ACEITA (preço definido pelo ML): não enviam deal_price
const SO_ACEITA = new Set(['MARKETPLACE_CAMPAIGN', 'VOLUME', 'PRE_NEGOTIATED', 'SMART', 'PRICE_MATCHING', 'UNHEALTHY_STOCK', 'SELLER_COUPON_CAMPAIGN']);

export function registrarDescontos(app) {
  const n = limparTravados();
  if (n) console.log(`[descontos] ${n} item(ns) travado(s) em "processando" foram liberados`);

  // resolve a conta e anexa em req.mod
  const guard = (req_, res, next) => {
    const m = modulo(req_.params.id);
    if (!m) return reply(res, 404, { message: 'Conta não encontrada ou sem token de escrita (veja a seção Descontos do LEIAME).', code: 'ACCOUNT_NOT_FOUND' });
    req_.mod = m; next();
  };
  const H = fn => async (rq, rs) => { try { await fn(rq, rs); } catch (e) { rq.mod?.logger.error('Erro na rota', { rota: rq.path, erro: e.message }); reply(rs, 500, { message: e.message }); } };
  const base = '/api/descontos/contas/:id';

  app.get('/api/descontos/contas', (_, res) => reply(res, 200, { data: contas().map(c => ({ ...c, temToken: temToken(c.id) })) }));

  // ── anúncios da conta ao vivo ──
  app.get(`${base}/items`, guard, H(async (rq, rs) => {
    const data = await listarAnuncios({ seller: rq.mod.seller, token: rq.mod.getAccessToken, status: rq.query.status || 'active', fresh: rq.query.fresh === '1' });
    reply(rs, 200, { data, total: data.length });
  }));

  // ── margem no preço do desconto (usa os dados do dashboard) ──
  app.post(`${base}/margem`, guard, H(async (rq, rs) => {
    const pares = (Array.isArray(rq.body?.pares) ? rq.body.pares : []).map(p => ({ mlb: String(p.mlb), preco: Number(p.preco), skus: Array.isArray(p.skus) ? p.skus.map(String) : [] })).filter(p => p.mlb && p.preco > 0);
    reply(rs, 200, { data: margemNoPreco(rq.mod.conta.loja, pares) });
  }));

  // ── diagnóstico: estado bruto do item no ML ──
  app.get(`${base}/debug-ml/:mlb`, guard, H(async (rq, rs) => {
    const { mlb } = rq.params, tk = rq.mod.getAccessToken;
    const [a, b] = await Promise.allSettled([req(tk, 'GET', `/seller-promotions/items/${mlb}?app_version=v2`, { timeout: 15000 }), req(tk, 'GET', `/items/${mlb}?attributes=id,title,price,status,seller_id`, { timeout: 15000 })]);
    const f = r => r.status === 'fulfilled' ? { ok: true, status: r.value.status, data: r.value.data } : { ok: false, error: r.reason?.response?.data || r.reason?.message };
    reply(rs, 200, { mlb, seller_promotions: f(a), item_info: f(b) });
  }));

  // ── descontos cadastrados ──
  app.get(`${base}/discounts`, guard, H(async (rq, rs) => reply(rs, 200, { data: rq.mod.store.getAll() })));
  app.get(`${base}/discounts-batch-status`, guard, (rq, rs) => reply(rs, 200, { data: rq.mod.batch.toJSON() }));
  app.post(`${base}/discounts-batch-cancel`, guard, (rq, rs) => {
    const { batch, logger } = rq.mod;
    if (!batch.isRunning) return reply(rs, 409, { message: 'Nenhum lote em andamento.', code: 'NO_BATCH_RUNNING' });
    batch.requestCancel(); logger.info('Cancelamento de lote solicitado', { jobId: batch.jobId });
    reply(rs, 200, { message: 'Cancelamento solicitado.', data: batch.toJSON() });
  });
  app.post(`${base}/discounts`, guard, H(async (rq, rs) => {
    let { name, mlb, price, color } = rq.body || {};
    if (!name || !mlb || price === undefined) return reply(rs, 400, { message: 'Dados incompletos.', code: 'MISSING_FIELDS' });
    if (typeof price === 'string') price = price.replace(',', '.');
    const num = parseFloat(price);
    if (isNaN(num) || num <= 0) return reply(rs, 400, { message: 'Preço inválido.', code: 'INVALID_PRICE' });
    reply(rs, 200, { message: 'Item salvo.', data: rq.mod.store.upsert({ name, mlb, price: num, color: color || undefined }) });
  }));
  app.delete(`${base}/discounts/:mlb`, guard, H(async (rq, rs) => {
    if (rq.mod.queue.isItemActive(rq.params.mlb)) return reply(rs, 409, { message: 'Item está sendo processado.', code: 'PROCESSING' });
    if (!rq.mod.store.remove(rq.params.mlb)) return reply(rs, 404, { message: 'Item não encontrado.', code: 'NOT_FOUND' });
    reply(rs, 200, { message: 'Item removido.' });
  }));

  // ── aplicar individual ──
  app.post(`${base}/apply-discount/:mlb`, guard, H(async (rq, rs) => {
    const { mlb } = rq.params, { store, mlService, queue, batch, logger } = rq.mod, item = store.findByMlb(mlb);
    if (!item) return reply(rs, 404, { message: 'Item não cadastrado.', code: 'NOT_FOUND' });
    if (batch.isRunning) return reply(rs, 429, { message: 'Lote em andamento. Aguarde a finalização.', code: 'BATCH_RUNNING' });
    if (queue.isItemActive(mlb)) return reply(rs, 409, { message: 'Item já está sendo processado.', code: 'PROCESSING' });
    const dias = duracao(rq.body?.durationDays);
    store.updateStatus(mlb, { processing: true, lastAttemptAt: new Date().toISOString() });
    try {
      const r = await queue.enqueue(mlb, () => mlService.applyPromotion(item.mlb, item.price, dias));
      store.updateStatus(mlb, { processing: false, lastAttemptFailed: false, lastErrorMessage: undefined, lastErrorCode: undefined, lastRawError: undefined,
        lastSuccessAt: new Date().toISOString(), promotionFinishAt: new Date(Date.now() + dias * 864e5).toISOString() });
      reply(rs, 200, { message: 'Desconto aplicado!', data: r.details });
    } catch (err) {
      const e = infoErro(err);
      store.updateStatus(mlb, { processing: false, lastAttemptFailed: true, lastErrorMessage: e.friendly, lastErrorCode: e.type, lastRawError: e.raw });
      logger.error('Falha ao aplicar desconto', { mlb, tipo: e.type, raw: e.raw });
      reply(rs, 500, { message: 'Falha ao aplicar desconto.', code: e.type, friendlyMessage: e.friendly, details: { error: e.raw, statusCode: e.type } });
    }
  }));

  // ── lotes: todos / falhas / selecionados ──
  const iniciar = (rq, rs, items, modo, vazio) => {
    const { batch, logger } = rq.mod;
    if (batch.isRunning) return reply(rs, 429, { message: 'Lote já em andamento.', code: 'BATCH_RUNNING' });
    if (!items.length) return reply(rs, 404, vazio);
    const dias = duracao(rq.body?.durationDays), id = batch.start(items.length);
    logger.info(`Lote iniciado: ${modo}`, { jobId: id, total: items.length, dias });
    rodarLote(items, rq.mod, dias).catch(e => { logger.error('Lote falhou', { erro: e.message }); batch.finish(); });
    reply(rs, 202, { message: `Processo iniciado para ${items.length} itens.`, data: { jobId: id, total: items.length } });
  };
  app.post(`${base}/apply-all-discounts`, guard, (rq, rs) => iniciar(rq, rs, rq.mod.store.getAll(), 'todos', { message: 'Nenhum desconto cadastrado.', code: 'EMPTY' }));
  app.post(`${base}/apply-failed-discounts`, guard, (rq, rs) => iniciar(rq, rs, rq.mod.store.getFailedItems(), 'falhas', { message: 'Nenhuma falha encontrada.', code: 'NO_FAILURES' }));
  app.post(`${base}/apply-selected-discounts`, guard, (rq, rs) => {
    const mlbs = Array.isArray(rq.body?.mlbs) ? rq.body.mlbs : [];
    if (!mlbs.length) return reply(rs, 400, { message: 'Lista de MLBs vazia.', code: 'MISSING_MLBS' });
    const set = new Set(mlbs);
    iniciar(rq, rs, rq.mod.store.getAll().filter(i => set.has(i.mlb)), 'selecionados', { message: 'Nenhum dos MLBs informados está cadastrado.', code: 'EMPTY' });
  });

  // ── desativar a promoção ativa no ML (mantém o preço cadastrado para reaplicar depois) ──
  app.post(`${base}/remove-promotion/:mlb`, guard, H(async (rq, rs) => {
    const { mlb } = rq.params, { mlService, store, queue, logger } = rq.mod;
    if (queue.isItemActive(mlb)) return reply(rs, 409, { message: 'Item está sendo processado.', code: 'PROCESSING' });
    try {
      const r = await mlService.removeItemPromotions(mlb);
      try { store.updateStatus(mlb, { promotionFinishAt: null }); } catch { /* item sem cadastro */ }
      logger.info('Promoção desativada no ML', { mlb, removidos: r.successIds?.length || 0 });
      reply(rs, 200, { message: 'Desconto desativado no Mercado Livre.', data: r });
    } catch (err) {
      const e = infoErro(err);
      logger.error('Falha ao remover promoção no ML', { mlb, tipo: e.type, raw: e.raw });
      reply(rs, 500, { message: 'Falha ao desativar promoção no ML.', code: e.type, friendlyMessage: e.friendly, details: { error: e.raw } });
    }
  }));

  // ── categorias ──
  const cats = new CategoriesStore(), cb = `${base}/categories`;
  const comConta = (rq, rs, next) => conta(rq.params.id) ? next() : reply(rs, 404, { message: 'Conta não encontrada.', code: 'ACCOUNT_NOT_FOUND' });
  app.get(cb, comConta, (rq, rs) => reply(rs, 200, { data: cats.list(rq.params.id) }));
  app.post(cb, comConta, (rq, rs) => {
    const { name, mlbs } = rq.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) return reply(rs, 400, { message: 'Nome obrigatório.', code: 'MISSING_NAME' });
    try { reply(rs, 200, { message: 'Categoria criada.', data: cats.create(rq.params.id, { name, mlbs }) }); }
    catch (e) { reply(rs, /UNIQUE/.test(e.message) ? 409 : 500, { message: /UNIQUE/.test(e.message) ? 'Já existe uma categoria com esse nome.' : e.message, code: 'STORE_ERROR' }); }
  });
  app.patch(`${cb}/:catId`, comConta, (rq, rs) => {
    const c = cats.update(rq.params.id, rq.params.catId, rq.body || {});
    c ? reply(rs, 200, { message: 'Categoria atualizada.', data: c }) : reply(rs, 404, { message: 'Categoria não encontrada.', code: 'NOT_FOUND' });
  });
  app.delete(`${cb}/:catId`, comConta, (rq, rs) =>
    cats.remove(rq.params.id, rq.params.catId) ? reply(rs, 200, { message: 'Categoria removida.' }) : reply(rs, 404, { message: 'Categoria não encontrada.', code: 'NOT_FOUND' }));

  // ── campanhas do ML (DEAL, relâmpago, SMART, volume…) ──
  const refIdDaPromo = async (tk, item, promoId) => {
    try {
      const d = (await req(tk, 'GET', `/seller-promotions/items/${item}?app_version=v2`, { timeout: 10000 })).data, lista = Array.isArray(d) ? d : (d?.results || []);
      const m = lista.filter(p => p.id === promoId), cand = m.find(p => ['candidate', 'pending'].includes(String(p.status?.id || p.status || '').toLowerCase()));
      return (cand || m[0])?.ref_id || (cand || m[0])?.offer_id || null;
    } catch { return null; }
  };

  app.get(`${base}/promotions`, guard, H(async (rq, rs) => {
    const all = []; let offset = 0;
    for (;;) {
      const r = (await req(rq.mod.getAccessToken, 'GET', `/seller-promotions/users/${rq.mod.seller}`, { params: { app_version: 'v2', limit: 50, offset }, timeout: 15000 })).data, res = r.results || [];
      all.push(...res); offset += res.length;
      if (offset >= (r.paging?.total ?? res.length) || !res.length || offset > 500) break;
    }
    reply(rs, 200, { data: all.map(p => ({ id: p.id, type: p.type, name: p.name || p.id, status: p.status, startDate: p.start_date || null, finishDate: p.finish_date || null, deadlineDate: p.deadline_date || null, benefits: p.benefits || null })) });
  }));

  app.get(`${base}/promotions/:promoId/items`, guard, H(async (rq, rs) => {
    const type = String(rq.query.type || '').toUpperCase(), status = String(rq.query.status || 'candidate'), si = rq.query.status_item ? String(rq.query.status_item) : null;
    if (!type) return reply(rs, 400, { message: 'type obrigatório.', code: 'MISSING_TYPE' });
    if (si && si !== 'active' && si !== 'paused') return reply(rs, 400, { message: "status_item deve ser 'active' ou 'paused'.", code: 'INVALID_STATUS_ITEM' });
    const all = []; let after = null;
    for (;;) {
      const params = { app_version: 'v2', promotion_type: type, status, limit: 50 }; if (after) params.search_after = after; if (si) params.status_item = si;
      const r = (await req(rq.mod.getAccessToken, 'GET', `/seller-promotions/promotions/${rq.params.promoId}/items`, { params, timeout: 20000 })).data, res = r.results || [];
      all.push(...res); after = r.paging?.searchAfter || r.paging?.search_after || null;
      if (!after || !res.length || all.length > 10000) break;
    }
    const data = all.map(it => {
      const min = it.min_discounted_price ?? null, max = it.max_discounted_price ?? null;
      const o = { id: it.id, price: it.price ?? null, originalPrice: it.original_price ?? null, minPrice: min, maxPrice: max, suggestedPrice: it.suggested_discounted_price ?? it.price ?? min ?? null,
        status: it.status, stock: it.stock || null, meliPercentage: it.meli_percentage ?? null, sellerPercentage: it.seller_percentage ?? null,
        boostedOffer: it.boosted_offer ?? null, discountMeliBoostedPercentage: it.discount_meli_boosted_percentage ?? null, discountMeliBoostAmount: it.discount_meli_boost_amount ?? null,
        totalPriceForBoostedOffer: it.total_price_for_boosted_offer ?? null, discountPercentage: it.discount_percentage ?? null, currency: it.currency ?? null, startDate: it.start_date ?? null, endDate: it.end_date ?? null };
      if (it.top_deal_price != null) o.topDealPrice = it.top_deal_price;
      for (const [k, c] of [['subType', 'sub_type'], ['buyQuantity', 'buy_quantity'], ['payQuantityDiscountPercentage', 'pay_quantity_discount_percentage'], ['allowCombination', 'allow_combination'], ['fixedPercentage', 'fixed_percentage'], ['fixedAmount', 'fixed_amount']]) if (it[c] != null) o[k] = it[c];
      return o;
    });
    reply(rs, 200, { data, total: data.length });
  }));

  app.post(`${base}/promotions/:promoId/apply`, guard, H(async (rq, rs) => {
    const promoId = rq.params.promoId, type = String(rq.body?.type || '').toUpperCase(), items = Array.isArray(rq.body?.items) ? rq.body.items : [], tk = rq.mod.getAccessToken;
    if (!type) return reply(rs, 400, { message: 'type obrigatório.', code: 'MISSING_TYPE' });
    if (!items.length) return reply(rs, 400, { message: 'Lista de itens vazia.', code: 'EMPTY' });
    const soAceita = SO_ACEITA.has(type), results = { success: [], failed: [] }; let cursor = 0;
    const post = (mlb, body) => req(tk, 'POST', `/seller-promotions/items/${mlb}?app_version=v2`, { data: body, timeout: 25000 });
    async function worker() {
      while (cursor < items.length) {
        const it = items[cursor++], deal = parseFloat(it.dealPrice);
        if (!it.mlb) { results.failed.push({ mlb: '', error: 'MLB ausente' }); continue; }
        if (!soAceita && (!isFinite(deal) || deal <= 0)) { results.failed.push({ mlb: it.mlb, error: 'deal_price inválido' }); continue; }
        const body = { promotion_id: promoId, promotion_type: type };
        if (!soAceita) body.deal_price = deal;
        const top = parseFloat(it.topDealPrice); if (isFinite(top) && top > 0) body.top_deal_price = top;
        if (soAceita) { const ref = await refIdDaPromo(tk, it.mlb, promoId); if (ref) body.offer_id = ref; }
        try { results.success.push({ mlb: it.mlb, status: (await post(it.mlb, body)).status }); }
        catch (err) {
          const msg = String(err.response?.data?.message || err.response?.data?.error || err.message);
          if (!body.offer_id && /offer\s*id/i.test(msg)) {
            const ref = await refIdDaPromo(tk, it.mlb, promoId);
            if (ref) {
              body.offer_id = ref;
              try { results.success.push({ mlb: it.mlb, status: (await post(it.mlb, body)).status }); continue; }
              catch (e2) { results.failed.push({ mlb: it.mlb, error: String(e2.response?.data?.message || e2.response?.data?.error || e2.message).substring(0, 200) }); continue; }
            }
          }
          results.failed.push({ mlb: it.mlb, error: msg.substring(0, 200) });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(5, items.length) }, worker));
    reply(rs, 200, { message: `${results.success.length} aplicado(s), ${results.failed.length} falha(s)`, data: results });
  }));
}
