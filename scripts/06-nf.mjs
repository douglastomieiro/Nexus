import { mlGet, LOJAS } from '../server/ml.js';
import Database from 'better-sqlite3';
const db = new Database('data/ml.db', { readonly: true });
for (const loja of Object.keys(LOJAS)) {
  const u = JSON.parse(db.prepare("select body from raw where loja=? and recurso='user'").get(loja).body).id;
  const ords = db.prepare("select chave, body from raw where loja=? and recurso='order' and json_extract(body,'$.status')='paid' order by json_extract(body,'$.date_created') desc limit 40").all(loja);
  let ok = 0, tried = 0, shown = false;
  for (const o of ords.filter((_, i) => i % 8 === 0)) {
    tried++;
    const r = await mlGet(loja, `/users/${u}/invoices/orders/${o.chave}`, { retries: 0 });
    console.log(loja, o.chave, r.status, r.status === 200 ? Object.keys(r.body).join(',') : JSON.stringify(r.body).slice(0, 160));
    if (r.status === 200 && !shown) {
      shown = true; ok++;
      const b = r.body; console.log(JSON.stringify(b, null, 1).slice(0, 1800));
      const id = b.id || b.invoice_id;
      for (const p of [`/users/${u}/invoices/documents/xml/${id}/authorized`, `/users/${u}/invoices/${id}`]) {
        const x = await mlGet(loja, p, { retries: 0 });
        console.log(' ->', p.replace(/\d{6,}/g, '#'), x.status, typeof x.body === 'string' ? x.body.slice(0, 300) : JSON.stringify(x.body).slice(0, 300));
      }
    }
  }
}
