// Nexus Metrics › Meu negócio: Visão do dia, Projete suas vendas, Suas categorias, Performance de vendas, Seus clientes, Otimize seus anúncios e Crescimento.
// Carregado depois de jodda.js (reaproveita $, api, brl, num, pc, dlt, dv, kpi, sect, thumb, thS, ordena, ligaSort, pager, csv, num2, debounce, tileMap, hbarCfg,
// donut, PAL, mk, ch, mesNome, lojaTxt, mlUrl, skuLink, esc, ic, GRUPOS, ICO, SUB, NOTA, PERIODO, VIEWS).
(() => {
  ICO.metrics = '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/><circle cx="19" cy="7" r="1.5"/>';
  ICO.nmdia = ICO.cal; ICO.nmprojecao = ICO.rocket; ICO.nmcategorias = ICO.catalogo; ICO.nmanuncios = ICO.abc; ICO.nmclientes = ICO.reputacao || ICO.pedidos;
  ICO.nmotimiza = ICO.bulb; ICO.nmcrescimento = ICO.indicadores;
  ICO.nmbuscas = ICO.search; ICO.nmmaisvendidos = ICO.trophy;
  const tabs = [['nmbuscas', 'Top buscas'], ['nmmaisvendidos', 'Mais vendidos'], ['nmdia', 'Visão do dia'], ['nmprojecao', 'Projete suas vendas'], ['nmcategorias', 'Suas categorias'], ['nmanuncios', 'Performance de vendas'], ['nmclientes', 'Seus clientes'], ['nmotimiza', 'Otimize seus anúncios'], ['nmcrescimento', 'Crescimento']];
  if (!GRUPOS.some(g => g.n === 'Nexus Metrics')) {
    const i = GRUPOS.findIndex(g => g.n === 'Configurações');
    GRUPOS.splice(i < 0 ? GRUPOS.length : i, 0, { n: 'Nexus Metrics', ico: 'metrics', tabs });
  }
  Object.assign(SUB, {
    nmbuscas: 'O que mais se busca no Mercado Livre e nas suas categorias, e se você tem anúncio para cada busca', nmmaisvendidos: 'Os 20 mais vendidos de cada categoria em que você vende, e onde você está',
    nmdia: 'Como estão as vendas de hoje comparadas com o seu ritmo normal', nmprojecao: 'Para onde o mês está indo e de onde vem o faturamento',
    nmcategorias: 'Seu desempenho e peso em cada categoria em que você vende', nmanuncios: 'Os anúncios que movem o seu faturamento (e os que não vendem)',
    nmclientes: 'Quem compra de você, quanto e com que frequência', nmotimiza: 'Qualidade dos anúncios segundo o ML, priorizada pelo peso de cada um nas vendas',
    nmcrescimento: 'Evolução do seu negócio mês a mês',
  });
  Object.assign(PERIODO, { nmcategorias: 1, nmanuncios: 1, nmclientes: 1 });
  Object.assign(NOTA, { nmbuscas: 'Ranking do ML de hoje · categoria escolhida na própria tela', nmmaisvendidos: 'Top 20 do ML de hoje · categoria escolhida na própria tela', nmdia: 'Hoje vs. média dos últimos 30 dias', nmprojecao: 'Mês escolhido na própria tela', nmotimiza: 'Anúncios ativos · vendas e visitas dos últimos 30 dias', nmcrescimento: 'Últimos 13 meses' });

  // ───────── helpers ─────────
  const tags = x => [x.catalogo ? '<span class="sg b">catálogo</span>' : '', x.tipo ? `<span class="sg n">${esc(x.tipo)}</span>` : '', x.lg ? `<span class="sg ${x.lg === 'Full' ? 'g' : x.lg === 'Flex' ? 'a' : 'n'}">${esc(x.lg)}</span>` : ''].join(' ');
  const prod = x => `<div class="pr">${thumb(x.thumb)}<div><b title="${esc(x.titulo)}">${skuLink(x.sku, esc(x.titulo))}</b><small><a class="lk" target="_blank" rel="noopener" href="${mlUrl('item', x.item)}">${esc(x.item)}</a> · ${esc(lojaTxt(x.loja))}</small><div style="margin-top:3px">${tags(x)}</div></div></div>`;
  const semVis = t => t ? '' : '<div class="note">Ainda não há visitas coletadas: conversão e visitas aparecem depois da próxima coleta de anúncios (a cada hora).</div>';
  const conv = v => v == null ? '—' : pc(v, 2);
  const minutos = m => m == null || !isFinite(m) ? '—' : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1).replace('.', ',')} h` : `${(m / 1440).toFixed(1).replace('.', ',')} dias`;
  const tipBrl = { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } };
  const linhaAcum = (id, curva, labA, labP) => mk(id, { type: 'line', data: { labels: Array.from({ length: Math.max(curva.anterior.length, curva.atual.length) }, (_, i) => String(i + 1)),
    datasets: [{ label: labA, data: curva.atual, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.10)', fill: true, tension: .25, pointRadius: 2 },
      { label: labP, data: curva.anterior, borderColor: '#94a3b8', borderDash: [5, 4], tension: .25, pointRadius: 0 }] },
    options: { ...ch, plugins: { ...ch.plugins, ...tipBrl }, scales: { x: { ...ch.scales.x, title: { display: true, text: 'dia do mês' } }, y: { ...ch.scales.y, ticks: { ...ch.scales.y.ticks, callback: v => num(v) } } } } });
  const rosca = (id, lista) => mk(id, { type: 'doughnut', data: { labels: lista.map(x => x.nome), datasets: [{ data: lista.map(x => x.receita), backgroundColor: PAL, borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
  const filtros = (id, html) => `<div class="fgrid" id="${id}">${html}</div>`;

  // ═════════ MERCADO: helpers ═════════
  const mov = x => x.novo ? '<span class="sg g">novo</span>' : x.delta == null ? '<span style="color:var(--mut)">—</span>' : x.delta > 0 ? `<span class="dl up">▲ ${x.delta}</span>` : x.delta < 0 ? `<span class="dl dn">▼ ${-x.delta}</span>` : '<span style="color:var(--mut)">=</span>';
  const seletorCat = (cats, atual, todas) => `<label style="min-width:260px">Categoria<select id="ncat">${todas ? `<option value="">${esc(todas)}</option>` : ''}${cats.map(c => `<option value="${esc(c.id)}" ${c.id === atual ? 'selected' : ''}>${esc(c.nome)}${c.meus ? ` · ${c.meus} seu(s) no top` : ''} — ${esc(c.raiz)}</option>`).join('')}</select></label>`;
  const semHist = (d, oque) => d.diaAnterior ? '' : `<div class="note">O ML informa só a posição de hoje. A comparação com o dia anterior (▲ subiu, ▼ caiu, novo) aparece a partir da próxima coleta diária, quando o Nexus tiver a 2ª foto do ${oque}.</div>`;

  // ═════════ TOP BUSCAS ═════════
  VIEWS.nmbuscas = async function (arg) {
    const d = await api('nm/buscas', `&cat=${encodeURIComponent(arg || '')}`), f = { sem: false };
    const semAnuncio = d.lista.filter(x => !x.anuncios).length, subiram = d.lista.filter(x => x.delta > 0).length, novas = d.lista.filter(x => x.novo).length;
    const linha = (x, hist) => `<tr><td class="n"><b>${hist ? Math.round(x.media) : x.pos}º</b></td><td><a class="lk" target="_blank" rel="noopener" href="${esc(x.url)}">${esc(x.keyword)}</a></td>
      ${hist ? `<td class="n">${num(x.dias)} de ${num(d.fotos)}</td><td class="n">${x.melhor}º</td>` : `<td class="c">${mov(x)}</td>`}
      <td class="c">${x.anuncios ? `<span class="sg g">${num(x.anuncios)} anúncio(s)</span>` : '<span class="sg r">sem anúncio seu</span>'}</td></tr>`;
    $('#view').innerHTML = `<div class="box" style="padding:10px 14px">${filtros('nbf', seletorCat(d.categorias, d.cat, 'Todo o Mercado Livre'))}</div>
      ${semHist(d, 'ranking de buscas')}
      <div class="kgrid">${kpi('Buscas no ranking', num(d.lista.length), esc(d.nome), 'search', 'blue')}
        ${kpi('Sem anúncio seu', num(semAnuncio), 'nenhum título seu tem todas as palavras da busca', 'alertas', semAnuncio ? 'red' : 'green')}
        ${kpi('Subiram', d.diaAnterior ? num(subiram) : '—', d.diaAnterior ? `desde ${ddmm(d.diaAnterior)}` : 'aguardando a 2ª foto', 'rocket', 'green')}
        ${kpi('Entraram no ranking', d.diaAnterior ? num(novas) : '—', d.diaAnterior ? `desde ${ddmm(d.diaAnterior)}` : 'aguardando a 2ª foto', 'bulb', 'amber')}</div>
      <div class="two"><div class="box"><div class="boxh"><h3>Ranking de hoje <small>${d.dia ? ddmm(d.dia) : ''}</small></h3><label style="flex-direction:row;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="nbs"> só as sem anúncio seu</label></div>
          <div class="tw" style="max-height:none"><table class="rt"><thead><tr><th class="n">#</th><th>Busca</th><th class="c">Movimento</th><th class="c">Você tem?</th></tr></thead><tbody id="nbt"></tbody></table></div></div>
        <div class="box"><h3>Ranking do período <small>buscas que mais apareceram nos últimos 30 dias · ${num(d.fotos)} foto(s)</small></h3>
          <div class="tw" style="max-height:none"><table class="rt"><thead><tr><th class="n">Posição média</th><th>Busca</th><th class="n">Dias no ranking</th><th class="n">Melhor</th><th class="c">Você tem?</th></tr></thead><tbody>${d.periodo.map(x => linha(x, true)).join('') || '<tr><td colspan="5" class="empty">Sem fotos ainda.</td></tr>'}</tbody></table></div></div></div>
      <p style="color:var(--mut);font-size:12px">O Mercado Livre não informa quantas vezes cada termo foi buscado, só a ordem. "Você tem?" compara as palavras da busca com os títulos dos seus anúncios ativos.</p>`;
    const draw = () => { $('#nbt').innerHTML = d.lista.filter(x => !f.sem || !x.anuncios).map(x => linha(x, false)).join('') || '<tr><td colspan="4" class="empty">Nada por aqui.</td></tr>'; };
    $('#nbs').onchange = () => { f.sem = $('#nbs').checked; draw(); };
    $('#ncat').onchange = () => { location.hash = 'nmbuscas:' + encodeURIComponent($('#ncat').value); };
    draw();
  };

  // ═════════ MAIS VENDIDOS ═════════
  VIEWS.nmmaisvendidos = async function (arg) {
    const d = await api('nm/maisvendidos', `&cat=${encodeURIComponent(arg || '')}`);
    if (!d.categorias.length) { $('#view').innerHTML = '<div class="box empty"><b>Ainda não há mais vendidos coletados.</b>A coleta diária busca o top 20 de cada categoria em que você tem anúncio.</div>'; return; }
    const meus = d.lista.filter(x => x.meu), semDet = d.lista.filter(x => !x.detalhe).length;
    $('#view').innerHTML = `<div class="box" style="padding:10px 14px">${filtros('nmf', seletorCat(d.categorias, d.cat))}</div>
      ${semHist(d, 'top 20')}${semDet ? `<div class="note">${num(semDet)} item(ns) ainda sem nome e foto: os detalhes chegam na próxima coleta diária (ou o ML não libera os dados desse anúncio).</div>` : ''}
      <div class="kgrid">${kpi('Seus no top 20', num(meus.length), meus.length ? `melhor posição: ${Math.min(...meus.map(x => x.pos))}º` : 'nenhum anúncio seu nesta categoria', 'trophy', meus.length ? 'green' : 'slate')}
        ${kpi('Categorias com você no top', num(d.categorias.filter(c => c.meus).length), `de ${num(d.categorias.length)} categorias monitoradas`, 'catalogo', 'blue')}
        ${kpi('Preço do top 20', (() => { const p = d.lista.map(x => x.preco).filter(v => v != null).sort((a, b) => a - b); return p.length ? `${brl(p[0])} a ${brl(p.at(-1))}` : '—'; })(), 'preço do ganhador no catálogo', 'custos', 'amber')}</div>
      <div class="box"><h3>Top 20 de hoje <small>${esc(d.nome || '')} · ${d.dia ? ddmm(d.dia) : ''}</small></h3>
        <div class="tw" style="max-height:none"><table class="rt"><thead><tr><th class="n">#</th><th>Produto</th><th class="c">Movimento</th><th>Tipo</th><th class="n">Preço</th><th class="c">Você</th></tr></thead><tbody>
        ${d.lista.map(x => `<tr${x.meu ? ' style="background:#f0fdf4"' : ''}><td class="n"><b>${x.pos}º</b></td><td><div class="pr">${thumb(x.thumb)}<div><b>${x.link ? `<a class="lk" target="_blank" rel="noopener" href="${esc(x.link)}">${esc(x.nome || x.id)}</a>` : esc(x.nome || x.id)}</b><small>${esc(x.id)}</small></div></div></td>
          <td class="c">${mov(x)}</td><td><span class="sg ${x.tipo === 'Catálogo' ? 'b' : 'n'}">${esc(x.tipo)}</span></td><td class="n">${x.preco == null ? '—' : brl(x.preco)}</td>
          <td class="c">${x.meu ? `<span class="sg g">seu</span>${x.ganhaBuyBox ? ' <span class="sg g">ganha o buy box</span>' : ''}` : ''}</td></tr>`).join('')}</tbody></table></div></div>
      <p style="color:var(--mut);font-size:12px">O Mercado Livre informa a posição de cada produto, não quantas unidades ele vendeu.</p>`;
    $('#ncat').onchange = () => { location.hash = 'nmmaisvendidos:' + encodeURIComponent($('#ncat').value); };
  };

  // ═════════ VISÃO DO DIA ═════════
  VIEWS.nmdia = async function () {
    const d = await api('nm/dia'), H = d.hojeT, M = d.media30, T = d.mesT, A = d.anteriorAteHoje, mpN = mesNome(d.mesAnterior);
    const mix = s => `catálogo ${pc(s.pctCatalogo, 0)} · Full ${pc(s.pctFull, 0)} · Flex ${pc(s.pctFlex, 0)}`;
    const resp = d.resposta.map(r => r.total?.response_time ?? r.response_time).filter(v => v != null), rt = resp.length ? Math.max(...resp) : null;
    const met = k => { const v = d.reputacao.map(r => r.metrics?.[k]?.rate).filter(v => v != null); return v.length ? Math.max(...v) : null; };
    $('#view').innerHTML = `${semVis(d.temVisitas)}
      <div class="kgrid">${kpi('Vendas de hoje', brl(H.receita), `média 30 dias ${brl(M.receita)} ${dlt(dv(H.receita, M.receita))}<br>${mix(H)}`, 'lucro', 'blue')}
        ${kpi(`Vendas do mês (${mesNome(d.mes)})`, brl(T.receita), `até o dia ${d.dia} de ${mpN}: ${brl(A.receita)} ${dlt(dv(T.receita, A.receita))}<br>${mpN} inteiro: ${brl(d.anteriorT.receita)} · ${mix(T)}`, 'cal', 'green')}</div>
      <div class="kgrid">${kpi('Pedidos hoje', num(H.pedidos), `média 30 dias ${num2(M.pedidos)} ${dlt(dv(H.pedidos, M.pedidos))}`, 'pedidos', 'purple')}
        ${kpi('Unidades hoje', num(H.unidades), `média 30 dias ${num2(M.unidades)} ${dlt(dv(H.unidades, M.unidades))}`, 'itens', 'teal')}
        ${kpi('Visitas hoje', d.temVisitas ? num(H.visitas) : '—', d.temVisitas ? `média 30 dias ${num(Math.round(M.visitas))} ${dlt(dv(H.visitas, M.visitas))}<br>a contagem do ML chega com atraso de algumas horas` : 'sem visitas coletadas', 'search', 'amber')}
        ${kpi('Cancelado hoje', brl(H.cancelado), `média 30 dias ${brl(M.cancelado)}`, 'cancel', 'red')}</div>
      <div class="kgrid">${kpi('Frete médio pago por você', brl(T.freteMedio), `por pedido com frete no mês · ${num(T.comFrete)} pedidos`, 'envios', 'slate')}
        ${kpi('Frete total do mês', brl(T.frete), `${pc(T.receita ? T.frete / T.receita : 0)} do faturamento do mês`, 'envios', 'pink')}
        ${kpi('Perguntas a responder', num(d.perguntas), `<a class="lk" href="#atendimento">abrir atendimento</a>`, 'atendimento', d.perguntas ? 'red' : 'green')}
        ${kpi('Tempo de resposta', minutos(rt), 'média informada pelo ML (pior conta)', 'atendimento', 'blue')}
        ${kpi('Reclamações', pc(met('claims'), 2), `atrasos no envio ${pc(met('delayed_handling_time'), 2)} · cancelamentos ${pc(met('cancellations'), 2)}`, 'reputacao', 'amber')}</div>
      <div class="box"><h3>Vendas acumuladas no mês <small>${mesNome(d.mes)} vs ${mpN}</small></h3><div style="height:300px"><canvas id="nd1"></canvas></div></div>`;
    linhaAcum('#nd1', d.curva, mesNome(d.mes), mpN);
  };

  // ═════════ PROJETE SUAS VENDAS ═════════
  VIEWS.nmprojecao = async function () {
    const hj = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
    $('#view').innerHTML = `<div class="box" style="padding:10px 14px">${filtros('npf', `<label>Mês<input type="month" id="npm" value="${hj}" max="${hj}"></label>`)}</div><div id="npv"><p style="color:var(--mut)">Carregando…</p></div>`;
    const load = async () => {
      charts.forEach(c => c.destroy()); charts = [];
      const d = await api('nm/projecao', `&mes=${$('#npm').value}`), T = d.atual_, A = d.anterior, mN = mesNome(d.mes), mpN = mesNome(d.mesAnterior);
      $('#npv').innerHTML = `${semVis(d.temVisitas)}
        <div class="kgrid">${kpi('Vendas', brl(T.receita), `${mpN}: ${brl(A.receita)} ${d.atual ? '' : dlt(dv(T.receita, A.receita))}`, 'lucro', 'blue')}
          ${kpi('Pedidos', num(T.pedidos), `${mpN}: ${num(A.pedidos)} · ${num(T.unidades)} unidades`, 'pedidos', 'purple')}
          ${kpi('Vendas em catálogo', pc(T.pctCatalogo, 0), `${brl(T.catalogo)} · ${num(T.unCatalogo)} unidades`, 'catalogo', 'teal')}
          ${kpi(d.atual ? 'Projeção do mês' : 'Total do mês', d.projecao == null ? '—' : brl(d.projecao), d.atual ? (d.projecao == null ? 'disponível a partir do dia 2' : `no ritmo de ${d.dia} de ${d.diasMes} dias ${dlt(dv(d.projecao, A.receita))} vs ${mpN}`) : `${d.diasMes} dias`, 'rocket', 'green')}</div>
        <div class="kgrid">${kpi('Ticket médio', brl(T.ticket), `${mpN}: ${brl(A.ticket)} ${dlt(dv(T.ticket, A.ticket))}`, 'dre', 'amber')}
          ${kpi('Conversão', conv(d.conversao), d.temVisitas ? `unidades ÷ visitas · ${num(d.visitas)} visitas` : 'sem visitas coletadas', 'promocoes', 'pink')}
          ${kpi('Frete médio pago por você', brl(T.freteMedio), `por pedido com frete · ${mpN}: ${brl(A.freteMedio)}`, 'envios', 'slate')}
          ${kpi('Frete total', brl(T.frete), `${pc(T.receita ? T.frete / T.receita : 0)} das vendas`, 'envios', 'red')}</div>
        <div class="box"><h3>Vendas acumuladas <small>${mN} vs ${mpN}</small></h3><div style="height:280px"><canvas id="np1"></canvas></div></div>
        <div class="two"><div class="box"><h3>Por categoria</h3><div style="height:230px"><canvas id="np2"></canvas></div></div><div class="box"><h3>Por tipo de anúncio</h3><div style="height:230px"><canvas id="np3"></canvas></div></div></div>
        <div class="two"><div class="box"><h3>Por tipo de envio</h3><div style="height:230px"><canvas id="np4"></canvas></div></div><div class="box"><h3>Catálogo</h3><div style="height:230px"><canvas id="np5"></canvas></div></div></div>
        <div class="two"><div class="box"><h3>Regra 80/20</h3><p style="font-size:15px;margin:18px 0 6px"><b>${num(d.pareto.top)}</b> anúncio(s) geram <b>80%</b> das vendas</p><p style="color:var(--mut);margin:0">os outros <b>${num(d.pareto.resto)}</b> geram os 20% restantes · <a class="lk" href="#nmanuncios">ver na Performance de vendas</a></p></div>
          <div class="box"><h3>Compradores por estado <small>pedidos com envio coletado</small></h3>${d.estados.length ? tileMap(d.estados) : '<p class="empty">Sem dados de envio no mês.</p>'}</div></div>
        <div class="two"><div class="box"><h3>Vendas R$ · últimos 12 meses</h3><div style="height:230px"><canvas id="np6"></canvas></div></div><div class="box"><h3>Unidades · últimos 12 meses</h3><div style="height:230px"><canvas id="np7"></canvas></div></div></div>`;
      linhaAcum('#np1', d.curva, mN, mpN);
      rosca('#np2', d.categorias.slice(0, 10)); rosca('#np3', d.exposicao); rosca('#np4', d.logistica); rosca('#np5', d.catalogo);
      const lab = d.meses.map(x => mesNome(x.mes));
      mk('#np6', { type: 'bar', data: { labels: lab, datasets: [{ label: 'Vendas', data: d.meses.map(x => x.receita), backgroundColor: '#3b82f6' }] }, options: { ...ch, plugins: { legend: { display: false }, ...tipBrl } } });
      mk('#np7', { type: 'bar', data: { labels: lab, datasets: [{ label: 'Unidades', data: d.meses.map(x => x.unidades), backgroundColor: '#8b5cf6' }] }, options: { ...ch, plugins: { legend: { display: false } } } });
    };
    $('#npm').onchange = load; await load();
  };

  // ═════════ SUAS CATEGORIAS ═════════
  VIEWS.nmcategorias = async function () {
    const R = await api('nm/categorias'), all = R.linhas, st = { k: 'receita', d: -1 }, f = { q: '', top: false };
    const maior = all[0];
    $('#view').innerHTML = `${semVis(R.temVisitas)}
      <div class="kgrid">${kpi('Categorias com venda', num(all.filter(x => x.receita > 0).length), 'categorias-folha do ML', 'catalogo', 'blue')}
        ${kpi('Geram 80% das vendas', num(R.nTop80), `de ${num(all.length)} categorias`, 'abc', 'purple')}
        ${kpi('Maior categoria', maior ? esc(maior.nome) : '—', maior ? `${brl(maior.receita)} · ${pc(maior.pct)} das vendas` : '', 'trophy', 'amber')}
        ${kpi('Vendas no período', brl(R.total), `desde ${ddmm(R.desde)}`, 'lucro', 'green')}</div>
      <div class="box"><h3>Top 10 categorias por vendas</h3><div style="height:260px"><canvas id="nc1"></canvas></div></div>
      <div class="box"><div class="boxh"><h3>Categorias <small id="ncn"></small></h3>${filtros('ncf', `<label style="min-width:200px">Buscar<input id="ncq" placeholder="Nome da categoria…"></label><label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="nct"> só as que geram 80%</label><button class="btn2" id="nccsv">${ic('down', 13)}Exportar</button>`)}</div>
        <div class="tw" style="max-height:none"><table class="rt" id="nctb"><thead></thead><tbody></tbody></table></div></div>`;
    let cur = [];
    const draw = () => {
      cur = ordena(all.filter(x => (!f.q || (x.nome + ' ' + x.caminho).toLowerCase().includes(f.q)) && (!f.top || x.top80)), st);
      $('#ncn').textContent = `(${num(cur.length)})`;
      $('#nctb thead').innerHTML = `<tr><th>Categoria</th>${thS('Vendas', 'receita', st, 'n')}${thS('% das vendas', 'pct', st, 'n')}${thS('Var. vs anterior', 'cresc', st, 'n')}${thS('Unid.', 'unidades', st, 'n')}${thS('Pedidos', 'pedidos', st, 'n')}${thS('Anúncios c/ venda', 'anuncios', st, 'n')}${thS('Ativos', 'ativos', st, 'n')}${thS('Visitas', 'visitas', st, 'n')}${thS('Conversão', 'conversao', st, 'n')}${thS('Margem', 'margem', st, 'c')}</tr>`;
      ligaSort('#nctb', st, draw);
      $('#nctb tbody').innerHTML = cur.map(x => `<tr><td style="min-width:240px"><b>${esc(x.nome)}</b>${x.top80 ? ' <span class="sg g">80%</span>' : ''}<br><small style="color:var(--mut)">${esc(x.caminho)}</small></td><td class="n"><b>${brl(x.receita)}</b></td><td class="n">${pc(x.pct)}</td><td class="n">${x.cresc == null ? '<span class="sg n">novo</span>' : dlt(x.cresc)}</td>
        <td class="n">${num(x.unidades)}</td><td class="n">${num(x.pedidos)}</td><td class="n">${num(x.anuncios)}</td><td class="n">${num(x.ativos)}</td><td class="n">${num(x.visitas)}</td><td class="n">${conv(x.conversao)}</td><td class="c">${x.margem == null ? '—' : mgPill(x.margem)}</td></tr>`).join('') || '<tr><td colspan="11" class="empty">Nenhuma categoria com esses filtros.</td></tr>';
    };
    $('#ncq').oninput = debounce(() => { f.q = $('#ncq').value.toLowerCase().trim(); draw(); }); $('#nct').onchange = () => { f.top = $('#nct').checked; draw(); };
    $('#nccsv').onclick = () => csv('categorias.csv', [['Categoria', x => x.nome], ['Caminho', x => x.caminho], ['Vendas', x => num2(x.receita)], ['% vendas', x => num2(x.pct * 100)], ['Var %', x => x.cresc == null ? '' : num2(x.cresc * 100)], ['Unidades', x => x.unidades], ['Pedidos', x => x.pedidos], ['Anúncios c/ venda', x => x.anuncios], ['Ativos', x => x.ativos], ['Visitas', x => x.visitas], ['Conversão %', x => x.conversao == null ? '' : num2(x.conversao * 100)]], cur);
    draw();
    const t10 = all.slice(0, 10); mk('#nc1', hbarCfg(t10.map(x => x.nome), t10.map(x => x.receita), '#3b82f6'));
  };

  // ═════════ PERFORMANCE DE VENDAS (POR ANÚNCIO) ═════════
  VIEWS.nmanuncios = async function () {
    const R = await api('nm/anuncios'), all = R.linhas, st = { k: 'receita', d: -1 }, f = { q: '', cat: '', lg: '', tipo: '', vis: '', page: 1 }, PG = 40;
    const opts = k => [...new Set(all.map(x => x[k]).filter(Boolean))].sort().map(v => `<option>${esc(v)}</option>`).join('');
    $('#view').innerHTML = `${semVis(R.temVisitas)}
      <div class="kgrid">${kpi('Anúncios ativos', num(R.ativos), `${num(R.ativosComVenda)} venderam no período (${pc(R.ativos ? R.ativosComVenda / R.ativos : 0, 0)})`, 'itens', 'blue')}
        ${kpi('Geram 80% das vendas', num(R.nTop80), 'anúncios', 'abc', 'purple')}
        ${kpi('Ativos sem venda', num(R.ativos - R.ativosComVenda), 'no período escolhido', 'alertas', 'red')}
        ${kpi('Vendas no período', brl(R.total), `desde ${ddmm(R.desde)}`, 'lucro', 'green')}</div>
      <div class="box"><div class="boxh"><h3>Anúncios <small id="nan"></small></h3>${filtros('naf', `<label style="min-width:200px">Buscar<input id="naq" placeholder="Título, SKU ou MLB…"></label>
        <label>Catálogo<select id="nac"><option value="">Todos</option><option value="1">Com catálogo</option><option value="0">Sem catálogo</option></select></label>
        <label>Envio<select id="nal"><option value="">Todos</option>${opts('lg')}</select></label><label>Tipo<select id="nat"><option value="">Todos</option>${opts('tipo')}</select></label>
        <label>Mostrar<select id="nav"><option value="">Todos</option><option value="top">Os que geram 80%</option><option value="sem">Ativos sem venda</option></select></label><button class="btn2" id="nacsv">${ic('down', 13)}Exportar</button>`)}</div>
        <div class="tw" style="max-height:none"><table class="rt" id="natb"><thead></thead><tbody></tbody></table></div><div class="pg" id="napg"></div></div>`;
    let cur = [];
    const draw = () => {
      cur = ordena(all.filter(x => (!f.q || (x.titulo + ' ' + x.sku + ' ' + x.item).toLowerCase().includes(f.q)) && (f.cat === '' || String(+x.catalogo) === f.cat) && (!f.lg || x.lg === f.lg) && (!f.tipo || x.tipo === f.tipo)
        && (!f.vis || (f.vis === 'top' ? x.top80 : x.status === 'active' && !x.unidades))), st);
      $('#nan').textContent = `(${num(cur.length)})`;
      $('#natb thead').innerHTML = `<tr><th>Anúncio</th>${thS('Pedidos', 'pedidos', st, 'n')}${thS('Unid.', 'unidades', st, 'n')}${thS('Vendas', 'receita', st, 'n')}${thS('% das vendas', 'pct', st, 'n')}${thS('Preço médio', 'ticket', st, 'n')}${thS('Var. vs anterior', 'cresc', st, 'n')}${thS('Vendidos (total ML)', 'historico', st, 'n')}${thS('Visitas', 'visitas', st, 'n')}${thS('Conversão', 'conversao', st, 'n')}<th>Estados</th></tr>`;
      ligaSort('#natb', st, () => { f.page = 1; draw(); });
      const pgs = Math.max(Math.ceil(cur.length / PG), 1); f.page = Math.min(f.page, pgs);
      $('#natb tbody').innerHTML = cur.slice((f.page - 1) * PG, f.page * PG).map(x => `<tr><td>${prod(x)}${x.top80 ? ' <span class="sg g">80%</span>' : ''}</td><td class="n">${num(x.pedidos)}</td><td class="n">${num(x.unidades)}</td><td class="n"><b>${brl(x.receita)}</b></td><td class="n">${pc(x.pct)}</td>
        <td class="n">${x.ticket == null ? '—' : brl(x.ticket)}</td><td class="n">${x.cresc == null ? (x.receita ? '<span class="sg n">novo</span>' : '—') : dlt(x.cresc)}</td><td class="n">${x.historico == null ? '—' : num(x.historico)}</td><td class="n">${num(x.visitas)}</td><td class="n">${conv(x.conversao)}</td><td><small>${esc(x.ufs)}</small></td></tr>`).join('') || '<tr><td colspan="11" class="empty">Nenhum anúncio com esses filtros.</td></tr>';
      pager($('#napg'), cur.length, f.page, PG, p => { f.page = p; draw(); });
    };
    const ler = () => { f.q = $('#naq').value.toLowerCase().trim(); f.cat = $('#nac').value; f.lg = $('#nal').value; f.tipo = $('#nat').value; f.vis = $('#nav').value; f.page = 1; draw(); };
    ['#nac', '#nal', '#nat', '#nav'].forEach(i => $(i).onchange = ler); $('#naq').oninput = debounce(ler);
    $('#nacsv').onclick = () => csv('performance-anuncios.csv', [['MLB', x => x.item], ['SKU', x => x.sku], ['Anúncio', x => x.titulo], ['Conta', x => lojaTxt(x.loja)], ['Categoria', x => x.categoriaNome], ['Catálogo', x => x.catalogo ? 'sim' : ''], ['Tipo', x => x.tipo], ['Envio', x => x.lg],
      ['Pedidos', x => x.pedidos], ['Unidades', x => x.unidades], ['Vendas', x => num2(x.receita)], ['% vendas', x => num2(x.pct * 100)], ['Var %', x => x.cresc == null ? '' : num2(x.cresc * 100)], ['Vendidos total ML', x => x.historico ?? ''], ['Visitas', x => x.visitas], ['Conversão %', x => x.conversao == null ? '' : num2(x.conversao * 100)], ['Gera 80%', x => x.top80 ? 'sim' : '']], cur);
    draw();
  };

  // ═════════ SEUS CLIENTES ═════════
  VIEWS.nmclientes = async function () {
    const R = await api('nm/clientes'), all = R.linhas, st = { k: 'receita', d: -1 }, f = { q: '', tipo: '', page: 1 }, PG = 50;
    $('#view').innerHTML = `<div class="kgrid">${kpi('Clientes no período', num(R.clientes), `desde ${ddmm(R.desde)}`, 'pedidos', 'blue')}
        ${kpi('Clientes novos', num(R.novos), `${pc(R.clientes ? R.novos / R.clientes : 0, 0)} compraram pela 1ª vez`, 'rocket', 'green')}
        ${kpi('Recorrentes', num(R.recorrentes), `${brl(R.receitaRecorrentes)} · ${pc(R.total ? R.receitaRecorrentes / R.total : 0, 0)} das vendas`, 'reputacao', 'purple')}
        ${kpi('Gasto médio por cliente', brl(R.ticketCliente), 'vendas ÷ clientes', 'dre', 'amber')}</div>
      <div class="note">Os dados dos compradores ficam só neste computador, como todo o resto do Nexus.</div>
      <div class="box"><div class="boxh"><h3>Clientes <small id="nln"></small></h3>${filtros('nlf', `<label style="min-width:200px">Buscar<input id="nlq" placeholder="Apelido do comprador…"></label><label>Mostrar<select id="nlt"><option value="">Todos</option><option value="novo">Novos</option><option value="rec">Recorrentes</option></select></label><button class="btn2" id="nlcsv">${ic('down', 13)}Exportar</button>`)}</div>
        <div class="tw" style="max-height:none"><table class="rt" id="nltb"><thead></thead><tbody></tbody></table></div><div class="pg" id="nlpg"></div></div>`;
    let cur = [];
    const draw = () => {
      cur = ordena(all.filter(x => (!f.q || String(x.nome).toLowerCase().includes(f.q)) && (!f.tipo || (f.tipo === 'novo' ? x.novo : x.recorrente))), st);
      $('#nln').textContent = `(${num(cur.length)})`;
      $('#nltb thead').innerHTML = `<tr><th>Cliente</th>${thS('Pedidos', 'pedidos', st, 'n')}${thS('Unid.', 'unidades', st, 'n')}${thS('Compras', 'receita', st, 'n')}${thS('Frete pago pelo cliente', 'freteComprador', st, 'n')}${thS('Frete pago por você', 'freteVendedor', st, 'n')}${thS('Pedidos (todo o histórico)', 'totalPedidos', st, 'n')}${thS('Primeira compra', 'primeira', st)}<th>UF</th></tr>`;
      ligaSort('#nltb', st, () => { f.page = 1; draw(); });
      const pgs = Math.max(Math.ceil(cur.length / PG), 1); f.page = Math.min(f.page, pgs);
      $('#nltb tbody').innerHTML = cur.slice((f.page - 1) * PG, f.page * PG).map(x => `<tr><td><b>${esc(x.nome)}</b> ${x.novo ? '<span class="sg g">novo</span>' : ''}${x.recorrente ? ' <span class="sg b">recorrente</span>' : ''}<br><small style="color:var(--mut)">${x.lojas.map(l => esc(lojaTxt(l))).join(', ')}</small></td>
        <td class="n">${num(x.pedidos)}</td><td class="n">${num(x.unidades)}</td><td class="n"><b>${brl(x.receita)}</b></td><td class="n">${brl(x.freteComprador)}</td><td class="n">${brl(x.freteVendedor)}</td><td class="n">${num(x.totalPedidos)}</td><td>${x.primeira ? ddmm(x.primeira) + '/' + x.primeira.slice(0, 4) : '—'}</td><td>${esc(x.ufs)}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhum cliente com esses filtros.</td></tr>';
      pager($('#nlpg'), cur.length, f.page, PG, p => { f.page = p; draw(); });
    };
    const ler = () => { f.q = $('#nlq').value.toLowerCase().trim(); f.tipo = $('#nlt').value; f.page = 1; draw(); };
    $('#nlt').onchange = ler; $('#nlq').oninput = debounce(ler);
    $('#nlcsv').onclick = () => csv('clientes.csv', [['Cliente', x => x.nome], ['Pedidos', x => x.pedidos], ['Unidades', x => x.unidades], ['Compras', x => num2(x.receita)], ['Frete cliente', x => num2(x.freteComprador)], ['Frete vendedor', x => num2(x.freteVendedor)], ['Pedidos histórico', x => x.totalPedidos], ['Primeira compra', x => x.primeira || ''], ['UF', x => x.ufs], ['Novo', x => x.novo ? 'sim' : ''], ['Recorrente', x => x.recorrente ? 'sim' : '']], cur);
    draw();
  };

  // ═════════ OTIMIZE SEUS ANÚNCIOS ═════════
  VIEWS.nmotimiza = async function () {
    const R = await api('nm/otimiza'), all = R.linhas, st = { k: 'prioridade', d: -1 }, f = { q: '', pend: false, page: 1 }, PG = 40;
    const nota = s => s == null ? '<span class="sg n">sem nota</span>' : `<span class="sg ${s >= 80 ? 'g' : s >= 60 ? 'a' : 'r'}" style="font-size:13px">${Math.round(s)}</span>`;
    const efic = e => e == null ? '—' : `<span class="sg ${e >= 1.1 ? 'g' : e >= 0.8 ? 'n' : 'r'}">${e.toFixed(1).replace('.', ',')}×</span>`;
    $('#view').innerHTML = `${R.comQualidade ? '' : '<div class="note">Ainda não há notas de qualidade coletadas. O Nexus busca a nota de cada anúncio ativo uma vez por dia.</div>'}
      <div class="kgrid">${kpi('Anúncios ativos', num(R.ativos), `${num(R.comQualidade)} com nota do ML`, 'itens', 'blue')}
        ${kpi('Nota média do ML', R.mediaScore == null ? '—' : Math.round(R.mediaScore), 'qualidade do anúncio (0 a 100)', 'reputacao', 'green')}
        ${kpi('Com melhorias pendentes', num(R.pendentes), 'o ML aponta o que falta', 'bulb', 'amber')}
        ${kpi('Conversão mediana', conv(R.conversaoMediana), 'unidades ÷ visitas · anúncios com 30+ visitas', 'promocoes', 'purple')}</div>
      <div class="box"><div class="boxh"><h3>Anúncios por prioridade <small id="non"></small></h3>${filtros('nof', `<label style="min-width:200px">Buscar<input id="noq" placeholder="Título, SKU ou MLB…"></label><label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="nop"> só com melhorias pendentes</label><button class="btn2" id="nocsv">${ic('down', 13)}Exportar</button>`)}</div>
        <p style="color:var(--mut);margin:0 0 8px;font-size:12px">Prioridade = o quanto falta de qualidade × o peso do anúncio nas suas vendas e visitas. Eficiência = conversão do anúncio ÷ conversão mediana da sua loja.</p>
        <div class="tw" style="max-height:none"><table class="rt" id="notb"><thead></thead><tbody></tbody></table></div><div class="pg" id="nopg"></div></div>`;
    let cur = [];
    const draw = () => {
      cur = ordena(all.filter(x => (!f.q || (x.titulo + ' ' + x.sku + ' ' + x.item).toLowerCase().includes(f.q)) && (!f.pend || x.pendencias.length)), st);
      $('#non').textContent = `(${num(cur.length)})`;
      $('#notb thead').innerHTML = `<tr><th>Anúncio</th>${thS('Nota ML', 'score', st, 'c')}<th>O que melhorar</th>${thS('Visitas 30d', 'visitas', st, 'n')}${thS('Unid. 30d', 'unidades', st, 'n')}${thS('Conversão', 'conversao', st, 'n')}${thS('Eficiência', 'eficiencia', st, 'c')}${thS('% das vendas', 'pct', st, 'n')}${thS('Prioridade', 'prioridade', st, 'n')}</tr>`;
      ligaSort('#notb', st, () => { f.page = 1; draw(); });
      const pgs = Math.max(Math.ceil(cur.length / PG), 1); f.page = Math.min(f.page, pgs);
      $('#notb tbody').innerHTML = cur.slice((f.page - 1) * PG, f.page * PG).map(x => `<tr><td>${prod(x)}</td><td class="c">${nota(x.score)}${x.nivel ? `<br><small style="color:var(--mut)">${esc(x.nivel)}</small>` : ''}</td>
        <td style="max-width:320px">${x.pendencias.length ? `<small>${x.pendencias.slice(0, 3).map(p => `• ${p.link ? `<a class="lk" target="_blank" rel="noopener" href="${esc(p.link)}">${esc(p.titulo)}</a>` : esc(p.titulo)}`).join('<br>')}${x.pendencias.length > 3 ? `<br><span style="color:var(--mut)">+${x.pendencias.length - 3} outra(s)</span>` : ''}</small>` : (x.score == null ? '<small style="color:var(--mut)">—</small>' : '<span class="sg g">nada pendente</span>')}</td>
        <td class="n">${num(x.visitas)}</td><td class="n">${num(x.unidades)}</td><td class="n">${conv(x.conversao)}</td><td class="c">${efic(x.eficiencia)}</td><td class="n">${pc(x.pct)}</td><td class="n">${(x.prioridade * 100).toFixed(1).replace('.', ',')}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhum anúncio com esses filtros.</td></tr>';
      pager($('#nopg'), cur.length, f.page, PG, p => { f.page = p; draw(); });
    };
    const ler = () => { f.q = $('#noq').value.toLowerCase().trim(); f.pend = $('#nop').checked; f.page = 1; draw(); };
    $('#nop').onchange = ler; $('#noq').oninput = debounce(ler);
    $('#nocsv').onclick = () => csv('otimize-anuncios.csv', [['MLB', x => x.item], ['SKU', x => x.sku], ['Anúncio', x => x.titulo], ['Conta', x => lojaTxt(x.loja)], ['Nota ML', x => x.score ?? ''], ['Nível', x => x.nivel || ''], ['Pendências', x => x.pendencias.map(p => p.titulo).join(' | ')],
      ['Visitas 30d', x => x.visitas], ['Unidades 30d', x => x.unidades], ['Conversão %', x => x.conversao == null ? '' : num2(x.conversao * 100)], ['Eficiência', x => x.eficiencia == null ? '' : num2(x.eficiencia)], ['% vendas', x => num2(x.pct * 100)]], cur);
    draw();
  };

  // ═════════ CRESCIMENTO ═════════
  VIEWS.nmcrescimento = async function () {
    const R = await api('nm/crescimento'), L = R.meses, lab = L.map(x => mesNome(x.mes) + (x.parcial ? '*' : ''));
    const ult = L.filter(x => !x.parcial).at(-1), atual = L.find(x => x.parcial);
    $('#view').innerHTML = `${semVis(R.temVisitas)}
      <div class="kgrid">${kpi('Último mês fechado', ult ? brl(ult.receita) : '—', ult ? `${mesNome(ult.mes)} · ${dlt(ult.mom)} vs mês anterior${ult.yoy != null ? ` · ${dlt(ult.yoy)} vs ano anterior` : ''}` : '', 'cal', 'blue')}
        ${kpi('Mês atual (projeção)', atual?.projecao != null ? brl(atual.projecao) : '—', atual ? `${brl(atual.receita)} até agora · ${dlt(atual.mom)} vs mês anterior` : '', 'rocket', 'green')}
        ${kpi('Clientes no último mês fechado', ult ? num(ult.clientes) : '—', ult ? `ticket médio ${brl(ult.ticket)}` : '', 'pedidos', 'purple')}</div>
      <div class="box"><h3>Crescimento mês a mês <small>* mês atual comparado pela projeção</small></h3><div style="height:300px"><canvas id="ng1"></canvas></div></div>
      <div class="box"><h3>Vendas por categoria <small>8 maiores</small></h3><div style="height:300px"><canvas id="ng2"></canvas></div></div>
      <div class="box"><h3>Mês a mês</h3>${tbl([{ t: 'Mês', f: x => `<b>${mesNome(x.mes)}</b>${x.parcial ? ' <small style="color:var(--mut)">(parcial)</small>' : ''}` }, { t: 'Vendas', n: 1, f: x => brl(x.receita) + (x.projecao != null ? `<br><small style="color:var(--mut)">proj. ${brl(x.projecao)}</small>` : '') },
        { t: 'vs mês anterior', n: 1, f: x => dlt(x.mom) || '—' }, { t: 'vs ano anterior', n: 1, f: x => dlt(x.yoy) || '—' }, { t: 'Pedidos', n: 1, f: x => num(x.pedidos) }, { t: 'Unid.', n: 1, f: x => num(x.unidades) }, { t: 'Clientes', n: 1, f: x => num(x.clientes) },
        { t: 'Ticket médio', n: 1, f: x => brl(x.ticket) }, { t: 'Lucro', n: 1, f: x => `<span class="${x.lucro < 0 ? 'bad' : ''}">${brl(x.lucro)}</span>` }, { t: 'Visitas', n: 1, f: x => x.visitas == null ? '—' : num(x.visitas) }, { t: 'Conversão', n: 1, f: x => conv(x.conversao) }], L.slice().reverse())}</div>`;
    mk('#ng1', { data: { labels: lab, datasets: [
      { type: 'bar', label: 'Crescimento vs mês anterior', data: L.map(x => x.mom == null ? null : +(x.mom * 100).toFixed(1)), backgroundColor: L.map(x => (x.mom ?? 0) >= 0 ? '#22c55e' : '#ef4444'), yAxisID: 'y' },
      { type: 'line', label: 'Vendas', data: L.map(x => x.projecao ?? x.receita), borderColor: '#3b82f6', tension: .25, yAxisID: 'y1', pointRadius: 3 }] },
      options: { ...ch, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y' ? ` ${c.dataset.label}: ${c.raw == null ? '—' : String(c.raw).replace('.', ',') + '%'}` : ` ${c.dataset.label}: ${brl(c.raw)}` } } },
        scales: { x: ch.scales.x, y: { ...ch.scales.y, position: 'left', ticks: { ...ch.scales.y.ticks, callback: v => v + '%' } }, y1: { ...ch.scales.y, position: 'right', grid: { display: false }, ticks: { ...ch.scales.y.ticks, callback: v => num(v) } } } } });
    mk('#ng2', { type: 'bar', data: { labels: lab, datasets: R.categorias.map((c, i) => ({ label: c.nome, data: c.meses, backgroundColor: PAL[i % PAL.length] })) },
      options: { ...ch, plugins: { ...ch.plugins, ...tipBrl }, scales: { x: { ...ch.scales.x, stacked: true }, y: { ...ch.scales.y, stacked: true, ticks: { ...ch.scales.y.ticks, callback: v => num(v) } } } } });
  };
})();
