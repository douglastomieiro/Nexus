// Aplicar/remover desconto (PRICE_DISCOUNT) no ML, orientado ao estado real do anúncio. Portado do sistema DESCONTOS.
//   1. GET  /seller-promotions/items/{id}  → estado   2. valida o preço contra min/max do ML
//   3. DELETE da promoção atual (+15 s) → 4. POST da nova, com repetição inteligente
// Erros transitórios (423, 429, 5xx, rede, conflito) repetem com backoff; elegibilidade/faixa de preço não.
import { req, sleep } from './ml.js';

export const ERR = {
  CONFLICT: 'CONFLICT', ENTITY_LOCKED: 'ENTITY_LOCKED', RATE_LIMIT: 'RATE_LIMIT', SERVER: 'SERVER', TIMEOUT: 'TIMEOUT', NETWORK: 'NETWORK',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE', NO_CANDIDATES: 'NO_CANDIDATES', NO_OFFERS: 'NO_OFFERS', PRICE_OUT_OF_RANGE: 'PRICE_OUT_OF_RANGE',
  VALIDATION: 'VALIDATION', AUTH: 'AUTH', FORBIDDEN: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND', UNKNOWN: 'UNKNOWN',
};
const RETRYABLE = new Set([ERR.CONFLICT, ERR.ENTITY_LOCKED, ERR.RATE_LIMIT, ERR.SERVER, ERR.TIMEOUT, ERR.NETWORK]);

export function classifyError(err) {
  if (!err.response) {
    const c = err.code || '', m = err.message || '';
    if (c === 'ETIMEDOUT' || c === 'ECONNABORTED' || m.includes('timeout')) return { type: ERR.TIMEOUT, retryable: true };
    return { type: ERR.NETWORK, retryable: true };
  }
  const s = err.response.status, d = err.response.data || {}, msg = String(d.message || d.error || '').toLowerCase();
  if (msg.includes('no candidates found')) return { type: ERR.NO_CANDIDATES, retryable: false };
  if (msg.includes('no offers found')) return { type: ERR.NO_OFFERS, retryable: false };
  if (msg.includes('entity_locked') || s === 423) return { type: ERR.ENTITY_LOCKED, retryable: true };
  switch (s) {
    case 400: return msg.includes('already in a promotion') || msg.includes('promotion') ? { type: ERR.CONFLICT, retryable: true } : { type: ERR.VALIDATION, retryable: false };
    case 401: return { type: ERR.AUTH, retryable: true };
    case 403: return { type: ERR.FORBIDDEN, retryable: false };
    case 404: return { type: ERR.NOT_FOUND, retryable: false };
    case 429: return { type: ERR.RATE_LIMIT, retryable: true };
    default: return s >= 500 ? { type: ERR.SERVER, retryable: true } : { type: ERR.UNKNOWN, retryable: false };
  }
}

const AMIGAVEL = {
  [ERR.NO_CANDIDATES]: 'Item não elegível para PRICE_DISCOUNT no momento', [ERR.NO_OFFERS]: 'ML não encontrou oferta removível para este item',
  [ERR.PRICE_OUT_OF_RANGE]: 'Preço fora da faixa permitida pelo ML', [ERR.ENTITY_LOCKED]: 'Item temporariamente bloqueado pelo ML, tentando novamente',
  [ERR.NOT_ELIGIBLE]: 'Item sem PRICE_DISCOUNT elegível no momento', [ERR.AUTH]: 'Erro de autenticação com o Mercado Livre', [ERR.FORBIDDEN]: 'Sem permissão para esta operação no ML',
  [ERR.RATE_LIMIT]: 'Limite de requisições do ML excedido', [ERR.CONFLICT]: 'Conflito de promoção no ML', [ERR.SERVER]: 'Erro temporário no servidor do ML',
  [ERR.TIMEOUT]: 'Timeout na comunicação com o ML', [ERR.NETWORK]: 'Erro de rede ao comunicar com o ML', [ERR.VALIDATION]: 'Dados inválidos rejeitados pelo ML',
};
export const friendlyMessage = (type, detail) => (type === ERR.PRICE_OUT_OF_RANGE && detail) || AMIGAVEL[type] || 'Erro ao processar desconto';

export class MLError extends Error {
  constructor(message, type, friendly, details) { super(message); this.name = 'MLError'; this.errorType = type; this.friendlyMessage = friendly || friendlyMessage(type); this.details = details; }
}

const jitter = (base, f = 0.25) => sleep(Math.max(100, Math.round(base + base * f * (Math.random() * 2 - 1))));

