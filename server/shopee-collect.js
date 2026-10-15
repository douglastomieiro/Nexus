// CLI: node server/shopee-collect.js [shopee1|shopee2] [pedidos|devolucoes] [--force] [--meses=12]
import { SHOPEE } from './shopee.js';
import { MODULOS_SP, rodarShopee } from './shopee-coleta.js';
const a = process.argv.slice(2);
const lojas = a.filter(x => SHOPEE[x]), mods = a.filter(x => MODULOS_SP[x]);
await rodarShopee(mods.length ? mods : undefined, { lojas: lojas.length ? lojas : undefined, force: a.includes('--force'), meses: Number((a.find(x => x.startsWith('--meses=')) || '--meses=12').slice(8)) });
