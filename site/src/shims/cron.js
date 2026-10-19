// node-cron mínimo (campos minuto e hora; os demais são "*"): dispara no começo de cada minuto enquanto a aba estiver aberta.
const campo = (expr, valor) => expr.split(',').some(p => {
  if (p === '*') return true;
  const [faixa, passo] = p.split('/'), n = passo ? Number(passo) : 1;
  const [a, b] = faixa === '*' ? [0, 59] : faixa.includes('-') ? faixa.split('-').map(Number) : [Number(faixa), passo ? 59 : Number(faixa)];
  return valor >= a && valor <= b && (valor - a) % n === 0;
});
const tarefas = [];
let timer = null;
const tic = () => {
  const d = new Date(), min = d.getMinutes(), hora = d.getHours();
  for (const t of tarefas) if (campo(t.min, min) && campo(t.hora, hora)) Promise.resolve().then(t.fn).catch(e => console.error('cron:', e?.message));
};
const proximo = () => 60_000 - (Date.now() % 60_000) + 50;
export default {
  schedule(expr, fn) {
    const [min, hora] = expr.trim().split(/\s+/);
    tarefas.push({ min, hora, fn });
    if (!timer) timer = setTimeout(function agenda() { tic(); timer = setTimeout(agenda, proximo()); }, proximo());
  },
};