async function withRetry(fn, { maxRetries = 6, baseDelay = 2000, maxDelay = 60000, factor = 2, logger = console, label = '' } = {}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await fn(attempt); }
    catch (err) {
      if (err.errorType && !RETRYABLE.has(err.errorType)) throw err;
      const c = err.errorType ? { type: err.errorType, retryable: RETRYABLE.has(err.errorType) } : classifyError(err);
      if (!c.retryable || attempt === maxRetries) {
        if (!err.errorType) { err.errorType = c.type; err.friendlyMessage = friendlyMessage(c.type); }
        if (attempt > 1) logger.error(`${label} Falha definitiva após ${attempt} tentativa(s)`, { type: c.type, status: err.response?.status, error: err.response?.data?.message || err.message });
        throw err;
      }
      let wait = Math.min(baseDelay * factor ** (attempt - 1), maxDelay);
      if (c.type === ERR.RATE_LIMIT && err.response?.headers?.['retry-after']) wait = Math.max(wait, parseInt(err.response.headers['retry-after']) * 1000);
      if (c.type === ERR.CONFLICT) wait = Math.max(wait, 3000 * attempt);
      if (c.type === ERR.ENTITY_LOCKED) wait = Math.max(wait, 5000);
      logger.warn(`${label} Tentativa ${attempt}/${maxRetries} (${c.type}). Aguardando ${Math.round(wait / 1000)}s...`, { status: err.response?.status, error: err.response?.data?.message || err.message });
      await jitter(wait);
    }
  }
}

export class MLService {
  constructor({ getAccessToken, logger }) { this.getAccessToken = getAccessToken; this.logger = logger; }
  _req(method, path, data) { return req(this.getAccessToken, method, path, { data }); }

  async getItemPromotions(itemId) {
    try {
      const d = (await this._req('GET', `/seller-promotions/items/${itemId}?app_version=v2`)).data;
      if (Array.isArray(d)) return d;
      for (const k of ['results', 'promotions', 'data']) if (d && Array.isArray(d[k])) return d[k];
      this.logger.warn(`[${itemId}] GET retornou formato não reconhecido — retornando []`, { raw: JSON.stringify(d).substring(0, 500) });
      return [];
    } catch (err) { if (err.response?.status === 404) return []; throw err; }
  }

  analyzePriceDiscount(promotions) {
    const pd = promotions.filter(p => (p.type || p.promotion_type) === 'PRICE_DISCOUNT');
    if (!pd.length) return { found: false, hasActive: false, hasCandidate: false, all: [], totalPromos: promotions.length };
    const active = pd.find(p => ['started', 'pending', 'active'].includes(p.status)), candidate = pd.find(p => p.status === 'candidate'), src = candidate || active || pd[0];
    return { found: true, hasActive: !!active, hasCandidate: !!candidate, active, candidate, all: pd, totalPromos: promotions.length,
      minPrice: src.min_discounted_price ?? src.minDiscountedPrice ?? null, maxPrice: src.max_discounted_price ?? src.maxDiscountedPrice ?? null,
      suggestedPrice: src.suggested_discounted_price ?? src.suggestedDiscountedPrice ?? null,
      // desconto extra do ML ("boost"), só aparece no registro ativo
      boostedOffer: (active ?? src).boosted_offer ?? null, discountMeliBoostedPercentage: (active ?? src).discount_meli_boosted_percentage ?? null,
      discountMeliBoostAmount: (active ?? src).discount_meli_boost_amount ?? null, totalPriceForBoostedOffer: (active ?? src).total_price_for_boosted_offer ?? null };
  }

  validatePrice(price, a) {
    if (a.minPrice != null && price < a.minPrice) return { valid: false, reason: `R$ ${price} abaixo do mínimo R$ ${a.minPrice}` };
    if (a.maxPrice != null && price > a.maxPrice) return { valid: false, reason: `R$ ${price} acima do máximo R$ ${a.maxPrice}` };
    return { valid: true };
  }

  async removeItemPromotions(itemId) {
    try {
      const d = (await this._req('DELETE', `/seller-promotions/items/${itemId}?app_version=v2`)).data || {};
      const ok = d.successful_ids || d.successfulIds || [], errs = d.errors || [];
      this.logger.info('Remoção concluída', { mlb: itemId, removidos: ok.length, erros: errs.length });
      if (errs.length) this.logger.warn('Erros parciais na remoção', { mlb: itemId, detalhes: JSON.stringify(errs).substring(0, 500) });
      return { successIds: ok, errors: errs };
    } catch (err) {
      if (err.response?.status === 404 || classifyError(err).type === ERR.NO_OFFERS) { this.logger.info('Nada para remover', { mlb: itemId }); return { successIds: [], errors: [] }; }
      throw err;
    }
  }

