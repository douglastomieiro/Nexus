// Teste de regressão (npm test): sobe o servidor numa pasta temporária com dados de exemplo inventados (duas contas do ML),
// no modo simulado (ML_ACOES_SIMULADAS=1: nenhuma ação vai ao ML) e sem rede (test/sem-rede.mjs: todo pedido para fora recebe 403).
// Confere o cálculo do lucro, as telas da central (Vendas, Anúncios, Ads, Atendimento, Resumo), cada ação pelo Histórico de ações,
// Personalizar (módulos, regras, perfis), que nenhuma rota GET quebra (com dados e com o banco vazio) e que os scripts das telas abrem.
// O mesmo arquivo serve às duas versões: a pública aceita a pasta de dados à parte (ML_DASH_DATA); a pessoal guarda os dados na pasta
// do programa, então o teste roda uma CÓPIA do código numa pasta temporária do sistema e nunca abre o banco nem o .env de verdade.
// A pasta temporária fica FORA do projeto: a pasta da pessoal é espelhada no servidor .254 pelo FreeFileSync.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PESSOAL = !fs.existsSync(path.join(PROJ, 'server', 'contas.js')); // versão pessoal: contas fixas no .env, sem pasta de dados à parte
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-regressao-'));
const ligacoes = []; // node_modules da cópia (pessoal) aponta para o do projeto; sai antes de apagar a pasta temporária
let falhas = 0;
const ok = (c, m, extra) => { console.log(`${c ? 'OK  ' : 'FALHA'} ${m}${!c && extra !== undefined ? ` → ${JSON.stringify(extra).slice(0, 300)}` : ''}`); if (!c) falhas++; };
const perto = (a, b) => typeof a === 'number' && Math.abs(a - b) < 0.011;
const parte = t => console.log(`\n── ${t} ──`);

// ───────── dados de exemplo ─────────
const AGORA = Date.now(), quando = (dias, min = 0) => new Date(AGORA - dias * 864e5 - min * 60e3).toISOString();
const diaBR = s => new Date(Date.parse(s) - 3 * 3600e3).toISOString().slice(0, 10);
const L1 = 'loja1', L2 = 'loja2';
// nº dos pedidos cresce com a data, como no ML (a lista de vendas filtra pelo nº)
const P = { o6: '2000000000101', o1: '2000000000102', o5: '2000000000103', o4: '2000000000104', o7: '2000000000105', o2: '2000000000106', o3: '2000000000107', o8: '2000000000201' };

// duas contas do ML com tokens falsos: a leitura ao vivo chega ao fetch, que o sem-rede.mjs barra
function contas(pasta) {
  const token = JSON.stringify({ access_token: 'APP_USR-falso', refresh_token: 'TG-falso', expires_in: 21600, updated_at: AGORA });
  if (PESSOAL) { // .env com os arquivos de token de leitura e as contas de escrita dos Descontos
    fs.mkdirSync(path.join(pasta, 'data', 'descontos'), { recursive: true });
    fs.writeFileSync(path.join(pasta, '.env'), 'TOKENS_LOJA1=data/token-loja1.json\nTOKENS_LOJA2=data/token-loja2.json\n');
    for (const l of ['loja1', 'loja2']) fs.writeFileSync(path.join(pasta, 'data', `token-${l}.json`), token);
    fs.writeFileSync(path.join(pasta, 'data', 'descontos', 'contas.json'), JSON.stringify([{ id: '1001', nickname: 'LOJA_TESTE', loja: 'loja1' }, { id: '1002', nickname: 'LOJA_DOIS', loja: 'loja2' }]));
    for (const id of ['1001', '1002']) fs.writeFileSync(path.join(pasta, 'data', 'descontos', `tokens-${id}.json`), token);
    return;
  }
  fs.mkdirSync(path.join(pasta, 'data', 'tokens'), { recursive: true });
  fs.writeFileSync(path.join(pasta, 'data', 'contas.json'), JSON.stringify([
    { n: 1, tipo: 'ml', user_id: '1001', nickname: 'LOJA_TESTE', nome: 'Loja Teste' },
    { n: 2, tipo: 'ml', user_id: '1002', nickname: 'LOJA_DOIS', nome: 'Loja Dois' }]));
  for (const id of ['1001', '1002']) fs.writeFileSync(path.join(pasta, 'data', 'tokens', `ml-${id}.bin`), token); // fora do app o token fica em texto
}

