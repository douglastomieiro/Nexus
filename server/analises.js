// Análises derivadas: margem das promoções ("se eu participar") e alertas acionáveis.
import { db } from './db.js';
import { calcular, getCustos } from './margem.js';
import { LIMITE_FRETE_GRATIS, freteGratisNoPreco } from './collectors.js';

const r2 = n => Math.round(n * 100) / 100;
// início de uma janela de N dias (hoje incluído) no fuso de Brasília
const diaBR = (nDias = 1) => new Date(Date.now() - 3 * 3600e3 - (nDias - 1) * 864e5).toISOString().slice(0, 10);
const rows = (sql, ...a) => db.prepare(sql).all(...a);
const parse = r => ({ ...r, body: JSON.parse(r.body) });

// Comissão no preço promocional: /sites/MLB/listing_prices → sale_fee_amount JÁ inclui a tarifa fixa (sale_fee_details.fixed_fee)
// quando ela existe — conferido centavo a centavo com o sale_fee dos pedidos reais. Antes somava-se uma tarifa fixa por faixa
// por cima (R$ 6,25–6,75/un. a mais em itens < R$ 79).
// Frete: média real por unidade nos últimos 90 dias (inclui o efeito de pacotes com várias unidades). Quando o preço promocional
// cruza R$ 79 (limite do frete grátis) ou o anúncio não vendeu em 90 dias, a média não serve: usa a COTAÇÃO do ML no preço
// promocional (/users/{id}/shipping_options/free, coletor `promocoes`). Só sem cotação a linha fica como estimativa.

// ───────── Promoções com margem ─────────
export function promocoesComMargem(lojas) {
  const R = calcular({ lojas, desde: diaBR(90) });
  const custos = getCustos();
  const porItem = Object.fromEntries(R.porItem.map(x => [x.loja + '|' + x.item, x]));
  const un = R.porItem.reduce((t, x) => t + x.unidades, 0);
  const freteGlobal = un ? R.porItem.reduce((t, x) => t + x.frete, 0) / un : 0;
  const aliqLoja = Object.fromEntries(lojas.map(l => { const u = R.aliquotasUsadas[l] || {}, ks = Object.keys(u).sort(); return [l, ks.length ? u[ks.at(-1)] / 100 : (R.config['aliquota_' + l] || 0) / 100]; }));
  const out = [];
  for (const loja of lojas) {
    const meta = {};
    for (const r of rows("SELECT chave, body FROM raw WHERE loja=? AND recurso='promotion' AND status=200", loja)) meta[r.chave] = JSON.parse(r.body);
    for (const r of rows("SELECT chave, body FROM raw WHERE loja=? AND recurso='promotions_list' AND status=200", loja)) for (const p of JSON.parse(r.body).results || []) meta[p.id] ||= p;
    const itens = {}; // anúncio -> item bruto (título, preço atual)
    for (const r of rows("SELECT chave, body FROM raw WHERE loja=? AND recurso='promotion_items' AND status=200", loja)) {
      const promo = r.chave.slice(0, r.chave.lastIndexOf(':')), pm = meta[promo] || { id: promo };
      for (const it of JSON.parse(r.body).results || []) {
        if (!it.price) continue;
        const raw = itens[it.id] ||= db.prepare("SELECT body FROM raw WHERE loja=? AND recurso='item' AND chave=? AND status=200").get(loja, it.id);
        const item = raw ? JSON.parse(raw.body) : null;
        const fee = db.prepare("SELECT body FROM raw WHERE loja=? AND recurso='listing_fee' AND chave=? AND status=200").get(loja, it.id + ':' + it.price);
        const feeAmt = fee ? JSON.parse(fee.body).sale_fee_amount : null;
        const st = porItem[loja + '|' + it.id];
        const sku = item?.seller_custom_field || st?.sku || it.id;
        const cUnit = custos[st?.sku] ?? custos[it.id] ?? (item?.seller_custom_field ? custos[item.seller_custom_field] : undefined);
        const preco = it.price, comissao = feeAmt != null ? feeAmt : preco * (st && st.receita ? st.comissao / st.receita : 0.16);
        const precoRef = item?.price ?? it.original_price;
        const cruzaFaixa = precoRef != null && (precoRef >= LIMITE_FRETE_GRATIS) !== (preco >= LIMITE_FRETE_GRATIS);
        const cot = db.prepare("SELECT body FROM raw WHERE loja=? AND recurso='frete_cotacao' AND chave=? AND status=200").get(loja, `${it.id}:${it.price}:${freteGratisNoPreco(item, preco) ? 1 : 0}`);
        const freteCot = cot ? JSON.parse(cot.body).coverage?.all_country?.list_cost : null;
        const temHist = !!(st && st.unidades);
        const freteFonte = freteCot != null && (cruzaFaixa || !temHist) ? 'cotacao' : temHist ? 'media' : 'media_loja';
        const frete = freteFonte === 'cotacao' ? freteCot : temHist ? st.frete / st.unidades : freteGlobal;
        const imposto = preco * aliqLoja[loja];
        const margemPromo = cUnit == null ? null : preco - comissao - frete - imposto - cUnit;
        const margemAtual = st && st.unidades && !st.semCusto ? (st.lucro + st.ads) / st.unidades : null; // por unidade, antes de Ads
        out.push({ loja, promo, nome: pm.name || null, tipo: pm.type || it.promotion_type, statusPromo: pm.status, inicio: pm.start_date, fim: pm.finish_date, statusItem: it.status,
          item: it.id, titulo: item?.title || st?.titulo || it.id, precoAtual: item?.price ?? it.original_price, precoPromo: preco, desconto: it.original_price ? 1 - preco / it.original_price : null,
          comissao: r2(comissao), frete: r2(frete), imposto: r2(imposto), custo: cUnit ?? null, margemPromo: margemPromo == null ? null : r2(margemPromo),
          margemPromoPct: margemPromo == null ? null : margemPromo / preco, margemAtualUn: margemAtual == null ? null : r2(margemAtual),
          unidades90: st?.unidades || 0, freteFonte, freteCotado: freteCot, cruzaFaixa,
          // estimativa só quando falta dado exato: tarifa sem cotação, ou frete pela média da loja / média que não vale mais (cruza R$ 79) sem cotação
          estimado: feeAmt == null || freteFonte === 'media_loja' || (cruzaFaixa && freteFonte !== 'cotacao') });
      }
    }
  }
  return out.sort((a, b) => (a.margemPromo ?? 1e9) - (b.margemPromo ?? 1e9));
}

