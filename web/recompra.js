// Gestão de Produtos › Recompra: quanto comprar de cada SKU, pelas vendas do período (ML + Shopee) e o estoque dos anúncios.
// Carregado depois de jodda.js: reaproveita kpi, ic, pc, esc, brl, num, store, debounce, thS, ordena, ligaSort, pager, csv, skuLink, parseNum.
(() => {
  const g = GRUPOS.find(x => x.n === 'Gestão de Produtos');
  if (g && !g.tabs.some(t => t[0] === 'recompra')) g.tabs.splice(g.tabs.findIndex(t => t[0] === 'abc') + 1, 0, ['recompra', 'Recompra']);
  SUB.recompra = 'Quanto comprar de cada produto, pelas vendas do período e o estoque dos anúncios';
  PERIODO.recompra = 1;

  const SIT = { ja: ['Comprar já', 'bad'], comprar: ['Comprar', 'warn'], zero: ['Sem estoque', 'bad'], ok: ['OK', 'ok'] };
  const parametros = () => ({ cobrir: store.get('rc_cobrir') ?? 30, prazo: store.get('rc_prazo') ?? 7, seg: store.get('rc_seg') ?? 7 });

  VIEWS.recompra = async function () {
    const R = await api('recompra'), D = R.dias;
    const p = parametros(), f = { q: '', sit: 'precisa', cls: '', page: 1 }, st = { k: 'prio', d: -1 }, PG = 50;
    $('#view').innerHTML = `<div class="flt" style="margin-top:0"><h4>${ic('search', 13)} Parâmetros da compra</h4><div class="fgrid">
        <label title="Quantos dias de venda a compra deve cobrir depois que chegar">Cobrir (dias)<input id="rcC" inputmode="numeric" value="${p.cobrir}"></label>
        <label title="Quantos dias o fornecedor leva para entregar">Prazo do fornecedor (dias)<input id="rcP" inputmode="numeric" value="${p.prazo}"></label>
        <label title="Folga para atraso ou venda acima da média">Segurança (dias)<input id="rcS" inputmode="numeric" value="${p.seg}"></label>
        <label>Mostrar<select id="rcF"><option value="precisa">Só o que precisa comprar</option><option value="ja">Só "comprar já"</option><option value="">Todos com venda</option></select></label>
        <label>Curva<select id="rcK"><option value="">A, B e C</option><option>A</option><option>B</option><option>C</option></select></label>
        <label style="min-width:220px;flex:1">Buscar<input id="rcQ" placeholder="SKU ou produto…"></label>
        <button id="rcX" class="btn2">${ic('down', 13)}Planilha</button></div>
        <p class="dica" style="margin:8px 0 0">Média de venda = unidades vendidas nos últimos ${D} dias ÷ ${D} (troque em Período, no topo). Comprar = média × (cobrir + prazo + segurança) − estoque.
        Estoque próprio: anúncios do mesmo SKU fora do Full mostram o mesmo estoque do seu depósito, então conta o maior deles. Full: soma dos anúncios no depósito do Mercado Livre.</p></div>
      <div class="kgrid" id="rcK2"></div>
      <div class="box"><div class="boxh"><h3>Recompra por SKU</h3><small id="rcN"></small></div><div class="tw" style="max-height:none"><table class="rt" id="rctb"><thead></thead><tbody></tbody></table></div><div class="pg" id="rcPg"></div></div>`;
    let cur = [];
    const calc = () => {
      const alvo = p.cobrir + p.prazo + p.seg;
      return R.linhas.map(x => {
        const md = x.unidades / D, md30 = x.unidades30 / 30, est = x.estoqueProprio + x.estoqueFull, cob = md > 0 ? est / md : null;
        const comprar = md > 0 ? Math.max(0, Math.ceil(md * alvo - est)) : 0;
        const sit = md === 0 ? '' : est <= 0 ? 'zero' : cob < p.prazo + p.seg ? 'ja' : comprar > 0 ? 'comprar' : 'ok';
        return { ...x, md, md30, tend: md > 0 ? md30 / md - 1 : null, est, cob, comprar, valor: x.custo != null ? comprar * x.custo : null, sit, alvo,
          prio: sit === 'zero' ? 3e9 : sit === 'ja' ? 2e9 - (cob ?? 0) : comprar };
      });
    };
    const tt = s => ` title="${esc(s)}"`;
    const EX = {
      md: x => `Média de venda: ${num(x.unidades)} un. nos últimos ${D} dias ÷ ${D} = ${x.md.toFixed(2).replace('.', ',')} por dia`,
      tend: x => `Últimos 30 dias: ${num(x.unidades30)} un. ÷ 30 = ${x.md30.toFixed(2).replace('.', ',')} por dia, contra ${x.md.toFixed(2).replace('.', ',')} por dia no período (${x.tend == null ? '—' : (x.tend >= 0 ? '+' : '') + pc(x.tend, 0)}).\nVendendo mais no último mês, compre um pouco acima da sugestão.`,
      est: x => `Estoque nos anúncios:\n${x.anuncios.map(a => `${a.canal} ${lojaTxt(a.loja)} · ${a.anuncio}${a.variacao ? ' (' + a.variacao + ')' : ''}${a.full ? ' · Full' : ''}${a.pausado ? ' · pausado' : ''}: ${num(a.qtd)}`).join('\n') || 'nenhum anúncio ativo com este SKU'}\nPróprio = o maior fora do Full (${num(x.estoqueProprio)}) · Full = soma (${num(x.estoqueFull)})`,
      cob: x => x.cob == null ? 'Sem venda no período' : `Cobertura: estoque ${num(x.est)} ÷ média ${x.md.toFixed(2).replace('.', ',')} por dia = ${Math.floor(x.cob)} dias até acabar`,
      comprar: x => `Comprar = média ${x.md.toFixed(2).replace('.', ',')} × (cobrir ${p.cobrir} + prazo ${p.prazo} + segurança ${p.seg} = ${x.alvo} dias) − estoque ${num(x.est)}\n= ${(x.md * x.alvo).toFixed(1).replace('.', ',')} − ${num(x.est)} → ${num(x.comprar)} un.`,
      valor: x => x.custo == null ? 'Sem custo cadastrado para este SKU (Gestão de Produtos › Custos)' : `${num(x.comprar)} un. × custo ${brl(x.custo)} = ${brl(x.valor)}`,
      sit: x => ({ zero: 'Sem estoque e com venda: está perdendo vendas agora', ja: `O estoque acaba em menos de ${p.prazo + p.seg} dias (prazo + segurança): comprando hoje, ainda falta antes de chegar`, comprar: 'O estoque cobre o prazo de entrega, mas não os dias que você quer cobrir', ok: 'O estoque cobre o período escolhido' })[x.sit] || '',
    };
    const filtrar = L => L.filter(x => (!f.q || (x.sku + ' ' + x.titulo + ' ' + x.variacao).toLowerCase().includes(f.q)) && (!f.cls || x.classe === f.cls)
      && (f.sit === 'precisa' ? x.comprar > 0 || x.sit === 'zero' : f.sit === 'ja' ? x.sit === 'ja' || x.sit === 'zero' : x.md > 0));
    const draw = () => {
      const todos = calc(); cur = ordena(filtrar(todos), st);
      const pc2 = todos.filter(x => x.comprar > 0), semCusto = pc2.filter(x => x.custo == null).length;
      $('#rcK2').innerHTML = kpi('Produtos para comprar', num(pc2.length), `${num(todos.filter(x => x.sit === 'ja' || x.sit === 'zero').length)} com urgência (comprar já ou sem estoque)`, 'estoque', 'amber')
        + kpi('Unidades a comprar', num(pc2.reduce((t, x) => t + x.comprar, 0)), `para cobrir ${p.cobrir} dias, com prazo de ${p.prazo} e segurança de ${p.seg}`, 'pedidos', 'blue')
        + kpi('Custo da compra', brl(pc2.reduce((t, x) => t + (x.valor || 0), 0)), semCusto ? `${num(semCusto)} produto(s) sem custo cadastrado ficam de fora` : 'quantidade × custo cadastrado', 'lucro', 'green')
        + kpi('Sem estoque', num(todos.filter(x => x.sit === 'zero').length), 'com venda no período: vendas perdidas agora', 'cancel', 'red');
      $('#rcN').textContent = `${num(cur.length)} produto(s) · vendas dos últimos ${D} dias`;
      $('#rctb thead').innerHTML = `<tr><th>Produto</th>${thS('Curva', 'classe', st, 'c')}${thS('Vendidos', 'unidades', st, 'n')}${thS('Média/dia', 'md', st, 'n')}${thS('Tendência', 'tend', st, 'n')}${thS('Estoque próprio', 'estoqueProprio', st, 'n')}${thS('Full', 'estoqueFull', st, 'n')}${thS('Cobertura', 'cob', st, 'n')}${thS('Comprar', 'comprar', st, 'n')}${thS('Custo da compra', 'valor', st, 'n')}${thS('Situação', 'prio', st, 'c')}</tr>`;
      ligaSort('#rctb', st, () => { f.page = 1; draw(); });
      const pgs = Math.max(Math.ceil(cur.length / PG), 1); f.page = Math.min(f.page, pgs);
      $('#rctb tbody').innerHTML = cur.slice((f.page - 1) * PG, f.page * PG).map(x => `<tr>
        <td><b>${skuLink(x.sku, esc(x.titulo || x.sku))}</b><small style="display:block;color:var(--mut)">${esc(x.sku)}${x.variacao ? ' · ' + esc(x.variacao) : ''} · ${x.canais.join(' + ')}</small></td>
        <td class="c"><span class="sg ${x.classe === 'A' ? 'g' : x.classe === 'B' ? 'b' : ''}">${x.classe}</span></td>
        <td class="n">${num(x.unidades)}</td><td class="n"${tt(EX.md(x))}>${x.md.toFixed(2).replace('.', ',')}</td>
        <td class="n"${tt(EX.tend(x))}>${x.tend == null ? '—' : `<span class="${x.tend > 0.1 ? 'ok' : x.tend < -0.1 ? 'bad' : ''}">${x.tend >= 0 ? '+' : ''}${pc(x.tend, 0)}</span>`}</td>
        <td class="n"${tt(EX.est(x))}>${num(x.estoqueProprio)}</td><td class="n"${tt(EX.est(x))}>${num(x.estoqueFull)}</td>
        <td class="n"${tt(EX.cob(x))}>${x.cob == null ? '—' : x.cob > 999 ? '999+' : Math.floor(x.cob) + ' d'}</td>
        <td class="n"${tt(EX.comprar(x))}><b>${x.comprar ? num(x.comprar) : '—'}</b></td>
        <td class="n"${tt(EX.valor(x))}>${x.valor == null ? (x.comprar ? '<small class="warn">sem custo</small>' : '—') : brl(x.valor)}</td>
        <td class="c"${tt(EX.sit(x))}>${x.sit ? `<span class="tag ${SIT[x.sit][1]}">${SIT[x.sit][0]}</span>` : '—'}</td></tr>`).join('') || '<tr><td colspan="11" class="empty">Nada para comprar com esses parâmetros.</td></tr>';
      pager($('#rcPg'), cur.length, f.page, PG, n => { f.page = n; draw(); $('#rctb').scrollIntoView({ block: 'start' }); });
    };
    // parâmetros: inteiros de 0 a 365, guardados neste navegador
    const lerParam = (id, k) => { const v = Math.round(parseNum($(id).value)); if (Number.isFinite(v) && v >= 0 && v <= 365) { p[k] = v; store.set('rc_' + k, v); } };
    $('#rcC').oninput = $('#rcP').oninput = $('#rcS').oninput = debounce(() => { lerParam('#rcC', 'cobrir'); lerParam('#rcP', 'prazo'); lerParam('#rcS', 'seg'); f.page = 1; draw(); });
    $('#rcF').onchange = () => { f.sit = $('#rcF').value; f.page = 1; draw(); };
    $('#rcK').onchange = () => { f.cls = $('#rcK').value; f.page = 1; draw(); };
    $('#rcQ').oninput = debounce(() => { f.q = $('#rcQ').value.toLowerCase().trim(); f.page = 1; draw(); });
    $('#rcX').onclick = () => csv(`recompra-${D}d.csv`, [['SKU', x => x.sku], ['Produto', x => x.titulo], ['Variação', x => x.variacao], ['Canais', x => x.canais.join(' + ')], ['Curva', x => x.classe],
      [`Vendidos (${D} dias)`, x => x.unidades], ['Média/dia', x => num2(x.md)], ['Últimos 30 dias (un.)', x => x.unidades30], ['Estoque próprio', x => x.estoqueProprio], ['Full', x => x.estoqueFull],
      ['Cobertura (dias)', x => (x.cob == null ? '' : Math.floor(x.cob))], ['Comprar (un.)', x => x.comprar], ['Custo unitário', x => (x.custo == null ? '' : num2(x.custo))], ['Custo da compra', x => (x.valor == null ? '' : num2(x.valor))],
      ['Situação', x => (x.sit ? SIT[x.sit][0] : '')]], cur);
    draw();
  };
})();
