// Fase 0b — Testa TODOS os endpoints GET do inventário com IDs reais de cada conta (somente leitura).
// Uso: node scripts/02-probe.mjs [loja1|loja2] [--filtro=texto]
// Saída: data/probe/<loja>/results.json + respostas cruas em data/probe/<loja>/raw/
import fs from 'node:fs';
import path from 'node:path';
import { LOJAS, mlGet } from '../server/ml.js';

const lojas = process.argv.slice(2).filter(a => LOJAS[a]);
const filtro = (process.argv.find(a => a.startsWith('--filtro=')) || '').slice(9);
const endpoints = JSON.parse(fs.readFileSync('data/endpoints.json', 'utf8')).filter(e => e.method === 'GET');

const pick = (o, ...ks) => ks.map(k => k.split('.').reduce((a, c) => a?.[c], o)).find(v => v != null);

async function contexto(loja) {
  const c = { site_id: 'MLB' };
  const me = (await mlGet(loja, '/users/me')).body; c.user = me.id; c.nickname = me.nickname;
  const items = (await mlGet(loja, `/users/${c.user}/items/search?limit=5`)).body?.results || [];
  c.item = items[0]; c.items = items;
  if (c.item) {
    const it = (await mlGet(loja, `/items/${c.item}`)).body || {};
    c.category = it.category_id; c.user_product = it.user_product_id; c.catalog_product = it.catalog_product_id;
    c.domain = it.domain_id; c.inventory = it.inventory_id; c.family = it.family_id;
    c.picture = it.pictures?.[0]?.id; c.variation = it.variations?.[0]?.id; c.listing_type = it.listing_type_id;
  }
  const ords = (await mlGet(loja, `/orders/search?seller=${c.user}&sort=date_desc&limit=5`)).body?.results || [];
  const o = ords[0];
  if (o) { c.order = o.id; c.pack = o.pack_id || o.id; c.shipment = pick(o, 'shipping.id'); c.buyer = pick(o, 'buyer.id'); c.payment = pick(o, 'payments.0.id'); }
  const q = (await mlGet(loja, `/questions/search?seller_id=${c.user}&limit=1`)).body?.questions?.[0];
  if (q) { c.question = q.id; }
  const cl = (await mlGet(loja, `/post-purchase/v1/claims/search?limit=1`)).body?.data?.[0];
  if (cl) { c.claim = cl.id; }
  const camp = (await mlGet(loja, `/advertising/advertisers?product_id=PADS`, { headers: { 'Api-Version': '1' } })).body;
  c.advertiser = camp?.advertisers?.[0]?.advertiser_id;
  c.application = null;
  return c;
}

const VAR = [
  [/item|mlb\d*id|listing/, 'item'], [/user_?product|up_?id/, 'user_product'], [/family/, 'family'],
  [/seller|user|customer|cust|owner|account/, 'user'], [/order/, 'order'], [/pack/, 'pack'],
  [/shipment|shipping/, 'shipment'], [/question/, 'question'], [/claim/, 'claim'], [/payment/, 'payment'],
  [/category/, 'category'], [/domain/, 'domain'], [/site/, 'site_id'], [/product|catalog/, 'catalog_product'],
  [/picture/, 'picture'], [/variation/, 'variation'], [/inventory/, 'inventory'], [/advertiser/, 'advertiser'], [/buyer/, 'buyer'],
];
const SEG = { items: 'item', orders: 'order', shipments: 'shipment', users: 'user', packs: 'pack', questions: 'question', claims: 'claim',
  'user-products': 'user_product', 'user-products-families': 'family', categories: 'category', products: 'catalog_product',
  pictures: 'picture', inventories: 'inventory', feedback: 'order', domains: 'domain', visits: 'item', sites: 'site_id', advertisers: 'advertiser' };

function resolve(ep, ctx) {
  let p = ep.path, q = ep.queries[0] || '';
  const missing = new Set();
  const sub = (s) => s.replace(/(\$\{?([A-Za-z_]+)\}?|\{([A-Za-z_]+)\}|:([A-Za-z_]+))/g, (m, _a, n1, n2, n3) => {
    const name = (n1 || n2 || n3).toLowerCase();
    if (/^(access_token|token|app_id|client_id|client_secret|code|redirect_uri)$/.test(name)) { missing.add(name); return m; }
    const hit = VAR.find(([re]) => re.test(name));
    const v = hit && (hit[1] === 'site_id' ? 'MLB' : ctx[hit[1]]);
    if (v == null) { missing.add(name); return m; }
    return v;
  });
  p = sub(p); q = sub(q);
  // IDs de exemplo literais no meio do path → trocar pelo ID real da coleção
  const segs = p.split('/');
  for (let i = 2; i < segs.length; i++) {
    const kind = SEG[segs[i - 1]];
    if (kind && /^(MLB\d+|\d{5,})$/.test(segs[i]) && ctx[kind] != null && !(kind === 'category' || kind === 'domain')) segs[i] = ctx[kind];
  }
  p = segs.join('/');
  if (q) q = q.replace(/(seller_id|seller|user_id|sellerid)=\d+/g, `$1=${ctx.user}`);
  return { path: p + (q ? '?' + q : ''), missing: [...missing], hasPlaceholder: /[{}$]|\/:[a-z]/i.test(p) };
}

const slug = s => s.replace(/[^a-z0-9]+/gi, '_').slice(0, 120);
for (const loja of lojas.length ? lojas : Object.keys(LOJAS)) {
  const dir = `data/probe/${loja}`; fs.mkdirSync(dir + '/raw', { recursive: true });
  const ctx = await contexto(loja);
  fs.writeFileSync(`${dir}/contexto.json`, JSON.stringify(ctx, null, 1));
  console.log(`\n== ${loja} (${LOJAS[loja].nome}) contexto:`, Object.keys(ctx).filter(k => ctx[k] != null).join(','));
  const results = [];
  const list = endpoints.filter(e => !filtro || e.path.includes(filtro));
  let n = 0;
  for (const ep of list) {
    const r = resolve(ep, ctx);
    const row = { path: ep.path, tried: r.path, pages: ep.pages };
    if (r.hasPlaceholder || r.missing.length) { row.status = 'SKIP'; row.missing = r.missing; }
    else {
      const res = await mlGet(loja, r.path, { retries: 2 });
      row.status = res.status; row.bytes = res.bytes;
      if (res.status === 200) {
        const b = res.body;
        row.keys = Array.isArray(b) ? ['[array:' + b.length + ']'] : typeof b === 'object' ? Object.keys(b).slice(0, 25) : ['(text)'];
        fs.writeFileSync(`${dir}/raw/${slug(ep.path)}.json`, JSON.stringify({ url: r.path, body: b }, null, 1));
      } else row.error = typeof res.body === 'object' ? (res.body?.message || res.body?.error || JSON.stringify(res.body).slice(0, 200)) : String(res.body).slice(0, 200);
    }
    results.push(row);
    if (++n % 50 === 0) console.log(` ${n}/${list.length}`);
  }
  fs.writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 1));
  const c = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log(`${loja} resumo:`, c);
}
