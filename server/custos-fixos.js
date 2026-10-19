// Custos fixos do negócio (aluguel, salários, contador, sistemas...), digitados à mão e descontados no DRE.
// Ficam como JSON na tabela config (chave `custos_fixos`): assim entram no backup e na restauração junto com os custos dos produtos.
// Cada custo: { id, nome, categoria, valor (por mês), conta ('todas' ou loja<n>), inicio 'AAAA-MM', fim 'AAAA-MM' ou null (sem fim) }.
import { db } from './db.js';
import { setConfig } from './margem.js';

const CHAVE = 'custos_fixos';
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const erro = msg => Object.assign(new Error(msg), { status: 400 });

export const lerFixos = () => {
  const r = db.prepare('SELECT valor FROM config WHERE chave=?').get(CHAVE);
  try { const L = JSON.parse(r?.valor || '[]'); return Array.isArray(L) ? L : []; } catch { return []; }
};
const gravar = L => setConfig(CHAVE, JSON.stringify(L));

// Custos de cada mês, por categoria. Com uma conta só no filtro, entram só os custos dessa conta (os de "todas" ficam no consolidado).
export function fixosPorMes(meses, lojas, todas) {
  const L = lerFixos().filter(c => c.conta === 'todas' ? todas : lojas.includes(c.conta));
  return Object.fromEntries(meses.map(m => {
    const cats = {};
    for (const c of L) if (c.inicio <= m && (!c.fim || c.fim >= m)) cats[c.categoria] = (cats[c.categoria] || 0) + c.valor;
    return [m, cats];
  }));
}

export function registrarFixos(app, { H, nomes }) {
  app.get('/api/custos-fixos', H(() => lerFixos()));
  // cria (sem id) ou altera (com id)
  app.post('/api/custos-fixos', H((_, req) => {
    const b = req.body || {}, nome = String(b.nome || '').trim(), categoria = String(b.categoria || '').trim() || 'Outros';
    // aceita 2500, 2500.5, 2500,50 e 2.500,50 (com vírgula, o ponto é separador de milhar)
    const vs = String(b.valor ?? '').trim(), valor = Number(vs.includes(',') ? vs.replace(/\./g, '').replace(',', '.') : vs), conta = b.conta || 'todas', inicio = b.inicio, fim = b.fim || null;
    if (!nome || nome.length > 80) throw erro('Informe o nome do custo (até 80 letras).');
    if (categoria.length > 40) throw erro('Categoria muito longa (até 40 letras).');
    if (!Number.isFinite(valor) || valor <= 0 || valor > 1e9) throw erro('Informe um valor mensal maior que zero.');
    if (conta !== 'todas' && !nomes[conta]) throw erro('Conta inválida.');
    if (!MES.test(inicio || '')) throw erro('Informe o mês de início.');
    if (fim && (!MES.test(fim) || fim < inicio)) throw erro('O mês final precisa ser igual ou depois do início.');
    const L = lerFixos(), item = { id: b.id || `cf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nome, categoria, valor: Math.round(valor * 100) / 100, conta, inicio, fim };
    const i = L.findIndex(c => c.id === item.id);
    if (b.id && i < 0) throw Object.assign(new Error('Custo não encontrado.'), { status: 404 });
    if (i < 0) L.push(item); else L[i] = item;
    gravar(L);
    return L;
  }));
  app.delete('/api/custos-fixos/:id', H((_, req) => {
    const L = lerFixos(), resto = L.filter(c => c.id !== req.params.id);
    if (resto.length === L.length) throw Object.assign(new Error('Custo não encontrado.'), { status: 404 });
    gravar(resto);
    return resto;
  }));
}
