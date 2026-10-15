// Gestão Shopee (só leitura): Dashboard, Pedidos, Produtos, Devoluções. Lucro = escrow da Shopee − imposto − custo.
// Carregado depois de jodda.js: reaproveita kpi, sect, dlt, dv, pc, mgPill, tbl, mk, ch, donut, ic, store, ddmm, csv, thS, ordena, ligaSort, pager.
(() => {
  Object.assign(ICO, { shopee: '<path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>' });
  GRUPOS.splice(GRUPOS.findIndex(g => g.n === 'Configurações'), 0,
    { n: 'Gestão Shopee', ico: 'shopee', tabs: [['shopee', 'Dashboard'], ['shopeepedidos', 'Pedidos'], ['shopeeprodutos', 'Produtos'], ['shopeeanuncios', 'Anúncios / Estoque'], ['shopeeads', 'Ads'], ['shopeepromo', 'Promoções'], ['shopeedev', 'Devoluções']] });
  Object.assign(SUB, { shopee: 'Visão geral da sua operação na Shopee — lucro pelo repasse (escrow) real', shopeepedidos: 'Repasse, taxas, frete e resultado pedido a pedido',
    shopeeprodutos: 'Resultado por SKU/variação', shopeedev: 'Devoluções e reembolsos da Shopee', shopeeanuncios: 'Preço, estoque e cobertura por variação',
    shopeeads: 'Gasto, retorno (ROAS) e saldo dos anúncios patrocinados', shopeepromo: 'Descontos, cupons e combos da loja' });
  Object.assign(PERIODO, { shopee: 1, shopeepedidos: 1, shopeeprodutos: 1, shopeedev: 1, shopeeads: 1 });
  Object.assign(NOTA, { shopeeanuncios: 'Giro: vendas dos últimos 90 dias', shopeepromo: 'Promoções atuais e anteriores' });
  // Nomes vêm do servidor (NOME_LOJA<n> no .env); cor de shopee<n> = n-ésima da paleta.
  const NOMES_SP = {}, PAL_SP = ['#ee4d2d', '#f97316', '#be123c', '#d97706', '#9f1239', '#ea580c'];
  const COR_SP = new Proxy({}, { get: (_, l) => PAL_SP[(parseInt(String(l).replace('shopee', '')) - 1) % PAL_SP.length] });
  fetch('api/shopee/lojas').then(r => (r.ok ? r.json() : {})).then(n => Object.assign(NOMES_SP, n)).catch(() => {});
  const spChip = l => `<span class="mp"><i style="background:${COR_SP[l] || '#94a3b8'}">SP</i>${esc((NOMES_SP[l] || l).replace(' (Shopee)', ''))}</span>`;
  const SIT = { COMPLETED: 'Concluído', SHIPPED: 'Enviado', TO_CONFIRM_RECEIVE: 'Aguard. confirmação', READY_TO_SHIP: 'A enviar', PROCESSED: 'Processado', TO_RETURN: 'Em devolução', IN_CANCEL: 'Cancelando', CANCELLED: 'Cancelado', UNPAID: 'Não pago', INVOICE_PENDING: 'NF pendente' };
  const MOTIVO = { NOT_RECEIPT: 'Não recebeu', ITEM_NOT_FIT: 'Não serviu/Não confere', ITEM_MISSING: 'Item faltando', FUNCTIONAL_DMG: 'Defeito', PHYSICAL_DMG: 'Danificado', CHANGE_MIND: 'Mudou de ideia', DIFFERENT_DESCRIPTION: 'Diferente do anúncio', WRONG_ITEM: 'Item errado', MISSING_ITEM: 'Item faltando', USED: 'Usado', NONRECEIPT: 'Não recebeu', DIFFERENT_ITEM: 'Item diferente' };
  const sit = s => `<span class="tag ${/COMPLETED/.test(s) ? 'ok' : /CANCEL|RETURN/.test(s) ? 'warn' : ''}">${esc(SIT[s] || s)}</span>`;
  const flags = p => (p.flags || []).map(f => `<span class="tag ${/sem custo|estimado/.test(f) ? 'warn' : /devol|reembolso/.test(f) ? 'warn' : ''}">${esc(f)}</span>`).join(' ');
  const neg = v => (v ? '−' + brl(v) : '—');

  // ═════════ CONSOLIDADO ML + SHOPEE (aba do grupo Dashboard) ═════════
  GRUPOS.find(g => g.n === 'Dashboard').tabs.push(['consolidado', 'ML + Shopee']);
  SUB.consolidado = 'Mercado Livre e Shopee somados: faturamento, custos e lucro por canal';
  PERIODO.consolidado = 1;
  Object.assign(ICO, { consolidado: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/>' });
  VIEWS.consolidado = async function () {
    const d = await api('consolidado'), T = d.total, [ML, SP] = d.canais;
    const alerta = d.cobertura.ml > .05 || d.cobertura.shopee > .05 ? `<div class="box" style="margin-bottom:14px;border-color:#fde68a;background:#fffbeb">${ic('info', 14)} Receita sem custo cadastrado: ML ${pc(d.cobertura.ml, 0)} · Shopee ${pc(d.cobertura.shopee, 0)}. O lucro fica superestimado até cadastrar os custos. <a class="lk" href="#custos">Cadastrar custos →</a></div>` : '';
    const part = (v, t) => t ? pc(v / t, 0) + ' do total' : '';
    const linha = (nome, k, fmt = brl) => `<tr><td>${nome}</td><td class="n">${fmt(ML[k])}</td><td class="n">${fmt(SP[k])}</td><td class="n"><b>${fmt(T[k])}</b></td></tr>`;
    $('#view').innerHTML = alerta + `<div class="kgrid">
      ${kpi('Faturamento total', brl(T.receita), `ML ${brl(ML.receita)} · Shopee ${brl(SP.receita)}`, 'lucro', 'blue')}
      ${kpi('Pedidos', num(T.pedidos), `ML ${num(ML.pedidos)} · Shopee ${num(SP.pedidos)}`, 'pedidos', 'purple')}
      ${kpi('Lucro total', brl(T.lucro), `ML ${brl(ML.lucro)} · Shopee ${brl(SP.lucro)}`, 'indicadores', T.lucro >= 0 ? 'green' : 'red', T.lucro >= 0 ? 'ok' : 'bad')}
      ${kpi('Margem', pc(T.margem, 1), `ML ${pc(ML.margem, 1)} · Shopee ${pc(SP.margem, 1)}`, 'abc', 'teal')}
      ${kpi('Participação da Shopee', pc(T.receita ? SP.receita / T.receita : 0, 0), part(SP.receita, T.receita) + ' do faturamento', 'shopee', 'amber')}</div>
    ${sect('Faturamento por dia', 'por canal')}
    <div class="box"><div style="height:260px"><canvas id="cs1"></canvas></div></div>
    ${sect('Resultado por canal', `últimos ${d.dias} dias`)}
    <div class="box"><div class="tw"><table><thead><tr><th></th><th class="n">Mercado Livre</th><th class="n">Shopee</th><th class="n">Total</th></tr></thead><tbody>
      ${linha('Faturamento', 'receita')}${linha('Devoluções', 'devolucao')}${linha('Comissão e taxas', 'comissao')}${linha('Frete (vendedor)', 'frete')}${linha('Imposto', 'imposto')}${linha('Custo dos produtos', 'custo')}${linha('Ads', 'ads')}
      <tr><td><b>Lucro</b></td><td class="n"><b>${brl(ML.lucro)}</b></td><td class="n"><b>${brl(SP.lucro)}</b></td><td class="n"><b>${brl(T.lucro)}</b></td></tr>${linha('Margem', 'margem', v => pc(v, 1))}</tbody></table></div>
      <p class="dica">Devoluções do ML entram no lucro como perda real (frete, tarifas e custo); na Shopee o estorno já vem descontado do repasse.</p></div>
    ${sect('Por mês', 'faturamento e lucro por canal')}
    ${tbl([{ t: 'Mês', f: m => mesNome(m.mes) }, { t: 'ML faturamento', n: 1, f: m => brl(m.ml.receita) }, { t: 'ML lucro', n: 1, f: m => brl(m.ml.lucro) }, { t: 'Shopee faturamento', n: 1, f: m => brl(m.shopee.receita) }, { t: 'Shopee lucro', n: 1, f: m => brl(m.shopee.lucro) },
      { t: 'Total faturamento', n: 1, f: m => `<b>${brl(m.ml.receita + m.shopee.receita)}</b>` }, { t: 'Total lucro', n: 1, f: m => `<b>${brl(m.ml.lucro + m.shopee.lucro)}</b>` }, { t: 'Margem', n: 1, f: m => pc((m.ml.receita + m.shopee.receita) ? (m.ml.lucro + m.shopee.lucro) / (m.ml.receita + m.shopee.receita) : 0) }], d.porMes.slice().reverse())}
    ${sect('Top produtos (os dois canais somados)', 'mesmo SKU nos dois canais é agrupado')}
    ${tbl([{ t: 'Produto', f: x => `<b>${skuLink(x.sku, esc(x.titulo))}</b><br><small style="color:var(--mut)">${esc(x.sku)}</small>` }, { t: 'Un.', n: 1, f: x => num(x.unidades) }, { t: 'ML', n: 1, f: x => brl(x.ml) }, { t: 'Shopee', n: 1, f: x => brl(x.shopee) }, { t: 'Faturamento', n: 1, f: x => brl(x.receita) }, { t: 'Lucro', n: 1, f: x => brl(x.lucro) }, { t: 'Margem', n: 1, f: x => mgPill(x.margem, x.semCusto) }], d.skus.slice(0, 15))}`;
    const dd = d.diario;
    mk('#cs1', { type: 'bar', data: { labels: dd.map(x => ddmm(x.dia)), datasets: [{ label: 'Mercado Livre', backgroundColor: '#3b82f6', stack: 'r', data: dd.map(x => x.ml) }, { label: 'Shopee', backgroundColor: '#ee4d2d', stack: 'r', data: dd.map(x => x.shopee) }] },
      options: { ...ch, interaction: { mode: 'index', intersect: false }, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } }, scales: { x: { ...ch.scales.x, stacked: true }, y: { ...ch.scales.y, stacked: true } } } });
  };

  // ═════════ DASHBOARD SHOPEE ═════════
  VIEWS.shopee = async function () {
    const D = await api('shopee/dash'), A = D.atual, P = D.anterior, cb = D.cobertura;
    const ticket = A.pedidos ? A.receita / A.pedidos : 0, ticketP = P.pedidos ? P.receita / P.pedidos : 0;
    const taxas = A.comissao, mg = A.margem, mgP = P.margem;
    const aviso = cb.pctReceitaSemCusto > 0.05 ? `<div class="box" style="margin-bottom:14px;border-color:#fde68a;background:#fffbeb">${ic('info', 14)} <b>${pc(cb.pctReceitaSemCusto, 0)} do faturamento está em ${num(cb.skusSemCusto)} SKU(s) sem custo cadastrado</b> — o lucro fica superestimado. O SKU é o da variação na Shopee (o mesmo da tela de Custos do Mercado Livre). <a class="lk" href="#custos">Cadastrar custos →</a></div>` : '';
    const estim = cb.pctReceitaEstimada > 0 ? `<div class="box" style="margin-bottom:14px">${ic('info', 14)} ${pc(cb.pctReceitaEstimada, 1)} do faturamento ainda não tem o repasse (escrow) e foi estimado pela taxa média da loja.</div>` : '';
    $('#view').innerHTML = aviso + estim + `<div class="kgrid">
      ${kpi('Faturamento', brl(A.receita), `vs período anterior ${dlt(dv(A.receita, P.receita))}`, 'lucro', 'blue')}
      ${kpi('Pedidos', num(A.pedidos), `anterior ${num(P.pedidos)} ${dlt(dv(A.pedidos, P.pedidos))}`, 'pedidos', 'purple')}
      ${kpi('Ticket médio', brl(ticket), `anterior ${brl(ticketP)} ${dlt(dv(ticket, ticketP))}`, 'dre', 'teal')}
      ${kpi('Lucro', brl(A.lucroFinal), `anterior ${brl(P.lucroFinal)} ${dlt(dv(A.lucroFinal, P.lucroFinal))}`, 'indicadores', A.lucroFinal >= 0 ? 'green' : 'red', A.lucroFinal >= 0 ? 'ok' : 'bad')}
      ${kpi('Margem', pc(mg, 1), `anterior ${pc(mgP, 1)} ${dpp(mg, mgP)}`, 'abc', 'green')}</div>
    <div class="kgrid">
      ${kpi('Comissão e taxas', brl(taxas), `${pc(A.receita ? taxas / A.receita : 0)} do faturamento (comissão + serviço + transação)`, 'dre', 'amber')}
      ${kpi('Frete (líquido)', brl(A.frete), `${pc(A.receita ? A.frete / A.receita : 0)} · já abatido o frete grátis pago pela Shopee`, 'envios', 'slate')}
      ${kpi('Devoluções', brl(A.devolucao), `${num(A.qtdDevolucoes)} devolução(ões) efetivada(s)`, 'devolucoes', 'red')}
      ${kpi('Gasto com Ads', brl(A.adsGasto), `${pc(A.receita ? A.adsGasto / A.receita : 0)} do faturamento (TACOS) · <a class="lk" href="#shopeeads">ver Ads</a>`, 'ads', 'pink')}
      ${kpi('Ajustes', brl(A.ajustes), 'vouchers do vendedor, compensações, retenções', 'info', 'amber')}
      ${kpi('Impostos', brl(A.imposto), 'Simples Nacional (DAS)', 'dre', 'slate')}
      ${kpi('Custo dos produtos', brl(A.custo), `${pc(A.receita ? A.custo / A.receita : 0)} do faturamento`, 'itens', 'purple')}</div>
    ${sect('Vendas diárias', 'faturamento e lucro por dia')}
    <div class="box"><div style="height:260px"><canvas id="sd1"></canvas></div></div>
    <div class="two"><div class="box"><div class="boxh"><h3>Comparação por conta</h3><small>atual × período anterior</small></div><div style="height:230px"><canvas id="sd2"></canvas></div></div>
      <div class="box"><div class="boxh"><h3>Pedidos por situação</h3></div><div style="height:230px"><canvas id="sd3"></canvas></div></div></div>
    <div class="two"><div class="box"><div class="boxh"><h3>${ic('trophy', 15)} Top 10 produtos</h3><small>por faturamento · <a class="lk" href="#shopeeprodutos">ver todos</a></small></div>
      ${tbl([{ t: 'Produto', f: x => `<b>${skuLink(x.sku, esc(x.titulo))}</b><br><small style="color:var(--mut)">${esc(x.sku)}</small>` }, { t: 'Un.', n: 1, f: x => num(x.unidades) }, { t: 'Faturamento', n: 1, f: x => brl(x.receita) }, { t: 'Lucro', n: 1, f: x => brl(x.lucro) }, { t: 'Margem', n: 1, f: x => mgPill(x.margem, x.semCusto) }], D.top)}</div>
      <div class="box"><div class="boxh"><h3>Margem abaixo de 20%</h3><small>vale revisar preço, frete ou custo</small></div>
      ${D.baixa.length ? tbl([{ t: 'Produto', f: x => `<b>${skuLink(x.sku, esc(x.titulo))}</b><br><small style="color:var(--mut)">${esc(x.sku)}</small>` }, { t: 'Faturamento', n: 1, f: x => brl(x.receita) }, { t: 'Margem', n: 1, f: x => mgPill(x.margem) }], D.baixa) : '<div class="empty"><b>Nenhum produto com margem baixa</b></div>'}</div></div>
    ${D.porMes.length ? sect('Por mês', 'resultado mensal por conta') + tbl([{ t: 'Mês', f: m => mesNome(m.mes) }, { t: 'Conta', f: m => spChip(m.loja) }, { t: 'Pedidos', n: 1, f: m => num(m.pedidos) }, { t: 'Faturamento', n: 1, f: m => brl(m.receita) }, { t: 'Comissão/taxas', n: 1, f: m => brl(m.comissao) },
      { t: 'Frete', n: 1, f: m => brl(m.frete) }, { t: 'Devoluções', n: 1, f: m => brl(m.devolucao) }, { t: 'Imposto', n: 1, f: m => brl(m.imposto) }, { t: 'Custo', n: 1, f: m => brl(m.custo) }, { t: 'Lucro', n: 1, f: m => `<b>${brl(m.lucro)}</b>` }, { t: 'Margem', n: 1, f: m => pc(m.receita ? m.lucro / m.receita : 0) }], D.porMes.slice().reverse()) : ''}`;
    const dd = D.diario, dias = [...new Set(dd.map(x => x.dia))].sort(), lj = [...new Set(dd.map(x => x.loja))];
    mk('#sd1', { type: 'bar', data: { labels: dias.map(ddmm), datasets: [...lj.map(l => ({ type: 'bar', label: NOMES_SP[l] || l, backgroundColor: COR_SP[l], stack: 'r', data: dias.map(x => dd.find(y => y.dia === x && y.loja === l)?.receita || 0) })),
      { type: 'line', label: 'Lucro', borderColor: '#16a34a', backgroundColor: '#16a34a', tension: .35, pointRadius: 0, borderWidth: 2, data: dias.map(x => dd.filter(y => y.dia === x).reduce((s, y) => s + y.lucro, 0)) }] },
      options: { ...ch, interaction: { mode: 'index', intersect: false }, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } }, scales: { x: { ...ch.scales.x, stacked: true }, y: { ...ch.scales.y, stacked: true } } } });
    mk('#sd2', { type: 'bar', data: { labels: D.porLoja.map(l => (NOMES_SP[l.loja] || l.loja).replace(' (Shopee)', '')), datasets: [{ label: 'Período anterior', backgroundColor: '#fed7aa', data: D.porLoja.map(l => l.prevReceita) }, { label: 'Período atual', backgroundColor: '#ee4d2d', data: D.porLoja.map(l => l.receita) }] },
      options: { ...ch, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } } } });
    const st = Object.entries(D.status).sort((a, b) => b[1] - a[1]);
    mk('#sd3', { type: 'doughnut', data: { labels: st.map(([k]) => SIT[k] || k), datasets: [{ data: st.map(([, v]) => v), backgroundColor: PAL, borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
  };

  // ═════════ PEDIDOS ═════════
  const SP = { sort: { k: 'data', d: -1 }, pg: 1, q: '', status: '' };
  VIEWS.shopeepedidos = async function () {
    const d = await api('shopee/pedidos', '&limit=1000'); const T = d.total;
    const statusOpts = [...new Set(d.lista.map(p => p.status))].sort();
    $('#view').innerHTML = `<div class="kgrid">${kpi('Pedidos', num(T.pedidos), 'no período (sem cancelados)', 'pedidos', 'purple')}${kpi('Faturamento', brl(T.receita), '', 'lucro', 'blue')}${kpi('Repasse líquido', brl(T.receita - T.comissao - T.frete - T.devolucao - T.ajustes), 'o que a Shopee repassa (escrow)', 'dre', 'teal')}${kpi('Lucro', brl(T.lucroFinal), `margem ${pc(T.margem, 1)}`, 'indicadores', T.lucroFinal >= 0 ? 'green' : 'red', T.lucroFinal >= 0 ? 'ok' : 'bad')}</div>
      <div class="box"><div class="boxh"><h3>Pedidos</h3><div style="display:flex;gap:8px;align-items:center"><input id="spq" class="di" placeholder="Buscar pedido, produto ou comprador" style="width:260px" value="${esc(SP.q)}"><select id="sps" class="di"><option value="">Todas as situações</option>${statusOpts.map(s => `<option value="${s}" ${SP.status === s ? 'selected' : ''}>${esc(SIT[s] || s)}</option>`).join('')}</select><button class="btn3" id="spx">Exportar CSV</button></div></div>
      <div class="tw" id="spt"></div><div class="pg" id="spp"></div></div>`;
    const cols = [['Data', 'data'], ['Pedido', 'id'], ['Conta', 'loja'], ['Situação', 'status'], ['Faturamento', 'receita', 1], ['Comissão/taxas', 'comissao', 1], ['Frete', 'frete', 1], ['Devolução', 'devolucao', 1], ['Imposto', 'imposto', 1], ['Custo', 'custo', 1], ['Lucro', 'lucro', 1], ['Margem', 'mg', 1]];
    const draw = () => {
      let l = d.lista.map(p => ({ ...p, mg: p.receita ? p.lucro / p.receita : 0 }));
      if (SP.status) l = l.filter(p => p.status === SP.status);
      if (SP.q) { const t = SP.q.toLowerCase(); l = l.filter(p => (p.id + ' ' + p.itens + ' ' + (p.comprador || '')).toLowerCase().includes(t)); }
      l = ordena(l, SP.sort); const por = 50, pg = Math.min(SP.pg, Math.max(Math.ceil(l.length / por), 1)), page = l.slice((pg - 1) * por, pg * por);
      $('#spt').innerHTML = `<table><thead><tr>${cols.map(c => thS(c[0], c[1], SP.sort, c[2] ? 'n' : '')).join('')}</tr></thead><tbody>${page.map(p => `<tr><td>${dt(p.data)}</td><td><a class="lk" target="_blank" rel="noopener" href="https://seller.shopee.com.br/portal/sale/order?keyword=${esc(p.id)}" title="Abrir na Shopee">${esc(p.id)}</a><br><small style="color:var(--mut)">${esc(p.itens.slice(0, 70))}</small></td><td>${spChip(p.loja)}</td><td>${sit(p.status)} ${flags(p)}</td>
        <td class="n">${brl(p.receita)}</td><td class="n">${neg(p.comissao)}</td><td class="n">${neg(p.frete)}</td><td class="n">${neg(p.devolucao)}</td><td class="n">${neg(p.imposto)}</td><td class="n">${p.custo ? neg(p.custo) : '—'}</td><td class="n"><b class="${p.lucro >= 0 ? 'ok' : 'bad'}">${brl(p.lucro)}</b></td><td class="n">${mgPill(p.mg, p.flags.includes('sem custo'))}</td></tr>`).join('')}</tbody></table>`;
      ligaSort('#spt', SP.sort, draw); pager($('#spp'), l.length, pg, por, p => { SP.pg = p; draw(); });
      $('#spx').onclick = () => csv('shopee-pedidos.csv', [['Data', r => r.data], ['Pedido', r => r.id], ['Conta', r => NOMES_SP[r.loja]], ['Situação', r => SIT[r.status] || r.status], ['Itens', r => r.itens], ['Faturamento', r => num2(r.receita)], ['Comissão e taxas', r => num2(r.comissao)], ['Frete', r => num2(r.frete)], ['Devolução', r => num2(r.devolucao)], ['Ajustes', r => num2(r.ajustes)], ['Imposto', r => num2(r.imposto)], ['Custo', r => num2(r.custo)], ['Lucro', r => num2(r.lucro)]], l);
    };
    $('#spq').oninput = debounce(() => { SP.q = $('#spq').value.trim(); SP.pg = 1; draw(); }); $('#sps').onchange = () => { SP.status = $('#sps').value; SP.pg = 1; draw(); };
    draw();
  };

  // ═════════ PRODUTOS ═════════
  const SK = { sort: { k: 'receita', d: -1 }, q: '' };
  VIEWS.shopeeprodutos = async function () {
    const d = await api('shopee/produtos'), cb = d.cobertura;
    $('#view').innerHTML = `<div class="kgrid">${kpi('SKUs vendidos', num(cb.skus), `${num(cb.skusSemCusto)} sem custo`, 'itens', 'purple')}${kpi('Faturamento', brl(d.total.receita), '', 'lucro', 'blue')}${kpi('Lucro', brl(d.total.lucroFinal), `margem ${pc(d.total.margem, 1)}`, 'indicadores', 'green')}${kpi('Receita sem custo', pc(cb.pctReceitaSemCusto, 0), 'cadastre os custos para o lucro ficar confiável', 'info', cb.pctReceitaSemCusto > .05 ? 'amber' : 'green')}</div>
      <div class="box"><div class="boxh"><h3>Produtos (por SKU/variação)</h3><input id="skq" class="di" placeholder="Buscar SKU ou título" style="width:260px"></div><div class="tw" id="skt"></div></div>`;
    const cols = [['Produto', 'titulo'], ['Un.', 'unidades', 1], ['Faturamento', 'receita', 1], ['Comissão/taxas', 'comissao', 1], ['Frete', 'frete', 1], ['Devolução', 'devolucao', 1], ['Imposto', 'imposto', 1], ['Custo unit.', 'custoUnit', 1], ['Lucro', 'lucro', 1], ['Margem', 'margem', 1]];
    const draw = () => {
      let l = d.skus; if (SK.q) { const t = SK.q.toLowerCase(); l = l.filter(s => (s.sku + ' ' + s.titulo).toLowerCase().includes(t)); }
      l = ordena(l, SK.sort).slice(0, 400);
      $('#skt').innerHTML = `<table><thead><tr>${cols.map(c => thS(c[0], c[1], SK.sort, c[2] ? 'n' : '')).join('')}</tr></thead><tbody>${l.map(s => `<tr><td><b>${skuLink(s.sku, esc(s.titulo))}</b><br><small style="color:var(--mut)">${esc(s.sku)}</small></td><td class="n">${num(s.unidades)}</td><td class="n">${brl(s.receita)}</td><td class="n">${neg(s.comissao)}</td><td class="n">${neg(s.frete)}</td><td class="n">${neg(s.devolucao)}</td><td class="n">${neg(s.imposto)}</td><td class="n">${s.custoUnit == null ? '—' : brl(s.custoUnit)}</td><td class="n"><b>${brl(s.lucro)}</b></td><td class="n">${mgPill(s.margem, s.semCusto)}</td></tr>`).join('')}</tbody></table>`;
      ligaSort('#skt', SK.sort, draw);
    };
    $('#skq').oninput = debounce(() => { SK.q = $('#skq').value.trim(); draw(); }); draw();
  };

  // ═════════ DEVOLUÇÕES ═════════
  VIEWS.shopeedev = async function () {
    const d = await api('shopee/devolucoes'), ef = d.lista.filter(x => x.efetiva), tot = ef.reduce((s, x) => s + x.reembolsado, 0);
    const motivos = {}; for (const x of d.lista) { const m = motivos[x.motivo] ||= { nome: MOTIVO[x.motivo] || x.motivo, n: 0 }; m.n++; }
    const ml = Object.values(motivos).sort((a, b) => b.n - a.n);
    $('#view').innerHTML = `<div class="kgrid">${kpi('Devoluções', num(d.lista.length), `${num(ef.length)} efetivadas`, 'devolucoes', 'red')}${kpi('Valor reembolsado', brl(tot), 'devoluções efetivadas (aceitas)', 'dre', 'amber')}${kpi('Taxa de devolução', pc(d.total.pedidos ? ef.length / d.total.pedidos : 0), `sobre ${num(d.total.pedidos)} pedidos`, 'indicadores', 'slate')}</div>
      <div class="two"><div class="box"><div class="boxh"><h3>Por motivo</h3></div><div style="height:240px"><canvas id="sdm"></canvas></div></div>
      <div class="box"><div class="boxh"><h3>Produtos mais devolvidos</h3></div>${d.porSku.length ? tbl([{ t: 'Produto', f: x => `<b>${skuLink(x.sku, esc(x.titulo))}</b><br><small style="color:var(--mut)">${esc(x.sku)}</small>` }, { t: 'Devol.', n: 1, f: x => num(x.devolucoes) }, { t: 'Valor', n: 1, f: x => brl(x.valor) }], d.porSku.slice(0, 10)) : '<div class="empty"><b>Sem devoluções efetivadas</b></div>'}</div></div>
      <div class="box"><div class="boxh"><h3>Lista</h3></div>${tbl([{ t: 'Data', f: x => dt(x.data) }, { t: 'Devolução', f: x => esc(x.id) }, { t: 'Pedido', f: x => esc(x.pedido) }, { t: 'Conta', f: x => spChip(x.loja) }, { t: 'Motivo', f: x => esc(MOTIVO[x.motivo] || x.motivo) }, { t: 'Situação', f: x => `<span class="tag ${x.efetiva ? 'warn' : ''}">${esc(x.status)}</span>` }, { t: 'Itens', f: x => `<small>${esc(x.itens)}</small>` }, { t: 'Reembolso', n: 1, f: x => brl(x.reembolsado) }], d.lista)}</div>`;
    if (ml.length) mk('#sdm', { type: 'doughnut', data: { labels: ml.map(m => m.nome), datasets: [{ data: ml.map(m => m.n), backgroundColor: PAL, borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
  };

  // ═════════ ADS ═════════
  VIEWS.shopeeads = async function () {
    const d = await api('shopee/ads'), T = d.total;
    $('#view').innerHTML = `<div class="kgrid">${kpi('Gasto com Ads', brl(T.gasto), `${pc(T.tacos)} do faturamento (TACOS)`, 'ads', 'pink')}${kpi('Vendas por Ads (GMV)', brl(T.gmv), `${num(T.pedidos)} pedidos · ${num(T.itens)} itens`, 'lucro', 'blue')}${kpi('ROAS', T.roas.toFixed(1).replace('.', ',') + 'x', `ACOS ${pc(T.acos)}`, 'indicadores', T.roas >= 5 ? 'green' : 'amber')}${kpi('Cliques', num(T.cliques), `CTR ${pc(T.ctr, 2)} · CPC ${brl(T.cpc)}`, 'campanhas', 'purple')}${kpi('Saldo de Ads', brl(d.saldo.reduce((s, x) => s + x.saldo, 0)), d.saldo.map(x => `${esc(x.nome.replace(' (Shopee)', ''))}: ${brl(x.saldo)}`).join(' · '), 'dre', 'teal')}</div>
      ${d.serie.length ? `<div class="box"><div class="boxh"><h3>Gasto e vendas por dia</h3><small>gasto × GMV gerado pelos anúncios</small></div><div style="height:260px"><canvas id="sa1"></canvas></div></div>` : '<div class="box"><div class="empty"><b>Sem gasto com Ads no período</b></div></div>'}
      <div class="box" style="margin-top:14px">${ic('info', 14)} A API da Shopee só informa o gasto <b>da loja inteira</b> por dia (as campanhas ativas não vêm por anúncio). Por isso o gasto é rateado entre os pedidos do dia, pelo faturamento, no cálculo do lucro. As ${num(d.campanhasAntigas)} campanhas antigas (encerradas) aparecem só no histórico.</div>
      ${d.serie.length ? sect('Por dia') + tbl([{ t: 'Dia', f: x => ddmm(x.dia) }, { t: 'Gasto', n: 1, f: x => brl(x.gasto) }, { t: 'GMV', n: 1, f: x => brl(x.gmv) }, { t: 'ROAS', n: 1, f: x => x.roas ? x.roas.toFixed(1).replace('.', ',') + 'x' : '—' }, { t: 'Pedidos', n: 1, f: x => num(x.pedidos) }, { t: 'Cliques', n: 1, f: x => num(x.cliques) }, { t: 'Impressões', n: 1, f: x => num(x.impressoes) }], d.serie.slice().reverse()) : ''}`;
    if (d.serie.length) mk('#sa1', { type: 'bar', data: { labels: d.serie.map(x => ddmm(x.dia)), datasets: [{ type: 'line', label: 'GMV (vendas por Ads)', borderColor: '#2563eb', tension: .35, pointRadius: 0, data: d.serie.map(x => x.gmv) }, { label: 'Gasto', backgroundColor: '#ec4899', data: d.serie.map(x => x.gasto) }] },
      options: { ...ch, interaction: { mode: 'index', intersect: false }, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } } } });
  };

  // ═════════ ANÚNCIOS / ESTOQUE ═════════
  const AN = { sort: { k: 'receita90', d: -1 }, q: '', f: '' };
  VIEWS.shopeeanuncios = async function () {
    const d = await api('shopee/anuncios'), L = d.lista;
    const ativos = L.filter(x => x.status === 'NORMAL'), rup = ativos.filter(x => x.estoque === 0), baixo = ativos.filter(x => x.cobertura != null && x.cobertura < 15 && x.estoque > 0), parado = ativos.filter(x => !x.unidades90);
    $('#view').innerHTML = `<div class="kgrid">${kpi('Anúncios / variações', num(L.length), `${num(ativos.length)} ativas`, 'itens', 'purple')}${kpi('Sem estoque', num(rup.length), 'variações ativas zeradas', 'estoque', rup.length ? 'red' : 'green', rup.length ? 'bad' : '')}${kpi('Estoque para < 15 dias', num(baixo.length), 'pelo giro dos últimos 90 dias', 'estoque', baixo.length ? 'amber' : 'green')}${kpi('Sem vendas em 90 dias', num(parado.length), 'variações ativas paradas', 'info', 'slate')}</div>
      <div class="box"><div class="boxh"><h3>Catálogo</h3><div style="display:flex;gap:8px"><input id="anq" class="di" placeholder="Buscar SKU ou título" style="width:240px"><select id="anf" class="di"><option value="">Todos</option><option value="rup">Sem estoque</option><option value="baixo">Estoque &lt; 15 dias</option><option value="parado">Sem vendas (90d)</option></select></div></div><div class="tw" id="ant"></div></div>`;
    const cols = [['Anúncio', 'titulo'], ['Conta', 'loja'], ['Situação', 'status'], ['Preço', 'preco', 1], ['Estoque', 'estoque', 1], ['Cobertura', 'cobertura', 1], ['Un. 90d', 'unidades90', 1], ['Faturamento 90d', 'receita90', 1], ['Lucro 90d', 'lucro90', 1], ['Margem', 'margem', 1]];
    const draw = () => {
      let l = L; if (AN.q) { const t = AN.q.toLowerCase(); l = l.filter(x => (x.sku + ' ' + x.titulo + ' ' + x.variacao).toLowerCase().includes(t)); }
      if (AN.f === 'rup') l = l.filter(x => x.status === 'NORMAL' && x.estoque === 0); else if (AN.f === 'baixo') l = l.filter(x => x.status === 'NORMAL' && x.cobertura != null && x.cobertura < 15 && x.estoque > 0); else if (AN.f === 'parado') l = l.filter(x => x.status === 'NORMAL' && !x.unidades90);
      l = ordena(l, AN.sort).slice(0, 500);
      $('#ant').innerHTML = `<table><thead><tr>${cols.map(c => thS(c[0], c[1], AN.sort, c[2] ? 'n' : '')).join('')}</tr></thead><tbody>${l.map(x => `<tr><td><div class="pr">${thumb(x.thumb)}<div><b>${skuLink(x.sku, esc(x.titulo))}</b><small>${esc(x.variacao ? x.variacao + ' · ' : '')}${esc(x.sku)}</small></div></div></td><td>${spChip(x.loja)}</td><td>${x.status === 'NORMAL' ? '<span class="tag ok">Ativo</span>' : `<span class="tag warn">${esc(x.status)}</span>`}</td><td class="n">${x.preco == null ? '—' : brl(x.preco)}</td><td class="n ${x.estoque === 0 ? 'bad' : ''}">${x.estoque == null ? '—' : num(x.estoque)}</td><td class="n">${x.cobertura == null ? '—' : Math.round(x.cobertura) + ' d'}</td><td class="n">${num(x.unidades90)}</td><td class="n">${brl(x.receita90)}</td><td class="n">${x.unidades90 ? brl(x.lucro90) : '—'}</td><td class="n">${x.margem == null ? '—' : mgPill(x.margem, x.semCusto)}</td></tr>`).join('')}</tbody></table>`;
      ligaSort('#ant', AN.sort, draw);
    };
    $('#anq').oninput = debounce(() => { AN.q = $('#anq').value.trim(); draw(); }); $('#anf').onchange = () => { AN.f = $('#anf').value; draw(); }; draw();
  };

  // ═════════ PROMOÇÕES ═════════
  VIEWS.shopeepromo = async function () {
    const d = await api('shopee/promocoes'), T = { discount: 'Desconto', voucher: 'Cupom', addon: 'Combo' }, S = { ongoing: 'Em andamento', upcoming: 'Programada', expired: 'Encerrada' };
    const dd = ts => ts ? new Date(ts * 1000).toLocaleDateString('pt-BR') : '—';
    $('#view').innerHTML = `<div class="kgrid">${kpi('Em andamento', num(d.lista.filter(x => x.status === 'ongoing').length), 'descontos, cupons e combos', 'promocoes', 'green')}${kpi('Programadas', num(d.lista.filter(x => x.status === 'upcoming').length), '', 'cal', 'blue')}${kpi('Encerradas', num(d.lista.filter(x => x.status === 'expired').length), '', 'info', 'slate')}</div>
      <div class="box">${d.lista.length ? tbl([{ t: 'Tipo', f: x => T[x.tipo] || x.tipo }, { t: 'Nome', f: x => esc(x.titulo) }, { t: 'Conta', f: x => spChip(x.loja) }, { t: 'Situação', f: x => `<span class="tag ${x.status === 'ongoing' ? 'ok' : ''}">${S[x.status] || x.status}</span>` }, { t: 'Início', f: x => dd(x.inicio) }, { t: 'Fim', f: x => dd(x.fim) }], d.lista) : '<div class="empty"><b>Nenhuma promoção, cupom ou combo encontrado</b>A Shopee não retornou campanhas para as duas contas.</div>'}</div>
      <p class="dica" style="margin-top:10px">Somente leitura. Campanhas relâmpago e a aplicação de descontos pela API ficam para uma etapa futura.</p>`;
  };
})();
