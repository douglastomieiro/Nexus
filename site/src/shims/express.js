// Mini "express": guarda as rotas que o código do servidor registra e as executa quando a página pede (via postMessage, em worker-entry.js).
export const rotas = [];
const escapa = p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compila = p => {
  const nomes = [];
  const re = new RegExp('^' + escapa(p).replace(/:([A-Za-z]+)/g, (_, n) => { nomes.push(n); return '([^/]+)'; }) + '/?$');
  return { re, nomes };
};

export default function express() {
  const app = {};
  for (const m of ['get', 'post', 'delete', 'patch', 'put']) app[m] = (p, ...hs) => { rotas.push({ m: m.toUpperCase(), ...compila(p), h: hs.at(-1) }); return app; };
  app.use = () => app;
  app.listen = (_porta, _host, cb) => { queueMicrotask(cb); return { address: () => ({ port: 0 }), on() {} }; };
  return app;
}
express.json = () => () => {};
express.static = () => () => {};

// Executa a rota e devolve { status, corpo (texto), tipo }
export function despachar({ metodo, caminho, query = {}, corpo }) {
  const alvo = rotas.find(r => r.m === metodo && r.re.test(caminho));
  if (!alvo) return Promise.resolve({ status: 404, corpo: JSON.stringify({ erro: 'rota não encontrada' }), tipo: 'application/json' });
  const params = {}; const mm = alvo.re.exec(caminho); alvo.nomes.forEach((n, i) => { params[n] = decodeURIComponent(mm[i + 1]); });
  return new Promise(resolve => {
    let status = 200, feito = false;
    const fim = (c, t) => { if (!feito) { feito = true; resolve({ status, corpo: c, tipo: t }); } };
    const res = {
      status(c) { status = c; return res; }, set() { return res; }, setHeader() { return res; },
      json: o => fim(JSON.stringify(o), 'application/json'), send: t => fim(String(t), 'text/html'), sendFile: () => fim('', 'text/plain'), end: () => fim('', 'text/plain'),
    };
    const req = { method: metodo, path: caminho, query, params, body: corpo, headers: {}, socket: { localPort: 0 } };
    Promise.resolve().then(() => alvo.h(req, res)).catch(e => { if (!e.status) console.error(e); status = e.status || 500; fim(JSON.stringify({ erro: e.message }), 'application/json'); });
  });
}
