// Orquestra coletas (CLI e agendador usam o mesmo código). Evita execuções sobrepostas por módulo.
import cron from 'node-cron';
import { LOJAS, mlGet } from './ml.js';
import { MODULOS, ctx } from './collectors.js';
import { logColeta } from './db.js';
import { rodarShopee } from './shopee-coleta.js';
import { shopeeConfigurada } from './shopee.js';

const rodando = new Set();
const ids = {};

export async function rodar(modulos, { lojas = Object.keys(LOJAS), force = false, meses = 12 } = {}) {
  await Promise.all(lojas.map(async loja => {
    if (!ids[loja]) { const me = await mlGet(loja, '/users/me'); if (me.status !== 200) return console.error(`[${loja}] sem acesso:`, me.status); ids[loja] = me.body.id; }
    for (const m of modulos) {
      const key = loja + ':' + m;
      if (rodando.has(key)) { console.log(`[${loja}] ${m} ainda em execução, pulando`); continue; }
      rodando.add(key);
      const c = ctx(loja, { force, meses }, ids[loja]); const t0 = Date.now();
      try { await MODULOS[m](c); } catch (e) { c.log(`✖ ${m}:`, e.message); c.st.erros++; }
      finally { rodando.delete(key); }
      logColeta({ loja, modulo: m, inicio: t0, fim: Date.now(), chamadas: c.st.chamadas, ok: c.st.ok, erros: c.st.erros, obs: null });
      c.log(`✔ ${m} ${((Date.now() - t0) / 1000).toFixed(1)}s | chamadas ${c.st.chamadas} ok ${c.st.ok} erros ${c.st.erros}`);
    }
  }));
}

export function agendar() {
  const safe = (mods) => () => rodar(mods).catch(e => console.error('sync:', e.message));
  cron.schedule('*/5 * * * *', safe(['pedidos', 'atendimento']));
  cron.schedule('20 * * * *', safe(['pagamentos']));
  cron.schedule('40 * * * *', safe(['extrato']));
  cron.schedule('7 * * * *', safe(['itens']));
  cron.schedule('15 */3 * * *', safe(['ads']));
  cron.schedule('30 3 * * *', safe(['conta', 'promocoes', 'categorias']));
  cron.schedule('30 4 * * *', safe(['faturamento']));
  cron.schedule('0 5 * * *', safe(['historico']));
  safe(['conta', 'pedidos', 'atendimento', 'itens', 'ads', 'promocoes', 'categorias', 'pagamentos', 'extrato', 'historico', 'faturamento'])(); // ao iniciar (os lentos ficam por último)
  if (shopeeConfigurada()) { // Shopee: pedidos+escrow a cada 5 min, devoluções de hora em hora
    const sp = (m) => () => rodarShopee(m).catch(e => console.error('sync shopee:', e.message));
    cron.schedule('2-59/5 * * * *', sp(['pedidos'])); cron.schedule('25 * * * *', sp(['devolucoes'])); cron.schedule('35 */3 * * *', sp(['ads'])); cron.schedule('12 * * * *', sp(['itens'])); cron.schedule('45 3 * * *', sp(['promocoes']));
    sp(['pedidos', 'devolucoes', 'ads', 'itens', 'promocoes'])();
  }
  console.log('Agendador ativo: pedidos/atendimento 5 min · anúncios 1h · conta/promoções/categorias 03:30 · faturamento 04:30');
}
