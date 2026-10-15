import { mlGet, LOJAS } from '../server/ml.js';
import Database from 'better-sqlite3';
const db = new Database('data/ml.db', { readonly: true });
for (const loja of Object.keys(LOJAS)) {
  const u = JSON.parse(db.prepare("select body from raw where loja=? and recurso='user'").get(loja).body).id;
  const rows = db.prepare("select chave, json_extract(body,'$.receiver.cost') rc, json_extract(body,'$.gross_amount') g, json_extract(body,'$.senders[0].cost') sc from raw where loja=? and recurso='shipment_costs' and status=200").all(loja);
  const pagos = rows.filter(r => r.rc > 0).slice(0, 2), gratis = rows.filter(r => !r.rc).slice(0, 1);
  console.log(loja, 'envios c/ custo:', rows.length, '| comprador pagou frete:', rows.filter(r => r.rc > 0).length);
  for (const r of [...pagos, ...gratis]) {
    const o = db.prepare("select chave, json_extract(body,'$.total_amount') t, json_extract(body,'$.shipping_cost') sh from raw where loja=? and recurso='order' and json_extract(body,'$.shipping.id')=?").get(loja, +r.chave);
    if (!o) continue;
    const inv = await mlGet(loja, `/users/${u}/invoices/orders/${o.chave}`, { retries: 0 });
    const it = (inv.body.items || []).filter(i => String(i.external_order_id) === String(o.chave));
    console.log(' envio', r.chave, 'receiver.cost', r.rc, 'sender.cost', r.sc, '| pedido total', o.t, 'order.shipping_cost', o.sh, '| NF status', inv.status, 'itens NF:', it.map(i => `total ${i.total_amount} frete_comprador ${i.shipping_buyer_cost}`).join(' ; '), '| NF other_amount', inv.body.other_amount, 'amount', inv.body.amount);
  }
}