  async createPromotion(itemId, dealPrice, durationDays = 30) {
    const days = Math.max(1, Math.min(30, Math.round(durationDays || 30))), now = Date.now();
    const iso = t => new Date(t).toISOString().split('.')[0];
    const res = await this._req('POST', `/seller-promotions/items/${itemId}?app_version=v2`,
      { promotion_type: 'PRICE_DISCOUNT', deal_price: dealPrice, start_date: iso(now + 2 * 60e3), finish_date: iso(now + days * 864e5) });
    return { success: true, details: res.data };
  }

  async applyPromotion(itemId, dealPrice, durationDays = 30) {
    const tag = `[${itemId}]`, t0 = Date.now();
    this.logger.info(`${tag} Iniciando aplicação orientada ao estado`, { price: dealPrice, durationDays });
    const promos = await withRetry(() => this.getItemPromotions(itemId), { maxRetries: 3, logger: this.logger, label: `${tag} GET-estado` });
    const state = this.analyzePriceDiscount(promos);
    this.logger.info(`${tag} Estado do item`, { totalPromos: promos.length, pdEncontrado: state.found, pdAtivo: state.active?.status ?? '-', pdCandidato: state.hasCandidate, faixaMin: state.minPrice, faixaMax: state.maxPrice, sugerido: state.suggestedPrice, boosted: state.boostedOffer });
    if (!state.found) this.logger.info(`${tag} Nenhum PRICE_DISCOUNT visível; tentando criar mesmo assim`, { tipos: promos.map(p => p.type || p.promotion_type || '?').join(', ') || 'nenhum' });
    if (state.found) {
      const v = this.validatePrice(dealPrice, state);
      if (!v.valid) throw new MLError(v.reason, ERR.PRICE_OUT_OF_RANGE, `Preço fora da faixa permitida: ${v.reason}`, { min: state.minPrice, max: state.maxPrice, attempted: dealPrice });
    }
    // sempre remove a promoção atual antes de criar (cobre casos em que o GET não a enxergou mas o ML ainda a vê)
    const removal = await withRetry(() => this.removeItemPromotions(itemId), { maxRetries: 3, logger: this.logger, label: `${tag} DEL` });
    if (state.hasActive || removal.successIds?.length) { this.logger.info(`${tag} Aguardando 15s pro ML processar a remoção...`); await sleep(15000); }

    // NO_CANDIDATES é intermitente logo após um DELETE: até 3 tentativas com 30 s. NO_OFFERS/faixa de preço são erros reais.
    const tryCreate = async (n) => {
      this.logger.info(`${tag} Criando promoção (tentativa ${n}/3)...`, { price: dealPrice });
      try { return await this.createPromotion(itemId, dealPrice, durationDays); }
      catch (err) {
        const { type } = classifyError(err);
        if ([ERR.NO_OFFERS, ERR.PRICE_OUT_OF_RANGE, ERR.NO_CANDIDATES].includes(type)) throw new MLError(err.response?.data?.message || err.message, type, friendlyMessage(type));
        throw err;
      }
    };
    let result;
    try { result = await tryCreate(1); }
    catch (err) {
      if (err.errorType === ERR.NO_OFFERS || err.errorType === ERR.PRICE_OUT_OF_RANGE) throw err;
      if (err.errorType === ERR.NO_CANDIDATES) {
        this.logger.warn(`${tag} NO_CANDIDATES na tentativa 1 — pode ser timing do ML. Aguardando 30s...`); await sleep(30000);
        try { result = await tryCreate(2); }
        catch (err2) {
          if (err2.errorType !== ERR.NO_CANDIDATES) throw err2;
          this.logger.warn(`${tag} NO_CANDIDATES na tentativa 2 — aguardando mais 30s...`); await sleep(30000);
          result = await tryCreate(3);
        }
        return result;
      }
      this.logger.warn(`${tag} Tentativa 1 falhou (${err.errorType || err.message}), aguardando 5s pra 2ª tentativa...`); await sleep(5000);
      result = await tryCreate(2);
    }
    this.logger.info(`${tag} Promoção aplicada com sucesso`, { price: dealPrice, duracao: `${Math.round((Date.now() - t0) / 1000)}s` });
    return result;
  }
}
