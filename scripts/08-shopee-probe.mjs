// Sonda a Shopee: testa quais endpoints respondem (e com quais campos) por loja. Só leitura.
import { SHOPEE, spGet, shopeeConfigurada } from '../server/shopee.js';
import fs from 'node:fs';
if (!shopeeConfigurada()) throw new Error('Shopee não configurada no .env');
const agora = Math.floor(Date.now() / 1000), d15 = agora - 14 * 86400;
const out = {};
const resumo = r => r.status + ' ' + (r.body?.error ? `ERRO ${r.body.error}: ${r.body.message}` : 'ok');
for (const loja of Object.keys(SHOPEE)) {
  out[loja] = {};
  const T = async (nome, p, params) => { const r = await spGet(loja, p, params); out[loja][nome] = r; console.log(loja, nome.padEnd(22), resumo(r)); return r; };
  await T('shop_info', '/api/v2/shop/get_shop_info');
  const lista = await T('order_list', '/api/v2/order/get_order_list', { time_range_field: 'create_time', time_from: d15, time_to: agora, page_size: 20, order_status: 'COMPLETED' });
  const sns = (lista.body?.response?.order_list || []).map(o => o.order_sn).slice(0, 3);
  if (sns.length) {
    await T('order_detail', '/api/v2/order/get_order_detail', { order_sn_list: sns, response_optional_fields: 'item_list,payment_method,total_amount,buyer_username,package_list,actual_shipping_fee,estimated_shipping_fee,pay_time,cancel_reason,buyer_cancel_reason' });
    await T('escrow_detail', '/api/v2/payment/get_escrow_detail', { order_sn: sns[0] });
    await T('escrow_batch', '/api/v2/payment/get_escrow_detail_batch', { order_sn_list: sns });
  }
  await T('return_list', '/api/v2/returns/get_return_list', { page_no: 0, page_size: 10, create_time_from: d15, create_time_to: agora });
  await T('item_list', '/api/v2/product/get_item_list', { offset: 0, page_size: 10, item_status: 'NORMAL' });
  await T('wallet_trans', '/api/v2/payment/get_wallet_transaction_list', { page_no: 0, page_size: 10, create_time_from: d15, create_time_to: agora });
  await T('ads_balance', '/api/v2/ads/get_total_balance');
}
fs.mkdirSync('data/probe', { recursive: true });
fs.writeFileSync('data/probe/shopee.json', JSON.stringify(out, null, 1));
