// O navegador não pode chamar a API do Mercado Livre/Mercado Pago direto (CORS). Toda chamada vai pelo intermediário (broker/worker.js, rota POST /p),
// que só repassa e não guarda nada. O pedido vai num POST "simples" (sem pré-verificação de CORS); o token viaja no corpo, nunca na URL.
export const BROKER = String(__BROKER__ || '').replace(/\/+$/, '');

const DESTINOS = { 'https://api.mercadolibre.com': 'ml', 'https://api.mercadopago.com': 'mp' };

export async function fetchApi(url, { method = 'GET', headers = {}, body, signal } = {}) {
  if (!BROKER) throw new Error('Intermediário não configurado nesta versão do site.');
  const base = Object.keys(DESTINOS).find(b => url.startsWith(b + '/'));
  if (!base) throw new Error('Endereço não permitido: ' + url.slice(0, 60));
  const cabecalhos = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return fetch(BROKER + '/p', {
    method: 'POST', signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ api: DESTINOS[base], metodo: method, caminho: url.slice(base.length), cabecalhos, corpo: body ?? null }),
  });
}
