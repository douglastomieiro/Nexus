// Fila serial por loja e estado do lote (progresso, fases, cancelamento). Portado do sistema DESCONTOS.
import crypto from 'node:crypto';
import { sleep } from './ml.js';

export class BatchState {
  constructor() { this.reset(); }
  reset() {
    Object.assign(this, { isRunning: false, jobId: null, startedAt: null, finishedAt: null, total: 0, processed: 0, successCount: 0, failureCount: 0,
      currentItem: null, results: [], lastUpdatedAt: null, cancelRequested: false, cancelledAt: null, phase: 1,
      phase1: { total: 0, processed: 0, success: 0, failure: 0 }, phase2: { total: 0, processed: 0, success: 0, failure: 0 } });
  }
  start(total) { this.reset(); this.isRunning = true; this.jobId = crypto.randomBytes(4).toString('hex'); this.startedAt = new Date().toISOString(); this.total = total; this.phase1.total = total; this.lastUpdatedAt = this.startedAt; return this.jobId; }
  // fase 2 = repetição automática das falhas; não soma ao total (a barra do front divide 50/50)
  startRetryPhase(n) { this.phase = 2; this.phase2.total = n; this.currentItem = null; this.lastUpdatedAt = new Date().toISOString(); }
  setCurrent(item) { this.currentItem = item ? { mlb: item.mlb, name: item.name } : null; this.lastUpdatedAt = new Date().toISOString(); }
  recordSuccess(mlb) {
    if (this.phase === 1) { this.phase1.processed++; this.phase1.success++; this.processed++; this.successCount++; }
    else { this.phase2.processed++; this.phase2.success++; this.successCount++; this.failureCount = Math.max(0, this.failureCount - 1); } // recuperou na fase 2
    this.results.push({ mlb, success: true, phase: this.phase }); this.lastUpdatedAt = new Date().toISOString();
  }
  recordFailure(mlb, error, code, rawError) {
    const e = { mlb, success: false, error, code, phase: this.phase }; if (rawError) e.rawError = rawError;
    if (this.phase === 1) { this.phase1.processed++; this.phase1.failure++; this.processed++; this.failureCount++; } else { this.phase2.processed++; this.phase2.failure++; }
    this.results.push(e); this.lastUpdatedAt = new Date().toISOString();
  }
  finish() { this.isRunning = false; this.finishedAt = new Date().toISOString(); this.currentItem = null; this.lastUpdatedAt = this.finishedAt; }
  // cancelamento "melhor esforço": o item em andamento termina, os pendentes não rodam, os já aplicados ficam
  requestCancel() { if (!this.isRunning) return; this.cancelRequested = true; this.cancelledAt = new Date().toISOString(); this.isRunning = false; this.lastUpdatedAt = this.cancelledAt; }
  isCancelled() { return this.cancelRequested === true; }
  get pendingCount() { return this.phase === 1 ? this.phase1.total - this.phase1.processed : Math.max(0, this.phase2.total - this.phase2.processed); }
  toJSON() {
    const { isRunning, jobId, startedAt, finishedAt, total, processed, successCount, failureCount, currentItem, lastUpdatedAt, results, phase, cancelRequested, cancelledAt } = this;
    return { isRunning, jobId, startedAt, finishedAt, total, processed, successCount, failureCount, pendingCount: this.pendingCount, currentItem, lastUpdatedAt, results, phase,
      phase1: { ...this.phase1 }, phase2: { ...this.phase2 }, cancelRequested, cancelledAt };
  }
}

export class ProcessingQueue {
  constructor({ delayMs = 1500 } = {}) { this.delayMs = delayMs; this.activeItems = new Set(); this.chain = Promise.resolve(); }
  isItemActive(mlb) { return this.activeItems.has(mlb); }
  enqueue(mlb, fn) {
    if (this.activeItems.has(mlb)) return Promise.reject(new Error(`Item ${mlb} ja esta sendo processado.`));
    this.activeItems.add(mlb);
    const op = async () => { try { return await fn(); } finally { this.activeItems.delete(mlb); if (this.delayMs > 0) await sleep(this.delayMs); } };
    const next = this.chain.then(op, () => op());
    this.chain = next.catch(() => {});
    return next;
  }
}
