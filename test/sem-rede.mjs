// Carregado antes do servidor nos testes (node --import): nenhuma chamada sai do computador.
// Pedido para fora (Mercado Livre, Shopee, intermediário) recebe 403 na hora e fica anotado no arquivo SEM_REDE_LOG,
// para o teste conferir que, no modo simulado, nenhuma alteração foi mandada ao ML.
import fs from 'node:fs';

const LOG = process.env.SEM_REDE_LOG, real = globalThis.fetch;
globalThis.fetch = async (url, op = {}) => {
  const u = new URL(typeof url === 'string' ? url : url.url ?? String(url)), metodo = (op.method || url.method || 'GET').toUpperCase();
  if (['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return real(url, op);
  if (LOG) fs.appendFileSync(LOG, `${metodo} ${u.origin}${u.pathname}\n`);
  return new Response(JSON.stringify({ message: 'sem rede no teste', status: 403 }), { status: 403, headers: { 'content-type': 'application/json' } });
};
