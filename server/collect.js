// CLI: node server/collect.js [loja1|loja2] [modulo ...] [--force] [--meses=12]
import { LOJAS } from './ml.js';
import { MODULOS } from './collectors.js';
import { rodar } from './sync.js';
const a = process.argv.slice(2);
const lojas = a.filter(x => LOJAS[x]), mods = a.filter(x => MODULOS[x]);
await rodar(mods.length ? mods : Object.keys(MODULOS), { lojas: lojas.length ? lojas : undefined, force: a.includes('--force'), meses: Number((a.find(x => x.startsWith('--meses=')) || '--meses=12').slice(8)) });
