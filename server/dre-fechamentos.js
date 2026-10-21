// Fechamento mensal do DRE: uma foto dos números de um mês (para um filtro de loja e, na versão com Shopee, canal),
// para ver depois se algo mudou (devolução que chegou depois, custo corrigido, ajuste na fatura).
// Fica como JSON na tabela config (chave `dre_fechamentos`): assim entra no backup e na restauração junto com os custos.
// Cada um: { mes 'AAAA-MM', filtro (ex.: 'all', 'loja1' ou 'loja1.ml'), fechado_em (ms), linha { campo: número } }.
import { db } from './db.js';
import { setConfig } from './margem.js';

const CHAVE = 'dre_fechamentos';
const MES = /^\d{4}-(0[1-9]|1[0-2])$/, FILTRO = /^[\w.-]{1,40}$/;
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });

export const lerFechamentos = () => {
  const r = db.prepare('SELECT valor FROM config WHERE chave=?').get(CHAVE);
  try { const o = JSON.parse(r?.valor || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; }
};
const gravar = F => setConfig(CHAVE, JSON.stringify(F));

export function registrarFechamentos(app, { H }) {
  app.get('/api/dre/fechamentos', H(() => lerFechamentos()));
  // fecha um mês (ou atualiza o fechamento): guarda os números como estão agora
  app.post('/api/dre/fechamentos', H((_, req) => {
    const { mes, filtro, linha } = req.body || {};
    if (!MES.test(mes || '')) throw erro('Mês inválido.');
    if (!FILTRO.test(filtro || '')) throw erro('Filtro inválido.');
    if (!linha || typeof linha !== 'object') throw erro('Faltam os números do mês.');
    const nums = Object.entries(linha).filter(([k, v]) => /^[a-zA-Z]{1,30}$/.test(k) && Number.isFinite(v)).slice(0, 60);
    if (!nums.length) throw erro('Faltam os números do mês.');
    const F = lerFechamentos();
    F[`${mes}|${filtro}`] = { mes, filtro, fechado_em: Date.now(), linha: Object.fromEntries(nums.map(([k, v]) => [k, Math.round(v * 100) / 100])) };
    gravar(F);
    return F;
  }));
  // reabre: descarta a foto (os números do mês continuam sendo calculados normalmente)
  app.delete('/api/dre/fechamentos/:mes/:filtro', H((_, req) => {
    const F = lerFechamentos(), k = `${req.params.mes}|${req.params.filtro}`;
    if (!F[k]) throw erro('Fechamento não encontrado.', 404);
    delete F[k];
    gravar(F);
    return F;
  }));
}