function semear(pasta) {
  contas(pasta);
  const db = new Database(path.join(pasta, 'data', 'ml.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS raw (loja TEXT NOT NULL, recurso TEXT NOT NULL, chave TEXT NOT NULL, url TEXT, status INTEGER, body TEXT, coletado_em INTEGER NOT NULL, PRIMARY KEY (loja, recurso, chave))`);
  const ins = db.prepare('INSERT INTO raw VALUES (?,?,?,?,?,?,?)');
  const poe = (loja, recurso, chave, body) => ins.run(loja, recurso, String(chave), 'teste', 200, JSON.stringify(body), AGORA);

  // anúncios
  const item = (id, titulo, extra) => ({ id, title: titulo, status: 'active', price: 100, available_quantity: 10, sold_quantity: 0, listing_type_id: 'gold_special', category_id: 'MLB1234',
    shipping: { logistic_type: 'xd_drop_off' }, permalink: `https://produto.mercadolivre.com.br/${id}`, thumbnail: 'http://x/t.jpg', pictures: [{ id: 'P1', secure_url: 'https://x/1.jpg' }, { id: 'P2', secure_url: 'https://x/2.jpg' }],
    attributes: [{ id: 'BRAND', value_name: 'Marca X' }], last_updated: quando(0), ...extra });
  poe(L1, 'item', 'MLB1001', item('MLB1001', 'Camiseta Teste Azul', { sold_quantity: 50, seller_custom_field: 'SKU-A' }));
  poe(L1, 'item', 'MLB1002', item('MLB1002', 'Caneca Teste', { price: 50, available_quantity: 0, listing_type_id: 'gold_pro', seller_custom_field: 'SKU-B' }));
  poe(L1, 'item', 'MLB1003', item('MLB1003', 'Tênis Teste', { price: 200, available_quantity: 5, sold_quantity: 10, variations: [
    { id: 111, price: 200, available_quantity: 3, attribute_combinations: [{ name: 'Tamanho', value_name: '38' }], attributes: [{ id: 'SELLER_SKU', value_name: 'SKU-C38' }] },
    { id: 112, price: 200, available_quantity: 2, attribute_combinations: [{ name: 'Tamanho', value_name: '39' }], attributes: [{ id: 'SELLER_SKU', value_name: 'SKU-C39' }] }] }));
  poe(L1, 'item', 'MLB1004', item('MLB1004', 'Mochila Full', { price: 80, available_quantity: 5, sold_quantity: 20, seller_custom_field: 'SKU-D', shipping: { logistic_type: 'fulfillment' } }));
  poe(L1, 'item', 'MLB1005', item('MLB1005', 'Boné Pausado', { status: 'paused', price: 30, available_quantity: 2, seller_custom_field: 'SKU-E' }));
  poe(L2, 'item', 'MLB2001', item('MLB2001', 'Camiseta Teste (conta 2)', { price: 70, available_quantity: 4, seller_custom_field: 'SKU-A' }));
  poe(L1, 'item_performance', 'MLB1001', { score: 40, level: 'Básica', buckets: [{ title: 'Fotos', variables: [{ status: 'PENDING', title: 'Adicione mais fotos' }] }] });
  poe(L1, 'listing_fee', 'MLB1001:gold_special', { sale_fee_details: { percentage_fee: 12, fixed_fee: 0 } });
  poe(L1, 'item_available_listing_types', 'MLB1001', [{ id: 'gold_pro', name: 'Premium' }]);
  poe(L1, 'category_attributes', 'MLB1234', [{ id: 'BRAND', name: 'Marca', tags: { required: true }, value_type: 'string' }, { id: 'COLOR', name: 'Cor', tags: {}, values: [{ name: 'Azul' }] }]);
  poe(L1, 'item_description', 'MLB1001', { plain_text: 'Descrição antiga' });
  poe(L1, 'item_visits', 'MLB1001', { results: [{ date: quando(1), total: 100 }] });

  // vendas: [pedido, loja, data, envio, comprador, itens [anúncio, título, qtd, preço, tarifa, sku, extra]]
  const venda = (id, loja, data, envio, comprador, itens, extra = {}) => {
    const total = itens.reduce((t, i) => t + i[2] * i[3], 0);
    poe(loja, 'order', id, { id: Number(id), status: 'paid', date_created: data, total_amount: total, pack_id: null, buyer: { id: comprador, nickname: `COMPRADOR${comprador}` },
      order_items: itens.map(([iid, titulo, qtd, preco, tarifa, sku, x]) => ({ item: { id: iid, title: titulo, seller_sku: sku, ...x }, quantity: qtd, unit_price: preco, sale_fee: tarifa })),
      payments: [{ id: Number(id) + 1, transaction_amount: total, payment_type: 'credit_card' }], shipping: { id: envio }, tags: ['paid'], ...extra });
  };
  venda(P.o1, L1, quando(5), 5001, 9001, [['MLB1001', 'Camiseta Teste Azul', 2, 100, 12, 'SKU-A']]);
  venda(P.o2, L1, quando(0, 5), 5002, 9002, [['MLB1002', 'Caneca Teste', 1, 50, 8.5, 'SKU-B']]);
  venda(P.o3, L1, quando(0, 4), 5003, 9003, [['MLB1003', 'Tênis Teste', 1, 200, 24, 'SKU-C38', { variation_id: 111, variation_attributes: [{ name: 'Tamanho', value_name: '38' }] }]]);
  venda(P.o4, L1, quando(2), 5004, 9004, [['MLB1004', 'Mochila Full', 1, 80, 9.6, 'SKU-D']]);
  venda(P.o5, L1, quando(3), 5005, 9001, [['MLB1001', 'Camiseta Teste Azul', 1, 100, 12, 'SKU-A']]);
  venda(P.o6, L1, quando(10), 5006, 9006, [['MLB1001', 'Camiseta Teste Azul', 1, 100, 12, 'SKU-A']],
    { status: 'cancelled', payments: [{ id: 1, transaction_amount: 100, transaction_amount_refunded: 100, payment_type: 'credit_card' }] });
  venda(P.o7, L1, quando(1), 5007, 9005, [['MLB1003', 'Tênis Teste', 1, 200, 24, 'SKU-C39', { variation_id: 112 }]]);
  venda(P.o8, L2, quando(0, 3), 5008, 9008, [['MLB2001', 'Camiseta Teste (conta 2)', 1, 70, 8.4, 'SKU-A']]);

  const envio = (loja, id, pedido, status, substatus, extra = {}) => poe(loja, 'shipment', id, { id, order_id: Number(pedido), status, substatus, logistic_type: 'xd_drop_off', tracking_number: `TR${id}`,
    receiver_address: { state: { id: 'BR-SP' } }, status_history: { date_shipped: ['shipped', 'delivered'].includes(status) ? quando(4) : null }, ...extra });
  envio(L1, 5001, P.o1, 'delivered', null); envio(L1, 5002, P.o2, 'ready_to_ship', 'ready_to_print'); envio(L1, 5003, P.o3, 'ready_to_ship', 'invoice_pending');
  envio(L1, 5004, P.o4, 'ready_to_ship', 'in_warehouse', { logistic_type: 'fulfillment' }); envio(L1, 5005, P.o5, 'shipped', 'in_hub'); envio(L1, 5006, P.o6, 'delivered', null);
  envio(L1, 5007, P.o7, 'delivered', null); envio(L2, 5008, P.o8, 'ready_to_ship', 'ready_to_print');
  poe(L1, 'shipment_sla', 5001, { expected_date: quando(5), status: 'on_time' });
  poe(L1, 'shipment_sla', 5002, { expected_date: quando(0, 1), status: 'delayed' });
  poe(L1, 'shipment_sla', 5003, { expected_date: quando(-3), status: 'on_time' });
  poe(L2, 'shipment_sla', 5008, { expected_date: quando(-2), status: 'on_time' });
  poe(L1, 'shipment_costs', 5001, { senders: [{ cost: 20 }], receiver: { cost: 0 } });
  poe(L1, 'shipment_costs', 5006, { senders: [{ cost: 20 }], receiver: { cost: 0 } });
  poe(L1, 'shipment_costs', 5007, { senders: [{ cost: 15 }], receiver: { cost: 0 } });
  poe(L1, 'invoice', P.o1, { status: 'authorized', items: [] });

  // atendimento
  poe(L1, 'user_me', '1001', { id: 1001 });
  poe(L1, 'question', 6001, { id: 6001, status: 'UNANSWERED', text: 'Tem na cor verde?', item_id: 'MLB1001', from: { id: 9001 }, date_created: quando(0, 40) });
  poe(L1, 'question', 6002, { id: 6002, status: 'UNANSWERED', text: 'Serve no micro-ondas?', item_id: 'MLB1002', from: { id: 9002 }, date_created: quando(0, 20) });
  poe(L1, 'question', 6003, { id: 6003, status: 'ANSWERED', text: 'Qual o tecido?', item_id: 'MLB1001', from: { id: 9001 }, date_created: quando(2), answer: { text: 'Algodão.', date_created: quando(2, -30) } });
  poe(L1, 'messages_unread', 'vendedor', { user_id: 1001, results: [{ resource: `/packs/${P.o7}/sellers/1001`, count: 1 }] });
  poe(L1, 'messages_pack', P.o7, { messages: [{ id: 'msg1', from: { user_id: 9005 }, to: { user_id: 1001 }, text: 'O tênis veio com defeito', message_date: { created: quando(0, 120) } }], conversation_status: { status: 'active' } });
  poe(L1, 'claim', 8001, { id: 8001, resource: 'order', resource_id: Number(P.o6), type: 'returns', stage: 'claim', status: 'closed', reason_id: 'PDD1', date_created: quando(9), players: [] });
  poe(L1, 'claim', 8002, { id: 8002, resource: 'order', resource_id: Number(P.o7), type: 'returns', stage: 'claim', status: 'opened', reason_id: 'PDD2', date_created: quando(0, 300), related_entities: ['return'],
    players: [{ role: 'complainant' }, { role: 'respondent', available_actions: [{ action: 'send_message_to_complainant', due_date: quando(-0.8) }, { action: 'return_review_ok' }, { action: 'return_review_fail' }, { action: 'refund' }] }] });
  poe(L1, 'claim_reason', 'PDD1', { detail: 'Desistiu da compra' });
  poe(L1, 'claim_reason', 'PDD2', { detail: 'Produto com defeito' });
  poe(L1, 'claim_return_cost', 8001, { amount: 15 });
  poe(L1, 'claim_affects-reputation', 8001, { affects_reputation: 'not_affected' });
  poe(L1, 'claim_affects-reputation', 8002, { affects_reputation: 'affected' });
  poe(L1, 'claim_returns', 8002, { id: 9902, status: 'delivered', status_money: 'retained', refund_at: 'delivered', related_entities: [],
    shipments: [{ status: 'delivered', tracking_number: 'TRV1', destination: { name: 'seller_address' }, type: 'return' }] });

  // conta: reputação, visitas e fatura
  poe(L1, 'user', '1001', { nickname: 'LOJA_TESTE', seller_reputation: { level_id: '5_green', power_seller_status: 'gold', metrics: { sales: { completed: 100 }, claims: { rate: 0.01, value: 1 },
    delayed_handling_time: { rate: 0.02, value: 2 }, cancellations: { rate: 0, value: 0 } }, transactions: { completed: 500, ratings: { positive: 0.98 } } } });
  poe(L2, 'user', '1002', { nickname: 'LOJA_DOIS', seller_reputation: { level_id: '3_yellow', metrics: {} } });
  poe(L1, 'visitas_conta_dia', 'conta', { results: [{ date: quando(0), total: 50 }, { date: quando(9), total: 40 }] });
  poe(L1, 'billing_periods', 'ultimos', { results: [{ amount: 300, unpaid_amount: 300, expiration_date: quando(-10), period: { date_from: quando(30), date_to: quando(0) }, period_status: 'OPEN' }] });

  // Ads: campanha, anúncio com prejuízo (ACOS 60% > margem de 28%), sugerido fora de campanha e o custo do dia do pedido o1
  poe(L1, 'ads_campaign', '3001', { id: 3001, name: 'Campanha Teste', status: 'active', budget: 20, roas_target: 5, strategy: 'PROFITABILITY' });
  poe(L1, 'ads_ad', 'MLB1001', { item_id: 'MLB1001', ad_group_id: 4001, campaign_id: 3001, status: 'active', title: 'Camiseta Teste Azul', price: 100, metrics: { cost: 60, total_amount: 100, units_quantity: 1, clicks: 30 } });
  poe(L1, 'ads_ad', 'MLB1002', { item_id: 'MLB1002', ad_group_id: 4002, campaign_id: null, status: 'idle', recommended: true, title: 'Caneca Teste', price: 50, metrics: {} });
  poe(L1, 'ads_daily', 'conta', { results: [{ date: diaBR(quando(0)), cost: 10, total_amount: 50, units_quantity: 1, prints: 100, clicks: 5 }] });
  poe(L1, 'ads_item_daily', 'MLB1001', [{ date: diaBR(quando(5)), results: [{ metrics: { cost: 6 } }] }]);
  db.close();
}

// ───────── servidor ─────────
const SEM_REDE = pathToFileURL(path.join(PROJ, 'test', 'sem-rede.mjs')).href;
async function sobe(pasta) {
  const porta = 4300 + Math.floor(Math.random() * 600), rede = path.join(pasta, 'rede.log');
  // pessoal: o programa roda da cópia (dados e .env dela); nunca da pasta do projeto
  if (PESSOAL) {
    for (const d of ['server', 'web']) fs.cpSync(path.join(PROJ, d), path.join(pasta, d), { recursive: true });
    fs.copyFileSync(path.join(PROJ, 'package.json'), path.join(pasta, 'package.json'));
    const nm = path.join(pasta, 'node_modules'); fs.symlinkSync(path.join(PROJ, 'node_modules'), nm, 'junction'); ligacoes.push(nm);
  }
  const cwd = PESSOAL ? pasta : PROJ;
  if (path.resolve(cwd) === path.resolve(PROJ) && PESSOAL) throw new Error('a versão pessoal só roda no teste a partir da cópia');
  const env = { ...process.env, ML_DASH_DATA: pasta, PORT: String(porta), HOST: '127.0.0.1', SEM_COLETA: '1', ML_ACOES_SIMULADAS: '1', SEM_REDE_LOG: rede, ML_DASH_BROKER: 'http://127.0.0.1:9' };
  delete env.ML_DASH_CHAVE; delete env.SEM_LOGIN;
  const p = spawn(process.execPath, ['--import', SEM_REDE, 'server/index.js'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const s = { p, log: '', erros: '', rede, A: `http://127.0.0.1:${porta}` };
  p.stdout.on('data', d => (s.log += d)); p.stderr.on('data', d => { s.log += d; s.erros += d; });
  const pronto = () => /(Nexus|ML Dashboard) em http/.test(s.log);
  for (let i = 0; i < 120 && !pronto(); i++) await new Promise(r => setTimeout(r, 250));
  if (!pronto()) { console.log(s.log); throw new Error('o servidor não subiu'); }
  return s;
}
// ao parar, confere que o servidor não registrou nenhum erro inesperado (rota que quebrou, cálculo que falhou)
const desce = async (s, rotulo) => { await new Promise(r => { s.p.once('exit', r); s.p.kill(); });
  const erros = s.log.split('\n').filter(l => /Error|^\s+at |\[(resumo|vendas|anuncios|publicidade|atendimento)\]/.test(l));
  ok(!erros.length, `${rotulo}: o servidor não registrou erros`, erros.slice(0, 8)); };
let S;
async function api(caminho, { metodo, corpo, cookie } = {}) {
  const r = await fetch(S.A + caminho, { method: metodo || (corpo !== undefined ? 'POST' : 'GET'), body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    headers: { ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) } });
  const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; }
  return { status: r.status, j, tx, tipo: r.headers.get('content-type') || '', cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const get = async c => (await api(c)).j;
const rotasGET = () => [...new Set(fs.readdirSync(path.join(PROJ, 'server')).filter(f => f.endsWith('.js'))
  .flatMap(f => [...fs.readFileSync(path.join(PROJ, 'server', f), 'utf8').matchAll(/app\.get\('(\/api\/[^':]+)'/g)].map(m => m[1])))].filter(r => r !== '/api/live').sort();
async function todasAsRotas(rotulo) {
  const quebradas = [];
  for (const r of rotasGET()) { const x = await api(r + '?dias=30'); if (x.status >= 500) quebradas.push(`${r} (${x.status}: ${String(x.j?.erro || x.tx).slice(0, 120)})`); }
  ok(!quebradas.length, `${rotulo}: nenhuma das ${rotasGET().length} rotas GET dá erro 500`, quebradas);
}

const DADOS = path.join(TMP, 'dados'); semear(DADOS);
S = await sobe(DADOS);
try {
  parte('Lucro real');
  // primeiros passos: com conta e pedidos coletados, faltam alíquota, custos e Minhas regras
  const passo = (P, id) => P.passos.find(p => p.id === id);
  let pp = await get('/api/primeiros-passos');
  ok(pp.total === 5 && pp.passos.filter(p => p.feito).map(p => p.id).join() === 'contas,coleta', 'primeiros passos: conta e pedidos feitos; faltam alíquota, custos e regras', pp.passos);
  ok((await api('/api/custos', { corpo: [{ sku: 'SKU-A', custo: 40 }, { sku: 'SKU-C38', custo: 90 }, { sku: 'SKU-C39', custo: 90 }, { sku: 'SKU-D', custo: 30 }] })).status === 200, 'grava os custos dos SKUs');
  ok((await api('/api/config', { corpo: { aliquota_loja1: 10, aliquota_loja2: 6 } })).status === 200, 'grava a alíquota de cada conta');
  pp = await get('/api/primeiros-passos');
  // SKU-B (sem custo) é 50 de 900 vendidos em 90 dias: 6%, acima do limite de 5%
  ok(passo(pp, 'aliquota').feito && !passo(pp, 'custos').feito && /1 de 5 SKUs.*6%/.test(passo(pp, 'custos').detalhe), 'primeiros passos: alíquota feita; custos ainda não (1 SKU sem custo, 6% do faturamento)', pp.passos);
  const lojas = await get('/api/lojas');
  ok(Object.keys(lojas).join() === 'loja1,loja2', 'duas contas de exemplo', lojas);
  const lucro = await get('/api/lucro?dias=30'), ped = id => lucro.pedidos.find(p => String(p.id) === id);
  // o1: 200 − comissão 24 − frete 20 − imposto 10% 20 − custo 2×40 − Ads 6 = 50
  ok(perto(ped(P.o1)?.lucro, 50) && perto(ped(P.o1)?.ads, 6) && perto(ped(P.o1)?.frete, 20), 'pedido com frete, imposto, custo e Ads do dia: lucro 50', ped(P.o1));
  // o5: sem custo de envio coletado → frete médio do anúncio (20 / 2 unidades = 10): 100 − 12 − 10 − 10 − 40 = 28
  ok(perto(ped(P.o5)?.lucro, 28) && ped(P.o5)?.flags.includes('frete estimado'), 'pedido sem frete coletado usa o frete médio do anúncio: lucro 28', ped(P.o5));
  ok(ped(P.o2)?.flags.includes('sem custo'), 'pedido de SKU sem custo é marcado "sem custo"', ped(P.o2));
  ok(perto(ped(P.o3)?.custo, 90), 'custo pelo SKU da variação vendida', ped(P.o3));
  ok(lucro.total.canceladas === 1 && lucro.total.pedidos === 7, 'conta 7 pedidos válidos e 1 cancelado', lucro.total);
  const dev = lucro.devolucoes.find(d => String(d.id) === P.o6);
  ok(perto(dev?.perda, 35) && perto(dev?.freteIda, 20) && perto(dev?.freteVolta, 15) && /retornou/.test(dev?.tipo), 'devolução: frete de ida 20 + frete de volta 15 = perda 35', dev);
  const l2 = await get('/api/lucro?dias=30&loja=loja2');
  ok(l2.total.pedidos === 1 && perto(l2.pedidos[0]?.lucro, 17.4), 'filtro por conta: loja2 com 1 pedido e lucro 17,40 (mesmo SKU, alíquota própria)', l2.total);
  const dre = await get('/api/dre?meses=2');
  ok(Array.isArray(dre.porMes) && dre.porMes.length > 0, 'DRE monta os meses', dre);

  parte('Resumo');
  const C = await get('/api/central'), pe = C.pendencias;
  ok(pe.perguntas === 2 && pe.mensagens === 1 && pe.reclamacoes === 1 && pe.reclamacoesPrazo === 1, 'pendências de atendimento: 2 perguntas, 1 mensagem, 1 reclamação com prazo < 24 h', pe);
  ok(pe.enviosHoje === 1 && pe.paraImprimir === 1 && pe.atrasadas === 1 && pe.nfPendente === 1, 'pendências de envio: 1 hoje, 1 etiqueta, 1 atrasada, 1 NF-e', pe);
  ok(pe.semEstoque === 1 && pe.qualidade === 1 && pe.semCusto === 1, 'pendências de anúncios: sem estoque, qualidade baixa e sem custo', pe);
  ok(pe.adsPrejuizo === 1 && pe.adsSugeridos === 1, 'pendências de Ads: 1 com prejuízo e 1 sugerido', pe);
  const rep = C.reputacao.find(r => r.loja === 'loja1');
  ok(rep?.nivel === '5_green' && rep.reclamacoesQueAfetam.length === 1 && rep.reclamacoesQueAfetam[0].id === '8002', 'reputação: só a reclamação "affected" conta (a "not_affected" não)', rep?.reclamacoesQueAfetam);
  ok(rep?.enviosAtrasados.length === 1, 'reputação: lista o envio atrasado', rep?.enviosAtrasados);
  ok(C.fatura[0]?.emAberto === 300 && C.visitas.atual === 50, 'fatura em aberto e visitas da semana', { fatura: C.fatura, visitas: C.visitas });
  ok(C.semana?.atual.pedidos >= 4, 'semana: pedidos dos últimos 7 dias', C.semana?.atual);

  parte('Vendas');
  const vh = await get('/api/vendas/lista?aba=hoje');
  ok(JSON.stringify(vh.contagem) === JSON.stringify({ hoje: 1, proximos: 2, full: 1, transito: 1, finalizadas: 3 }), 'abas: 1 hoje, 2 próximos, 1 Full, 1 em trânsito, 3 finalizadas', vh.contagem);
  const o2 = vh.linhas.find(x => x.id === P.o2);
  ok(o2?.envio.atrasado && o2.envio.imprimir && !o2.envio.impressa && o2.conta?.semCusto, 'venda de hoje atrasada, com etiqueta para imprimir e sem custo', o2);
  const vp = await get('/api/vendas/lista?aba=proximos');
  ok(vp.linhas.find(x => x.id === P.o3)?.envio.nfPendente && vp.linhas.some(x => x.loja === 'loja2'), 'próximos: NF-e pendente e a venda da conta 2', vp.linhas.map(x => x.id));
  const fin = await get('/api/vendas/lista?aba=finalizadas');
  ok(fin.linhas.find(x => x.id === P.o1)?.conta?.lucro === 50 && fin.linhas.find(x => x.id === P.o6)?.cancelado, 'finalizadas: lucro na linha e venda cancelada', fin.linhas.map(x => [x.id, x.conta?.lucro]));
  ok(fin.linhas.find(x => x.id === P.o7)?.reclamacao === true, 'venda com reclamação aberta é marcada');
  const etq = await api('/api/vendas/etiquetas', { corpo: { loja: 'loja1', envios: ['5002'] } });
  ok(etq.status === 200 && /pdf/.test(etq.tipo) && etq.tx.startsWith('%PDF'), 'etiqueta em PDF');
  const zpl = await api('/api/vendas/etiquetas', { corpo: { loja: 'loja1', envios: ['5002'], tipo: 'zpl' } });
  ok(zpl.status === 200 && zpl.tx.includes('^XA'), 'etiqueta térmica (ZPL)');
  ok((await api('/api/vendas/etiquetas', { corpo: { loja: 'loja1', envios: ['5001'] } })).status === 400, 'etiqueta de envio já entregue é recusada');
  ok((await api('/api/vendas/etiquetas', { corpo: { loja: 'loja1', envios: ['5004'] } })).status === 400, 'etiqueta de envio Full é recusada');
  await new Promise(r => setTimeout(r, 300));
  ok((await get('/api/vendas/lista?aba=hoje')).linhas.find(x => x.id === P.o2)?.envio.impressa, 'depois da etiqueta, a venda aparece com etiqueta impressa');
  let n = await api('/api/vendas/notas', { corpo: { loja: 'loja1', pedido: P.o1, texto: 'Cliente pediu embrulho' } });
  ok(n.status === 200 && n.j.length === 1 && n.j[0].texto === 'Cliente pediu embrulho', 'nota interna gravada', n.j);
  ok((await api('/api/vendas/notas', { corpo: { loja: 'loja1', pedido: P.o1, texto: 'x'.repeat(301) } })).status === 400, 'nota acima de 300 caracteres é recusada');
  n = await api('/api/vendas/notas/apagar', { corpo: { loja: 'loja1', pedido: P.o1, nota: n.j[0].id } });
  ok(n.status === 200 && n.j.length === 0, 'nota apagada');
  ok((await api('/api/vendas/nfe', { corpo: { loja: 'loja1', pedido: P.o3, anexos: [{ nome: 'nota.xml', base64: Buffer.from('<nfe/>').toString('base64') }] } })).status === 200, 'NF-e (XML) anexada');
  ok((await api('/api/vendas/nfe', { corpo: { loja: 'loja1', pedido: P.o3, anexos: [{ nome: 'nota.txt', base64: 'eA==' }] } })).status === 400, 'NF-e em formato errado é recusada');
  const cv = await get(`/api/vendas/conversa?loja=loja1&pedido=${P.o2}`);
  ok(cv.existe === false && cv.opcoes.length === 2, 'iniciar conversa: motivos liberados', cv);
  ok((await get(`/api/vendas/conversa?loja=loja1&pedido=${P.o7}`)).existe === true, 'venda com conversa já aberta');
  ok((await api('/api/vendas/conversa', { corpo: { loja: 'loja1', pedido: P.o2, opcao: 'OTHER', texto: 'Olá! Seu pedido sai hoje.' } })).status === 200, 'conversa iniciada');
  ok((await api('/api/vendas/conversa', { corpo: { loja: 'loja1', pedido: P.o2, opcao: 'INVENTADO' } })).status === 400, 'motivo de conversa inválido é recusado');
  const ficha = await get(`/api/pedido?loja=loja1&id=${P.o1}`);
  ok(ficha && !ficha.erro, 'ficha da venda abre', ficha);
  // ao vivo: hoje o3 (lucro 51 de 200) e o8 (17,40 de 70) com custo; o2 sem custo fica fora da margem
  const av = await get('/api/aovivo');
  ok(perto(av.kpi?.hoje.margem * 100, 25.33) && av.kpi.hoje.semCusto === 1 && av.kpi.hoje.pedidos === 3, 'ao vivo: margem média de hoje (68,40 ÷ 270) sem a venda sem custo', av.kpi?.hoje);

  parte('Anúncios');
  const an = await get('/api/anuncios/lista'), a1 = an.itens.find(x => x.id === 'MLB1001');
  ok(an.cards.ativos === 5 && an.cards.pausados === 1 && an.cards.semEstoque === 1 && an.cards.qualidade === 1 && an.cards.semCusto === 1, 'cartões: ativos, pausados, sem estoque, qualidade e sem custo', an.cards);
  ok(a1?.conta.custo === 40 && a1.conta.com === 0.12 && a1.v30 === 3 && perto(a1.lucro30, 78), 'anúncio: custo, comissão da tarifa, vendas e lucro de 30 dias', a1);
  ok(an.itens.find(x => x.id === 'MLB1003')?.conta.custo === 90, 'anúncio com variações: custo pela média das vendas');
  const ac = (corpo) => api('/api/anuncios/acao', { corpo: { loja: 'loja1', ...corpo } });
  let r = await ac({ id: 'MLB1001', acao: 'preco', preco: 110 });
  ok(r.status === 200 && r.j.item?.preco === 110, 'muda o preço', r.j);
  ok((await ac({ id: 'MLB1001', acao: 'preco', preco: 0 })).status === 400, 'preço zero é recusado');
  r = await ac({ id: 'MLB1005', acao: 'status', status: 'active' });
  ok(r.status === 200 && r.j.item?.status === 'active', 'reativa anúncio pausado', r.j);
  ok((await ac({ id: 'MLB1001', acao: 'titulo', titulo: 'Camiseta Nova Azul' })).status === 400, 'título de anúncio que já vendeu é recusado');
  r = await ac({ id: 'MLB1002', acao: 'titulo', titulo: 'Caneca Teste Nova' });
  ok(r.status === 200 && r.j.item?.titulo === 'Caneca Teste Nova', 'muda o título de anúncio sem vendas', r.j);
  r = await ac({ id: 'MLB1002', acao: 'estoque', quantidade: 7 });
  ok(r.status === 200 && r.j.item?.estoque === 7, 'muda o estoque', r.j);
  ok((await ac({ id: 'MLB1004', acao: 'estoque', quantidade: 9 })).status === 400, 'estoque de anúncio Full é recusado');
  r = await ac({ id: 'MLB1003', acao: 'estoque', variacoes: [{ id: 111, qtd: 4 }, { id: 112, qtd: 6 }] });
  ok(r.status === 200 && r.j.item?.estoque === 10, 'estoque por variação', r.j);
  ok((await ac({ id: 'MLB1001', acao: 'descricao', texto: 'Descrição nova' })).status === 200, 'muda a descrição');
  ok((await ac({ id: 'MLB1001', acao: 'ficha', atributos: [{ id: 'COLOR', valor: 'Azul' }] })).status === 200, 'muda a ficha técnica');
  ok((await ac({ id: 'MLB1001', acao: 'fotos', ordem: ['P2', 'P1'] })).status === 200, 'reordena as fotos');
  ok((await ac({ id: 'MLB1001', acao: 'tipo', tipo: 'gold_premium' })).status === 400, 'tipo de anúncio não liberado é recusado');
  ok((await ac({ id: 'MLB1001', acao: 'tipo', tipo: 'gold_pro' })).status === 200, 'muda o tipo de anúncio');
  const fa = await get('/api/anuncios/item?loja=loja1&id=MLB1001');
  ok(fa.descricao === 'Descrição nova' && fa.fotos[0]?.id === 'P2' && fa.tipoId === 'gold_pro' && fa.atributos.some(a => a.id === 'COLOR' && a.valor === 'Azul') && fa.pendencias.length === 1,
    'ficha de edição mostra as mudanças', { descricao: fa.descricao, fotos: fa.fotos, tipo: fa.tipoId, pend: fa.pendencias });

  parte('Publicidade');
  const pb = await get('/api/pub/painel'), ad1 = pb.anuncios.find(x => x.item === 'MLB1001');
  ok(pb.campanhas[0]?.nome === 'Campanha Teste' && ad1?.prejuizo && perto(ad1.margemPre, 0.28), 'anúncio com ACOS acima da margem antes do Ads aparece com prejuízo', ad1);
  ok(pb.cartoes.prejuizo === 1 && pb.cartoes.sugeridos === 1, 'cartões de Ads', pb.cartoes);
  ok((await api('/api/pub/campanha', { corpo: { loja: 'loja1', id: '3001', orcamento: 30 } })).status === 200, 'muda o orçamento da campanha');
  ok((await api('/api/pub/campanha', { corpo: { loja: 'loja1', id: '3001', roas: 50 } })).status === 400, 'ROAS fora de 1 a 35 é recusado');
  ok((await get('/api/pub/painel')).campanhas[0]?.orcamento === 30, 'orçamento novo aparece na tela');
  ok((await api('/api/pub/anuncio', { corpo: { loja: 'loja1', item: 'MLB1001', acao: 'pausar' } })).status === 200, 'pausa o anúncio patrocinado');
  ok((await api('/api/pub/anuncio', { corpo: { loja: 'loja1', item: 'MLB1002', acao: 'incluir', campanha: '3001' } })).status === 200, 'inclui o sugerido na campanha');
  ok((await api('/api/pub/anuncio', { corpo: { loja: 'loja1', item: 'MLB1001', acao: 'tirar' } })).status === 200, 'tira o anúncio da campanha');
  const pb2 = await get('/api/pub/painel');
  ok(pb2.anuncios.find(x => x.item === 'MLB1001')?.status === 'idle' && pb2.anuncios.find(x => x.item === 'MLB1002')?.status === 'active', 'situação nova dos anúncios na tela');

  parte('Atendimento');
  const pg = await get('/api/at/perguntas');
  ok(pg.abertas === 2 && pg.lista[0]?.id === '6001' && pg.lista[0].anuncio.titulo === 'Camiseta Teste Azul' && pg.lista[0].totalAnteriores === 1, 'perguntas sem resposta, com o anúncio e a pergunta anterior do comprador', pg.lista[0]);
  ok(pg.tempo.n === 1 && pg.tempo.geral === 30, 'tempo de resposta (30 min)', pg.tempo);
  ok((await api('/api/at/perguntas/responder', { corpo: { loja: 'loja1', id: '6001', texto: '' } })).status === 400, 'resposta vazia é recusada');
  ok((await api('/api/at/perguntas/responder', { corpo: { loja: 'loja1', id: '6001', texto: 'Temos sim!' } })).status === 200, 'responde a pergunta');
  ok((await get('/api/at/perguntas')).abertas === 1, 'pergunta respondida sai da lista');
  ok((await api('/api/at/perguntas/bloquear', { corpo: { loja: 'loja1', comprador: '9001' } })).status === 200, 'bloqueia o comprador');
  const ms = await get('/api/at/mensagens'), cm = ms.find(x => x.pack === P.o7);
  ok(cm?.naoLidas === 1 && cm.comprador === 'COMPRADOR9005' && cm.ultima?.de === 'comprador', 'conversa não lida com a venda', cm);
  const cs = await get(`/api/at/conversa?loja=loja1&pack=${P.o7}`);
  ok(cs.mensagens?.length === 1 && cs.podeEnviar, 'abre a conversa (cópia guardada)', cs);
  r = await api('/api/at/mensagens/enviar', { corpo: { loja: 'loja1', pack: P.o7, texto: 'Vamos resolver, pode devolver.' } });
  ok(r.status === 200 && r.j.mensagens?.at(-1)?.de === 'voce', 'envia mensagem', r.j);
  ok((await api('/api/at/mensagens/enviar', { corpo: { loja: 'loja1', pack: P.o7, texto: 'x'.repeat(351) } })).status === 400, 'mensagem acima de 350 caracteres é recusada');
  const rl = await get('/api/at/reclamacoes');
  ok(Array.isArray(rl.lista ?? rl) && JSON.stringify(rl).includes('8002'), 'lista de reclamações', rl);
  ok((await api('/api/at/reclamacoes/ranking')).status === 200, 'ranking de reclamações');
  const rc = await get('/api/at/reclamacao?loja=loja1&id=8002');
  ok(rc.aberta && rc.acoes.length === 4 && rc.devolucao?.status === 'Entregue' && rc.motivosRevisao?.length > 0, 'reclamação: ações liberadas, devolução e motivos da revisão', rc);
  const rc1 = await get('/api/at/reclamacao?loja=loja1&id=8001');
  ok(rc1.perda?.final && perto(rc1.perda.perda, 35), 'reclamação encerrada mostra a perda real (35)', rc1.perda);
  const rac = corpo => api('/api/at/reclamacoes/acao', { corpo: { loja: 'loja1', id: '8002', ...corpo } });
  ok((await rac({ acao: 'allow_return' })).status === 400, 'ação que o ML não liberou é recusada');
  ok((await rac({ acao: 'return_review_fail', motivo: 'SRF2', mensagem: 'Chegou quebrado' })).status === 400, 'problema "danificado" sem foto é recusado');
  ok((await rac({ acao: 'return_review_fail', motivo: 'SRF2', mensagem: 'Chegou quebrado', anexos: [{ nome: 'foto.jpg', base64: 'eA==' }] })).status === 200, 'reporta problema no produto devolvido, com foto');
  ok((await rac({ acao: 'return_review_ok' })).status === 200, 'confirma que o produto devolvido chegou bem');
  ok((await rac({ acao: 'send_message_to_complainant', mensagem: 'Recebemos, obrigado.' })).status === 200, 'mensagem na reclamação');
  ok((await api('/api/at/respostas', { corpo: [{ titulo: 'Prazo', texto: 'Enviamos em 24 h.', uso: 'pergunta' }] })).status === 200 && (await get('/api/at/respostas'))[0]?.titulo === 'Prazo', 'respostas prontas gravadas');

  parte('Histórico de ações e rede');
  const hist = await get('/api/acoes/historico'), tipos = hist.map(h => h.tipo);
  const esperados = ['venda.etiqueta', 'venda.etiqueta_termica', 'venda.nota', 'venda.nota_apagar', 'venda.nfe', 'venda.iniciar_conversa', 'anuncio.preco', 'anuncio.reativar', 'anuncio.titulo', 'anuncio.estoque',
    'anuncio.descricao', 'anuncio.ficha', 'anuncio.fotos', 'anuncio.tipo', 'ads.campanha', 'ads.pausar', 'ads.incluir', 'ads.tirar', 'pergunta.responder', 'pergunta.bloquear', 'mensagem.enviar',
    'reclamacao.anexo', 'reclamacao.return_review_fail', 'reclamacao.return_review_ok', 'reclamacao.send_message_to_complainant'];
  ok(esperados.every(t => tipos.includes(t)), 'cada ação ficou no Histórico de ações', esperados.filter(t => !tipos.includes(t)));
  ok(hist.every(h => h.ok), 'todas as ações registradas deram certo (simuladas)', hist.filter(h => !h.ok));
  ok(hist.find(h => h.tipo === 'reclamacao.return_review_ok')?.pedido.caminho === '/post-purchase/v1/returns/9902/return-review', 'revisão da devolução vai para o id da devolução, não da reclamação');
  ok(hist.find(h => h.tipo === 'ads.campanha')?.pedido.caminho === '/marketplace/advertising/MLB/product_ads/campaigns/3001', 'campanha usa a API nova de Product Ads');
  const saidas = fs.existsSync(S.rede) ? fs.readFileSync(S.rede, 'utf8').trim().split('\n').filter(Boolean) : [];
  ok(!saidas.some(l => !l.startsWith('GET ')), 'no modo simulado, nenhuma alteração foi mandada para fora', saidas.filter(l => !l.startsWith('GET ')));

  parte('Personalizar');
  ok((await api('/api/prefs/regras', { corpo: { margemMin: 25, coberturaDias: 30, estoqueMinDias: 7, qualidadeMin: 30, respostaMin: 60 } })).status === 200, 'grava Minhas regras');
  ok((await get('/api/prefs')).regras.margemMin === 25, 'regras novas valem para as telas');
  pp = await get('/api/primeiros-passos');
  ok(pp.feitos === 4 && passo(pp, 'regras').feito && !pp.oculto, 'primeiros passos: Minhas regras salvas marca o passo', pp.passos);
  ok((await api('/api/primeiros-passos', { corpo: { oculto: true } })).j.oculto === true && (await get('/api/primeiros-passos')).oculto, 'primeiros passos: esconder fica guardado');
  ok((await get('/api/anuncios/lista')).cards.qualidade === 0, 'qualidade mínima nova muda o cartão de anúncios');
  ok((await api('/api/prefs/regras', { corpo: { margemMin: 200, coberturaDias: 30, estoqueMinDias: 7, qualidadeMin: 60, respostaMin: 60 } })).status === 400, 'regra fora do permitido é recusada');
  ok((await api('/api/prefs/modulos', { corpo: { ads: false, atendimento: false } })).status === 200, 'desliga os módulos de Ads e Atendimento');
  const C2 = await get('/api/central');
  ok(C2.modulos.ads === false && C2.pendencias.adsPrejuizo === null && C2.pendencias.paraImprimir !== null, 'Resumo sem Ads (e com Vendas)', C2.pendencias);
  ok((await get('/api/notificacoes')).itens.length === 0, 'sino sem atendimento');
  await api('/api/prefs/modulos', { corpo: {} });
  ok(Object.values((await get('/api/prefs')).modulos).every(Boolean), 'religa todos os módulos');

  parte('Perfis');
  r = await api('/api/prefs/perfis', { corpo: { ativo: true, lista: [{ nome: 'Dono', dono: true, senha: 'dono1234' }, { nome: 'Atendente', modulos: ['atendimento'], acoes: true, senha: 'atende1234' }] } });
  const dono = r.cookie;
  ok(r.status === 200 && dono.startsWith('central_sessao='), 'liga os perfis e quem ligou já entra como dono', r.j);
  ok((await api('/api/vendas/lista')).status === 401, 'sem entrar, a API pede login');
  const pf = await get('/api/prefs');
  ok(pf.perfis.precisaLogin && pf.perfis.lista.length === 0 && !pf.perfis.opcoes, 'tela de login não mostra os usuários nem detalhes dos perfis');
  ok((await api('/api/prefs/perfis', { cookie: dono, corpo: { ativo: true, lista: [{ nome: 'Dono', dono: true, senha: 'curta' }] } })).status === 400, 'senha com menos de 8 caracteres é recusada');
  ok((await api('/api/login', { corpo: { usuario: 'Atendente', senha: 'errada' } })).status === 401, 'senha errada é recusada');
  ok((await api('/api/login', { corpo: { usuario: 'ninguem', senha: 'atende1234' } })).status === 401, 'usuário que não existe é recusado');
  r = await api('/api/login', { corpo: { usuario: ' atendente ', senha: 'atende1234' } }); const at = r.cookie;
  ok(r.status === 200 && at, 'entra com usuário e senha (sem diferença de maiúsculas)');
  const cookieLogin = https => fetch(S.A + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', ...(https ? { 'x-forwarded-proto': 'https' } : {}) }, body: JSON.stringify({ usuario: 'Atendente', senha: 'atende1234' }) }).then(x => x.headers.get('set-cookie') || '');
  ok(!/Secure/i.test(await cookieLogin(false)) && /;\s*Secure/i.test(await cookieLogin(true)), 'cookie Secure só atrás de https (túnel)');
  ok((await api('/api/at/perguntas', { cookie: at })).status === 200, 'Atendente vê o atendimento');
  ok((await api('/api/at/perguntas/responder', { cookie: at, corpo: { loja: 'loja1', id: '6002', texto: 'Serve sim.' } })).status === 200, 'Atendente responde pergunta');
  ok((await api('/api/vendas/lista', { cookie: at })).status === 403, 'Atendente não vê Vendas');
  ok((await api('/api/anuncios/acao', { cookie: at, corpo: { loja: 'loja1', id: 'MLB1001', acao: 'preco', preco: 1 } })).status === 403, 'Atendente não muda anúncio');
  ok((await api('/api/prefs/regras', { cookie: at, corpo: { margemMin: 1 } })).status === 403, 'Atendente não muda as regras');
  await api('/api/logout', { cookie: at, corpo: {} });
  ok((await api('/api/at/perguntas', { cookie: at })).status === 401, 'depois de sair, a sessão não vale mais');
  const lista = (await api('/api/prefs', { cookie: dono })).j.perfis.lista;
  ok(lista.length === 2 && lista.every(p => p.temSenha), 'dono vê os perfis');
  ok((await api('/api/prefs/perfis', { cookie: dono, corpo: { ativo: false, lista: lista.map(p => ({ id: p.id, nome: p.nome, dono: p.dono, modulos: p.modulos, acoes: p.acoes })) } })).status === 200, 'dono desliga os perfis');
  ok((await api('/api/vendas/lista')).status === 200, 'sem perfis, abre direto');
  const tenta = ip => fetch(S.A + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify({ usuario: 'Dono', senha: 'errada' }) }).then(x => x.status);
  const st = await Promise.all(Array.from({ length: 9 }, () => tenta('203.0.113.9')));
  ok(st.filter(x => x === 401).length === 8 && st.includes(429), 'trava depois de 8 senhas erradas do mesmo endereço', st);
  ok(await tenta('203.0.113.10') === 401, 'a trava não bloqueia outro endereço');

  parte('Rotas e telas');
  await todasAsRotas('com dados');
} finally { await desce(S, 'com dados'); }

// banco vazio e sem contas (primeira abertura do programa; na pessoal, com as contas e sem nenhum dado)
const VAZIO = path.join(TMP, 'vazio'); fs.mkdirSync(VAZIO);
if (PESSOAL) contas(VAZIO); // a pessoal sempre tem as duas contas no .env
S = await sobe(VAZIO);
try { await todasAsRotas('banco vazio, sem contas'); } finally { await desce(S, 'banco vazio'); }

// scripts das telas: todos os do index.html existem e abrem sem erro de sintaxe
const html = fs.readFileSync(path.join(PROJ, 'web', 'index.html'), 'utf8'), srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:|^\/?vendor\//.test(s));
const ruins = [];
for (const s of srcs) { const f = path.join(PROJ, 'web', s); if (!fs.existsSync(f)) { ruins.push(`${s}: não existe`); continue; } try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: s }); } catch (e) { ruins.push(`${s}: ${e.message}`); } }
ok(srcs.length > 5 && !ruins.length, `os ${srcs.length} scripts das telas abrem sem erro de sintaxe`, ruins);

// toda tela tem explicação no botão "?" e no Manual (web/ajuda.js): as telas são lidas do código (VIEWS.x = …, const VIEWS = {…}, Object.assign(VIEWS, {…}))
const telas = new Set(), web = path.join(PROJ, 'web');
for (const f of fs.readdirSync(web).filter(f => /\.(js|html)$/.test(f) && srcs.concat('index.html').includes(f))) {
  const s = fs.readFileSync(path.join(web, f), 'utf8');
  for (const m of s.matchAll(/\bVIEWS2?\.(\w+)\s*=(?!=)/g)) telas.add(m[1]);
  for (const b of s.matchAll(/(?:const VIEWS2? = \{|Object\.assign\(VIEWS2?, \{)([\s\S]*?)\n\}\)?;/g)) for (const m of b[1].matchAll(/^  (?:async )?(\w+)(?::\s*(?:async)?\s*(?:function)?\s*\(|\s*\()/gm)) telas.add(m[1]);
}
const ajudaJs = fs.readFileSync(path.join(web, 'ajuda.js'), 'utf8'), comAjuda = new Set([...ajudaJs.matchAll(/^    (\w+): \{ o: '[^']{20,}/gm)].map(m => m[1]));
const semAjuda = [...telas].filter(t => !comAjuda.has(t));
ok(telas.size > 30 && !semAjuda.length, `as ${telas.size} telas têm explicação no Manual e no botão "?"`, semAjuda);

for (const l of ligacoes) fs.unlinkSync(l); // tira só a ligação, nunca o node_modules do projeto
fs.rmSync(TMP, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