// ───────── Alertas ─────────
export function gerarAlertas(lojas, nomes) {
  const A = [];
  const add = (nivel, titulo, detalhe, view, itens = []) => A.push({ nivel, titulo, detalhe, view, itens });
  const R30 = calcular({ lojas, desde: diaBR(30) });
  const R90 = calcular({ lojas, desde: diaBR(90) });
  const ph = lojas.map(() => '?').join(',');
  const N = l => nomes[l] || l;

  // 1) SKUs com prejuízo
  const prej = R30.skus.filter(s => !s.semCusto && s.lucro < 0).sort((a, b) => a.lucro - b.lucro);
  if (prej.length) add('alta', `${prej.length} produto(s) vendendo com PREJUÍZO (30 dias)`, `Perda somada: R$ ${r2(-prej.reduce((t, s) => t + s.lucro, 0))}. Reveja preço, frete, Ads ou pause.`, 'lucro',
    prej.slice(0, 12).map(s => ({ texto: s.titulo, extra: `lucro R$ ${r2(s.lucro)} em ${s.unidades} un.`, loja: s.lojas.map(N).join('/'), item: s.item })));

  // 2) produtos vendidos sem custo cadastrado
  const sc = R30.skus.filter(s => s.semCusto).sort((a, b) => b.receita - a.receita);
  if (sc.length) add('media', `${sc.length} produto(s) vendidos SEM custo cadastrado`, `Representam ${(100 * R30.cobertura.pctReceitaSemCusto).toFixed(0)}% da receita — o lucro mostrado está superestimado até preencher.`, 'custos',
    sc.slice(0, 10).map(s => ({ texto: s.titulo, extra: `receita R$ ${r2(s.receita)}`, loja: s.lojas.map(N).join('/'), item: s.item })));

  // 3) ruptura de estoque próxima (por anúncio) e anúncios pausados que vendiam
  const itens = rows(`SELECT loja, chave, body FROM raw WHERE recurso='item' AND status=200 AND loja IN (${ph})`, ...lojas).map(parse);
  const v90 = Object.fromEntries(R90.porItem.map(x => [x.loja + '|' + x.item, x]));
  const rupt = [];
  for (const it of itens) {
    const b = it.body, s = v90[it.loja + '|' + it.chave]; if (!s) continue;
    const taxa = s.unidades / 90;
    if (b.status === 'active' && taxa >= 0.3) { const dias = b.available_quantity / taxa; if (dias < 15) rupt.push({ texto: b.title, extra: `estoque ${b.available_quantity} · vende ${taxa.toFixed(1)}/dia → ${dias.toFixed(0)} dia(s)`, loja: N(it.loja), item: it.chave, dias }); }
  }
  rupt.sort((a, b) => a.dias - b.dias);
  if (rupt.length) add(rupt[0].dias < 7 ? 'alta' : 'media', `${rupt.length} anúncio(s) com estoque para menos de 15 dias`, 'Estoque por anúncio (o mesmo produto físico pode estar em vários anúncios/kits).', 'itens', rupt.slice(0, 12));
  const pausados = itens.filter(it => it.body.status === 'paused' && (v90[it.loja + '|' + it.chave]?.unidades || 0) >= 20)
    .map(it => ({ texto: it.body.title, extra: `${v90[it.loja + '|' + it.chave].unidades} un. vendidas em 90 dias`, loja: N(it.loja), item: it.chave, u: v90[it.loja + '|' + it.chave].unidades })).sort((a, b) => b.u - a.u);
  if (pausados.length) add('media', `${pausados.length} anúncio(s) PAUSADO(S) que vendiam bem`, 'Venda parada: confirme se a pausa é intencional.', 'itens', pausados.slice(0, 10));

  // 4) Ads: gasto sem retorno e ACOS acima da margem
  const ads = rows(`SELECT loja, body FROM raw WHERE recurso='ads_ad' AND status=200 AND loja IN (${ph})`, ...lojas).map(r => ({ loja: r.loja, ...JSON.parse(r.body) }));
  const semRet = ads.filter(a => (a.metrics?.cost || 0) >= 20 && !(a.metrics?.total_amount > 0)).sort((a, b) => b.metrics.cost - a.metrics.cost);
  if (semRet.length) add('media', `${semRet.length} anúncio(s) gastando em Ads SEM nenhuma venda (90 dias)`, `Gasto somado: R$ ${r2(semRet.reduce((t, a) => t + a.metrics.cost, 0))}.`, 'ads',
    semRet.slice(0, 10).map(a => ({ texto: a.title, extra: `R$ ${r2(a.metrics.cost)} · ${a.metrics.clicks} cliques`, loja: N(a.loja), item: a.item_id })));
  const acosAlto = ads.map(a => { const s = v90[a.loja + '|' + a.item_id]; if (!s || s.semCusto || !s.receita || !(a.metrics?.total_amount > 0)) return null; const margemSemAds = (s.lucro + s.ads) / s.receita; const acos = a.metrics.cost / a.metrics.total_amount; return acos > margemSemAds && a.metrics.cost >= 20 ? { texto: a.title, extra: `ACOS ${(100 * acos).toFixed(1)}% > margem sem Ads ${(100 * margemSemAds).toFixed(1)}%`, loja: N(a.loja), item: a.item_id, d: acos - margemSemAds } : null; }).filter(Boolean).sort((a, b) => b.d - a.d);
  if (acosAlto.length) add('alta', `${acosAlto.length} anúncio(s) em que o ACOS é MAIOR que a margem`, 'O Ads consome mais do que o produto rende: o anúncio dá prejuízo mesmo vendendo.', 'ads', acosAlto.slice(0, 10));

  // 5) frete pesando demais
  const fr = R30.skus.filter(s => s.receita >= 500 && s.frete / s.receita > 0.3).sort((a, b) => b.frete / b.receita - a.frete / a.receita);
  if (fr.length) add('media', `${fr.length} produto(s) com frete acima de 30% da receita`, 'Frete corroendo a margem: reveja preço, kit ou logística.', 'lucro',
    fr.slice(0, 10).map(s => ({ texto: s.titulo, extra: `frete ${(100 * s.frete / s.receita).toFixed(0)}% da receita`, loja: s.lojas.map(N).join('/'), item: s.item })));

  // 6) atendimento
  const q = rows(`SELECT count(*) n FROM raw WHERE recurso='question' AND status=200 AND json_extract(body,'$.status')='UNANSWERED' AND loja IN (${ph})`, ...lojas)[0].n;
  if (q) add('alta', `${q} pergunta(s) SEM resposta`, 'Responder rápido melhora conversão e reputação.', 'atendimento');
  const abertas = rows(`SELECT loja, chave, body FROM raw WHERE recurso='claim' AND status=200 AND json_extract(body,'$.status')='opened' AND loja IN (${ph})`, ...lojas).map(parse);
  if (abertas.length) add('alta', `${abertas.length} reclamação(ões)/devolução(ões) ABERTA(S)`, 'Reclamações abertas afetam a reputação se passarem do prazo.', 'atendimento',
    abertas.slice(0, 10).map(c => ({ texto: `${c.body.type} · motivo ${c.body.reason_id}`, extra: `pedido ${c.body.resource_id}`, loja: N(c.loja), pedido: c.body.resource_id })));
  const naoLidas = rows(`SELECT loja, body FROM raw WHERE recurso='messages_unread' AND status=200 AND loja IN (${ph})`, ...lojas).map(r => ({ loja: r.loja, total: JSON.parse(r.body).total || 0 })).filter(x => x.total > 0);
  if (naoLidas.length) add('alta', `${naoLidas.reduce((t, x) => t + x.total, 0)} mensagem(ns) pós-venda NÃO lida(s)`, naoLidas.map(x => `${N(x.loja)}: ${x.total}`).join(' · '), 'atendimento');

  // 7) envios atrasados (prazo estourado, ainda não entregues)
  const atr = rows(`SELECT sl.loja, sl.chave, s.body sb FROM raw sl JOIN raw s ON s.loja=sl.loja AND s.recurso='shipment' AND s.chave=sl.chave AND s.status=200
    WHERE sl.recurso='shipment_sla' AND sl.status=200 AND json_extract(sl.body,'$.status')='delayed' AND json_extract(s.body,'$.status') NOT IN ('delivered','cancelled','not_delivered') AND sl.loja IN (${ph})`, ...lojas);
  if (atr.length) add('alta', `${atr.length} envio(s) ATRASADO(S) em andamento`, 'Prazo de entrega estourado e ainda não entregue.', 'envios');

  // 8) devoluções acima do normal
  const taxaDev = R30.total.pedidos ? R30.total.qtdDevolucoes / (R30.total.pedidos + R30.total.qtdDevolucoes) : 0;
  if (taxaDev > 0.04) add('media', `Taxa de cancelamento/devolução em ${(100 * taxaDev).toFixed(1)}% (30 dias)`, `${R30.total.qtdDevolucoes} pedidos reembolsados · R$ ${R30.total.devolvido} devolvidos · perda R$ ${R30.total.perdaDevolucao}.`, 'devolucoes');

  // 9) reputação
  for (const r of rows(`SELECT loja, body FROM raw WHERE recurso='user' AND status=200 AND loja IN (${ph})`, ...lojas)) {
    const rep = JSON.parse(r.body).seller_reputation; if (!rep) continue;
    const lv = rep.level_id || ''; if (lv && !/green/.test(lv)) add('alta', `${N(r.loja)}: reputação fora do verde (${lv})`, `Reclamações ${(100 * (rep.metrics?.claims?.rate || 0)).toFixed(2)}% · atrasos ${(100 * (rep.metrics?.delayed_handling_time?.rate || 0)).toFixed(2)}% · cancelamentos ${(100 * (rep.metrics?.cancellations?.rate || 0)).toFixed(2)}%.`, 'reputacao');
  }

  // 10) coleta de dados parada ou com erro
  for (const l of lojas) {
    const u = rows("SELECT fim FROM coleta_log WHERE loja=? AND modulo='pedidos' ORDER BY id DESC LIMIT 1", l)[0];
    if (!u || Date.now() - u.fim > 30 * 60e3) add('alta', `${N(l)}: coleta de pedidos PARADA`, u ? `Última coleta há ${Math.round((Date.now() - u.fim) / 60e3)} min. Verifique se o sistema antigo está ligado (renova o token do ML) e o servidor do Nexus.` : 'Nenhuma coleta registrada.', 'cobertura');
  }

  const ordem = { alta: 0, media: 1, info: 2 };
  return A.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}
