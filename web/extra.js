// Telas adicionais: Alertas, Financeiro (DRE), Devoluções, Promoções com margem.
// Carregado depois do script principal; usa seus utilitários globais ($, api, tbl, brl, num, pct, dt, esc, ln, lv, mk, ch, sortable, LOJAS, MENU, VIEWS).
const card2 = (l, v, c = '') => `<div class="card"><div class="l">${l}</div><div class="v ${c}">${v}</div></div>`;
const linkItem = (id, txt) => `<a class="lk" target="_blank" rel="noopener" href="${mlUrl('item', id)}">${esc(txt ?? id)}</a>`;
const linkPedido = (id) => `<a class="lk" target="_blank" rel="noopener" href="${mlUrl('order', id)}">${esc(id)}</a>`;
const mesNome = m => { const [y, mm] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+mm - 1] + '/' + y.slice(2); };


// DRE com meses em colunas: seções escuras, subtotais em destaque e coluna de total (estilo Jodda). Linhas = {mes, receita, comissao, frete, imposto, custo, adsTotal, perdaDevolucao, outras, final, ...}
// cats = categorias de custo fixo (com elas, o DRE ganha a seção CUSTOS FIXOS e o lucro líquido; x.fixos = { categoria: valor }, x.liquido)
function dreTabela(linhas, cats = []) {
  const L = linhas.slice().sort((a, b) => a.mes.localeCompare(b.mes));
  const sm = (k, f) => L.reduce((t, x) => t + f(x), 0);
  const mc = x => x.receita - x.comissao - x.frete - x.imposto - x.custo;
  const aj = x => x.final - (mc(x) - x.adsTotal - x.perdaDevolucao - x.outras); // reembolsos parciais, vendas mantidas por cobertura etc.
  const cel = (v, o = {}, x) => `<td class="n ${o.c || ''}">${o.pct ? pct(v) : o.neg ? (v ? '(−) ' + brl(Math.abs(v)) : brl(0)) : brl(v)}${o.nota && x ? o.nota(x) : ''}</td>`;
  const sec = t => `<tr class="sec"><td colspan="${L.length + 2}">${t}</td></tr>`;
  const row = (nome, f, o = {}) => `<tr class="${o.cls || ''}"><td class="lb">${nome}</td>${L.map(x => cel(f(x), o, x)).join('')}${cel(o.pct ? (o.tot ? o.tot() : 0) : sm(0, f), { ...o, nota: null })}</tr>`;
  const totRec = sm(0, x => x.receita);
  const out = [
    sec('RECEITA'),
    row('Receita bruta (já líquida de devoluções)', x => x.receita, { cls: 'sub' }),
    sec('CUSTOS VARIÁVEIS'),
    row('(−) Comissão Mercado Livre', x => x.comissao, { neg: 1 }), row('(−) Frete pago pelo vendedor', x => x.frete, { neg: 1 }),
    row('(−) Imposto (Simples)', x => x.imposto, { neg: 1 }), row('(−) Custo dos produtos', x => x.custo, { neg: 1 }),
    row('(=) Margem de contribuição', mc, { cls: 'sub' }),
    sec('DESPESAS E PERDAS'),
    row('(−) Ads (Product Ads)', x => x.adsTotal, { neg: 1, nota: x => `<br><small style="color:var(--mut)">${x.adsFonte}</small>` }), row('(−) Perda com devoluções', x => x.perdaDevolucao, { neg: 1 }), row('(−) Outras cobranças da fatura', x => x.outras, { neg: 1, nota: x => x.semFatura ? '<br><small style="color:var(--warn)">sem fatura</small>' : '' }),
    ...(L.some(x => Math.abs(aj(x)) > 0.5) ? [row('(±) Ajustes (reembolsos parciais / cobertura ML)', aj)] : []),
    sec('RESULTADO'),
    ...(cats.length ? [
      row('(=) Lucro antes dos custos fixos', x => x.final, { cls: 'sub' }),
      sec('CUSTOS FIXOS'),
      ...cats.map(c => row(`(−) ${esc(c)}`, x => x.fixos[c] || 0, { neg: 1 })),
      row('(=) LUCRO LÍQUIDO', x => x.liquido, { cls: 'tot', c: '' }),
      `<tr class="eq"><td class="lb">Margem líquida</td>${L.map(x => `<td class="n">${pct(x.receita ? x.liquido / x.receita : 0)}</td>`).join('')}<td class="n">${pct(totRec ? sm(0, x => x.liquido) / totRec : 0)}</td></tr>`,
    ] : [row('(=) LUCRO FINAL', x => x.final, { cls: 'tot', c: '' })]),
    `<tr class="eq"><td class="lb">Margem ${cats.length ? 'antes dos custos fixos' : 'final'}</td>${L.map(x => `<td class="n">${pct(x.margem)}</td>`).join('')}<td class="n">${pct(totRec ? sm(0, x => x.final) / totRec : 0)}</td></tr>`,
    `<tr class="eq"><td class="lb">Pedidos</td>${L.map(x => `<td class="n">${num(x.pedidos)}</td>`).join('')}<td class="n">${num(sm(0, x => x.pedidos))}</td></tr>`,
  ];
  return `<div class="tw dre"><table id="tdre"><thead><tr><th>${'Demonstrativo'}</th>${L.map(x => `<th class="n">${mesNome(x.mes)}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>${out.join('')}</tbody></table></div>`;
}

// Caixa "Custos fixos do negócio" do DRE: lista, cadastra, altera e exclui. Valor por mês, com mês de início e (se tiver) de fim.
const CF_CATS = ['Aluguel', 'Salários e encargos', 'Pró-labore', 'Contabilidade', 'Sistemas e assinaturas', 'Internet e telefone', 'Energia e água', 'Marketing fora do ML', 'Empréstimos e financiamentos', 'Outros'];
async function custosFixos(box, recarregar) {
  const L = await getJ('api/custos-fixos'), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
  const ativo = c => c.inicio <= hoje && (!c.fim || c.fim >= hoje), noMes = L.filter(ativo).reduce((t, c) => t + c.valor, 0);
  const conta = c => c === 'todas' ? 'Todas as contas' : lojaTxt(c);
  const vig = c => c.fim ? (c.fim === c.inicio ? `só em ${mesNome(c.inicio)}` : `${mesNome(c.inicio)} a ${mesNome(c.fim)}`) : `desde ${mesNome(c.inicio)}`;
  const geralFora = $('#loja').value !== 'all' && L.some(c => c.conta === 'todas');
  const cats = [...new Set([...CF_CATS, ...L.map(c => c.categoria)])];
  const inp = 'style="padding:7px 9px;border:1px solid var(--bd);border-radius:7px;font:inherit"';
  box.innerHTML = `<h3>Custos fixos do negócio <small>${L.length ? `${brl(noMes)} por mês hoje · ${L.filter(ativo).length} ativo(s)` : 'aluguel, salários, contador, sistemas…'}</small></h3>
    <p style="color:var(--mut);margin:0 0 10px;font-size:12px">O que você paga todo mês independente de vender: entra no DRE depois do lucro dos pedidos e forma o <b>lucro líquido</b>. Use a conta "Todas as contas" para custos da empresa inteira e uma conta específica para o que é só dela.${geralFora ? ' <b>Com uma loja escolhida no filtro, o DRE mostra só os custos dessa loja</b>: os de "Todas as contas" aparecem em "Todas as lojas".' : ''}</p>
    <form id="cff" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:12px">
      <input type="hidden" id="cfid">
      <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--mut)">Descrição<input id="cfn" maxlength="80" required placeholder="Ex.: Aluguel do galpão" ${inp}></label>
      <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--mut)">Categoria<input id="cfc" list="cfcl" maxlength="40" placeholder="Aluguel" ${inp}><datalist id="cfcl">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--mut)">Conta<select id="cfa" ${inp}><option value="todas">Todas as contas</option>${Object.entries(LOJAS).map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select></label>
      <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--mut)">Valor por mês (R$)<input id="cfv" inputmode="decimal" required placeholder="0,00" style="width:110px;padding:7px 9px;border:1px solid var(--bd);border-radius:7px;font:inherit"></label>
      <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--mut)">A partir de<input id="cfi" type="month" required value="${hoje}" ${inp}></label>
      <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--mut)">Até (opcional)<input id="cfe" type="month" ${inp}></label>
      <button type="submit" id="cfs" style="background:var(--ac);border:0;border-radius:7px;padding:8px 16px;font-weight:600;cursor:pointer">Adicionar</button>
      <button type="button" class="btn2" id="cfx" style="display:none">Cancelar</button><span id="cfm" style="font-size:12px"></span></form>
    ${L.length ? tbl([{ t: 'Descrição', f: c => `<b>${esc(c.nome)}</b>` }, { t: 'Categoria', f: c => `<span class="tag">${esc(c.categoria)}</span>` }, { t: 'Conta', f: c => esc(conta(c.conta)) },
      { t: 'Valor por mês', n: 1, f: c => brl(c.valor) }, { t: 'Período', f: c => `${esc(vig(c))}${ativo(c) ? '' : ` <span class="tag">${c.inicio > hoje ? 'começa depois' : 'encerrado'}</span>`}` },
      { t: '', f: c => `<button class="btn2" data-ed="${esc(c.id)}" style="padding:4px 10px">Editar</button> <button class="btn2" data-rm="${esc(c.id)}" style="padding:4px 10px;color:var(--bad)">Excluir</button>` }],
      L.slice().sort((a, b) => Number(ativo(b)) - Number(ativo(a)) || b.valor - a.valor)) : '<p style="color:var(--mut);margin:0">Nenhum custo fixo cadastrado ainda.</p>'}`;
  const limpa = () => { $('#cff').reset(); $('#cfid').value = ''; $('#cfi').value = hoje; $('#cfs').textContent = 'Adicionar'; $('#cfx').style.display = 'none'; };
  const envia = async (url, op) => { const r = await fetch(url, op), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || `erro ${r.status}`); return j; };
  $('#cff').onsubmit = async e => {
    e.preventDefault(); $('#cfm').textContent = 'Salvando…'; $('#cfm').className = '';
    const b = { id: $('#cfid').value || undefined, nome: $('#cfn').value, categoria: $('#cfc').value, conta: $('#cfa').value, valor: $('#cfv').value, inicio: $('#cfi').value, fim: $('#cfe').value || null };
    try { await envia('api/custos-fixos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); recarregar(); }
    catch (err) { $('#cfm').textContent = err.message; $('#cfm').className = 'bad'; }
  };
  $('#cfx').onclick = limpa;
  box.querySelectorAll('[data-ed]').forEach(bt => bt.onclick = () => {
    const c = L.find(x => x.id === bt.dataset.ed); if (!c) return;
    $('#cfid').value = c.id; $('#cfn').value = c.nome; $('#cfc').value = c.categoria; $('#cfa').value = c.conta; $('#cfv').value = String(c.valor).replace('.', ',');
    $('#cfi').value = c.inicio; $('#cfe').value = c.fim || ''; $('#cfs').textContent = 'Salvar alteração'; $('#cfx').style.display = ''; $('#cfn').focus();
  });
  box.querySelectorAll('[data-rm]').forEach(bt => bt.onclick = async () => {
    const c = L.find(x => x.id === bt.dataset.rm); if (!c || !confirm(`Excluir o custo fixo "${c.nome}" (${brl(c.valor)} por mês)? Ele sai do DRE de todos os meses.`)) return;
    try { await envia(`api/custos-fixos/${encodeURIComponent(c.id)}`, { method: 'DELETE' }); recarregar(); } catch (err) { $('#cfm').textContent = err.message; $('#cfm').className = 'bad'; }
  });
}

Object.assign(VIEWS, {
  // ───────── ALERTAS ─────────
  async alertas() {
    const a = await api('alertas');
    const cor = { alta: 'var(--bad)', media: 'var(--warn)', info: 'var(--l1)' }, rot = { alta: 'ATENÇÃO', media: 'ATENÇÃO MÉDIA', info: 'INFO' };
    $('#view').innerHTML = a.length ? a.map(x => `<div class="box" style="margin-bottom:12px;border-left:4px solid ${cor[x.nivel]}">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="tag" style="color:${cor[x.nivel]}">${rot[x.nivel]}</span><b>${esc(x.titulo)}</b>
        ${x.view ? `<a class="lk" href="#${x.view}" style="margin-left:auto">abrir tela →</a>` : ''}</div>
      <div style="color:var(--mut);margin:6px 0">${esc(x.detalhe)}</div>
      ${x.itens.length ? `<div class="tw" style="max-height:260px">${tbl([{ t: 'Item', f: i => i.item ? linkItem(i.item, i.texto) : i.pedido ? `${esc(i.texto)} · ${linkPedido(i.pedido)}` : esc(i.texto) }, { t: 'Detalhe', k: 'extra' }, { t: 'Loja', k: 'loja' }], x.itens)}</div>` : ''}</div>`).join('')
      : '<div class="box ok">✅ Nenhum alerta no momento.</div>';
  },

  // ───────── FINANCEIRO (DRE) ─────────
  async dre() {
    const d = await api('dre', '&meses=12');
    const hojeBR = new Date(Date.now() - 3 * 3600e3 - 89 * 864e5).toISOString().slice(0, 7);
    const g = {};
    d.porMes.forEach(x => { const o = g[x.mes] ||= { mes: x.mes, pedidos: 0, receita: 0, devolvido: 0, comissao: 0, frete: 0, imposto: 0, custo: 0, ads: 0, adsSemVenda: 0, lucro: 0, perdaDevolucao: 0, freteNF: 0 };
      for (const k of Object.keys(o)) if (k !== 'mes') o[k] += x[k] || 0; });
    // Cobranças da fatura do ML que NÃO são modeladas por pedido: Full (armazenagem/coleta/inconformidade), eShop, DIFAL e outras.
    // Fora daqui (já estão no lucro pedido a pedido ou não são custo):
    //  · comissão (CV*), frete (CXDE/CFFE/...) e Ads;
    //  · devolução (CXDED/CDSDB...) — já está na "perda com devoluções" de cada pedido (antes era contada duas vezes);
    //  · parcelamento (CFONPN) — acréscimo pago pelo COMPRADOR e repassado ao MP: soma zero para o vendedor (antes entrava como custo).
    const fat = {};
    d.faturas.forEach(f => { const o = fat[f.mes] ||= { n: 0, outras: 0, ads: 0, parcelamento: 0, devolucao: 0 };
      o.n++; o.outras += ['full', 'eshop', 'difal', 'outros'].reduce((t, k) => t + (f.classes[k] || 0), 0); o.ads += f.classes.ads || 0;
      o.parcelamento += f.classes.parcelamento || 0; o.devolucao += f.classes.devolucao || 0; });
    const linhas = Object.values(g).sort((a, b) => a.mes.localeCompare(b.mes)).map(m => {
      const f = fat[m.mes];
      const coberto = m.mes > hojeBR; // mês inteiro dentro da janela de 90 dias da API de Ads
      const adsApi = m.ads + m.adsSemVenda;
      const adsTotal = coberto || !f ? adsApi : f.ads; // fora da janela: o Product Ads da fatura (já líquido da bonificação BPAD)
      const outras = f ? f.outras : 0;
      // m.lucro já descontou m.ads (Ads ligado aos pedidos): soma de volta e desconta o total do mês uma vez só
      // (antes, no mês parcialmente coberto pela API, o Ads era descontado duas vezes: API + fatura)
      const final = m.lucro + m.ads - adsTotal - m.perdaDevolucao - outras;
      const fixos = d.fixos?.[m.mes] || {}, fixosTotal = Object.values(fixos).reduce((t, v) => t + v, 0);
      return { ...m, adsTotal, adsFonte: coberto || !f ? 'API' : 'fatura', outras, semFatura: !f, final, margem: m.receita ? final / m.receita : 0, fixos, fixosTotal, liquido: final - fixosTotal };
    });
    const tot = k => linhas.reduce((t, x) => t + x[k], 0);
    // categorias de custo fixo que aparecem nos meses do DRE, da maior para a menor
    const catTot = {}; linhas.forEach(x => Object.entries(x.fixos).forEach(([c, v]) => { catTot[c] = (catTot[c] || 0) + v; }));
    const cats = Object.keys(catTot).sort((a, b) => catTot[b] - catTot[a]), comFixos = cats.length > 0;
    const aviso = [];
    if (d.cobertura.pctReceitaSemCusto > 0.01) aviso.push(`${pct(d.cobertura.pctReceitaSemCusto)} da receita sem custo de produto cadastrado — lucro superestimado.`);
    if (d.cobertura.pctReceitaFreteEstimado > 0.01) aviso.push(`${pct(d.cobertura.pctReceitaFreteEstimado)} da receita com frete estimado (coleta histórica ainda em andamento ou frete indisponível).`);
    $('#view').innerHTML = aviso.map(a => `<div class="box" style="border-color:var(--warn);margin-bottom:10px">⚠ ${a}</div>`).join('') + `<div class="cards">
      ${card2('Receita (12 meses)', brl(tot('receita')))}${comFixos
        ? card2('Lucro antes dos custos fixos', brl(tot('final')), tot('final') < 0 ? 'bad' : 'ok') + card2('Custos fixos (12 meses)', '−' + brl(tot('fixosTotal')), 'warn')
          + card2('Lucro líquido (12 meses)', brl(tot('liquido')), tot('liquido') < 0 ? 'bad' : 'ok') + card2('Margem líquida', pct(tot('receita') ? tot('liquido') / tot('receita') : 0))
        : card2('Lucro final (12 meses)', brl(tot('final')), tot('final') < 0 ? 'bad' : 'ok') + card2('Margem final', pct(tot('receita') ? tot('final') / tot('receita') : 0))}
      ${card2('Imposto (12 meses)', '−' + brl(tot('imposto')))}${card2('Outras cobranças da fatura', '−' + brl(tot('outras')), 'warn')}${card2('Devolvido ao comprador', brl(tot('devolvido')), 'bad')}</div>
      <div class="box" style="margin-bottom:14px"><h3>Lucro final e margem por mês</h3><div style="height:260px"><canvas id="c1"></canvas></div></div>
      <div class="box" style="margin-bottom:14px"><h3>DRE mensal <small>(mês = data do pedido, fuso de Brasília)</small></h3>${dreTabela(linhas, cats)}
        <p style="color:var(--mut);margin:8px 0 0;font-size:12px">Receita já desconta devoluções (pedidos reembolsados saem da receita). “Outras (fatura)” = serviços do Full (armazenagem, coleta, inconformidade), eShop, DIFAL e cobranças não identificadas, líquidas das bonificações. <b>Não</b> entram aqui: a taxa de parcelamento (CFONPN — acréscimo pago pelo comprador e repassado ao Mercado Pago, soma zero para você) e as tarifas de devolução (já contadas pedido a pedido em “Perda devol.”). Ads: API de Ads nos meses inteiros dentro dos últimos 90 dias; antes disso, o valor da fatura. Atenção: a fatura do ML é por <b>período de cobrança</b> (≈ dia 16 do mês anterior ao dia 15), não por mês-calendário — “Outras” e o Ads da fatura são aproximações do mês. O mês corrente usa a fatura ainda em aberto (parcial).${comFixos ? ' Custos fixos: valor do mês inteiro, inclusive no mês corrente (que ainda está com as vendas pela metade).' : ''}</p></div>
      <div class="box" style="margin-bottom:14px" id="cfbox"></div>
      <div class="box"><h3>Faturas do Mercado Livre (cobranças por tipo, já líquidas das bonificações)</h3>${d.faturas.length ? d.faturas.slice().reverse().map(f => `<details style="margin-bottom:6px"><summary style="cursor:pointer">${ln(f)} ${esc(f.grupo === 'MP' ? 'Mercado Pago' : 'Mercado Livre')} · fatura ${esc(f.key)} · <b>${brl(f.total)}</b>
        ${Object.entries(f.classes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="tag">${esc(k)} ${brl(v)}</span>`).join(' ')}</summary>
        ${tbl([{ t: 'Tipo', k: 'tipo' }, { t: 'Descrição', k: 'label' }, { t: 'Classe', k: 'classe' }, { t: 'Valor', n: 1, f: r => `<span class="${r.valor < 0 ? 'ok' : ''}">${brl(r.valor)}</span>` }], f.linhas)}</details>`).join('') : '<p style="color:var(--mut)">Fatura ainda não coletada (a coleta roda às 04:30 e é lenta: limite de 5 chamadas por minuto).</p>'}</div>`;
    mk('#c1', { type: 'bar', data: { labels: linhas.map(x => mesNome(x.mes)), datasets: [{ type: 'line', label: 'Margem %', yAxisID: 'y2', borderColor: '#f59e0b', backgroundColor: '#f59e0b', data: linhas.map(x => +((comFixos ? (x.receita ? x.liquido / x.receita : 0) : x.margem) * 100).toFixed(1)) },
      { label: comFixos ? 'Lucro líquido' : 'Lucro final', backgroundColor: '#3ecf8e', data: linhas.map(x => comFixos ? x.liquido : x.final) }, { label: 'Receita', backgroundColor: '#4da3ff55', data: linhas.map(x => x.receita) }] },
      options: { ...ch, scales: { ...ch.scales, y2: { position: 'right', ticks: { color: '#d97706', callback: v => v + '%' }, grid: { display: false } } } } });
    custosFixos($('#cfbox'), () => VIEWS.dre());
  },

  // ───────── DEVOLUÇÕES ─────────
  async devolucoes() {
    const d = await api('devolucoes');
    const taxa = (d.pedidos + d.total.qtdDevolucoes) ? d.total.qtdDevolucoes / (d.pedidos + d.total.qtdDevolucoes) : 0;
    $('#view').innerHTML = `<div class="cards">${card2('Pedidos reembolsados', num(d.total.qtdDevolucoes), 'bad')}${card2('Taxa (sobre pedidos)', pct(taxa))}${card2('Devolvido ao comprador', brl(d.total.devolvido), 'bad')}
      ${card2('Perda real (cobrado − estornado)', '−' + brl(d.total.perdaDevolucao), 'bad')}${card2('Frete perdido', '−' + brl(d.total.freteDevolucao))}${card2('Vendas mantidas por cobertura do ML (' + num(d.total.qtdVendaMantida) + ' pedidos): você recebeu ' + brl(d.total.vendaMantida), '+' + brl(d.total.resultadoMantido) + ' líquido', 'ok')}</div>
      <div class="grid"><div class="box"><h3>Por tipo</h3>${tbl([{ t: 'Tipo', f: r => `<span class="tag">${esc(r.tipo)}</span>` }, { t: 'Qtd', n: 1, f: r => num(r.n) }, { t: 'Devolvido', n: 1, f: r => brl(r.reembolsado) }, { t: 'Perda', n: 1, f: r => brl(r.perda) }], d.porTipo)}</div>
      <div class="box"><h3>Por motivo (reclamações)</h3>${tbl([{ t: 'Motivo', k: 'nome' }, { t: 'Qtd', n: 1, f: r => num(r.n) }, { t: 'Devolvido', n: 1, f: r => brl(r.reembolsado) }], d.porMotivo)}</div></div>
      <div class="box" style="margin-bottom:14px"><h3>Produtos mais devolvidos</h3>${tbl([{ t: 'Produto', f: r => `${esc(r.titulo)}<br><small style="color:var(--mut)">${esc(r.sku)}</small>` }, { t: 'Loja', f: r => ln(r) }, { t: 'Devoluções', n: 1, f: r => num(r.devolucoes) }, { t: 'Un. devolvidas', n: 1, f: r => num(r.unidades) },
        { t: 'Un. vendidas', n: 1, f: r => num(r.vendas) }, { t: 'Taxa', n: 1, f: r => r.taxa == null ? '' : `<span class="${r.taxa > 0.08 ? 'bad' : ''}">${pct(r.taxa)}</span>` }, { t: 'Valor', n: 1, f: r => brl(r.valor) }], d.porSku, 'tdv')}</div>
      <div class="box"><h3>Pedidos</h3>${tbl([{ t: 'Data', f: r => dt(r.data) }, { t: 'Loja', f: ln }, { t: 'Pedido', f: r => lv('order', r.id, r.loja) }, { t: 'Tipo', f: r => `<span class="tag">${esc(r.tipo)}</span>` }, { t: 'Itens', k: 'itens' },
        { t: 'Devolvido', n: 1, f: r => brl(r.reembolsado) }, { t: 'Frete cobrado', n: 1, f: r => brl(r.freteCobrado) }, { t: 'Frete estornado', n: 1, f: r => brl(r.freteEstornado) }, { t: 'Tarifa de devolução', n: 1, f: r => brl(r.freteVolta) }, { t: 'Comissão não devolvida', n: 1, f: r => brl(r.tarifasPerdidas) }, { t: 'Reembolso pago por', f: r => esc(r.reembolsoPor || '—') }, { t: 'Perda', n: 1, f: r => `<b class="${r.perda > 0 ? 'bad' : 'ok'}">${brl(r.perda)}</b>${r.aguardandoEstorno ? '<br><span class="tag warn">aguardando estorno</span>' : ''}${r.mantida ? `<br><span class="tag ${r.resultadoMantido < 0 ? 'bad' : 'ok'}" title="Líquido recebido ${brl(r.vendaMantida)} − imposto − custo = ${brl(r.resultadoMantido)}">venda mantida</span>` : ''}${r.revertida ? `<br><span class="tag warn" title="O ML cancelou a comissão e cobrou de novo. Pelo extrato você ficaria com ${brl(r.estimativaRevertida)} (antes de imposto e custo), mas a tela do ML mostra um ajuste que a API não entrega. Não contado no lucro: confira no ML.">decisão revertida — conferir</span>` : ''}` }], d.lista)}</div>`;
    sortable('#tdv');
  },

  // ───────── PROMOÇÕES COM MARGEM ─────────
  async promocoes() {
    const [pm, lista] = await Promise.all([api('promocoes-margem'), api('promocoes')]);
    const tipos = [...new Set(pm.map(x => x.tipo))].sort();
    $('#view').innerHTML = `<div class="box" style="margin-bottom:14px"><h3>Campanhas</h3>${tbl([{ t: 'Loja', f: ln }, { t: 'ID', k: 'id' }, { t: 'Tipo', k: 'type' }, { t: 'Status', f: r => stTag(r.status) }, { t: 'Nome', k: 'name' }, { t: 'Início', f: r => dt(r.start_date) }, { t: 'Fim', f: r => dt(r.finish_date) },
        { t: 'Anúncios', f: r => Object.entries(r.itens || {}).map(([k, v]) => `<span class="tag">${esc(k)}: ${num(v)}</span>`).join(' ') }], lista.lista)}</div>
      <div class="box"><h3>Quanto sobra se eu participar <small>(preço promocional − comissão exata − frete médio − imposto − custo)</small></h3>
        <div class="bar"><input id="fs" placeholder="Filtrar anúncio/promoção" style="flex:1"><select id="ft"><option value="">Todos os tipos</option>${tipos.map(t => `<option>${esc(t)}</option>`).join('')}</select>
          <select id="fst"><option value="candidate">Só candidatos</option><option value="">Todos</option><option value="started">Já participando</option></select>
          <label><input type="checkbox" id="fp"> só prejuízo</label> <label><input type="checkbox" id="fc"> só sem custo</label></div><div id="ls"></div></div>`;
    const draw = () => { const f = $('#fs').value.toLowerCase(), t = $('#ft').value, st = $('#fst').value, p = $('#fp').checked, sc = $('#fc').checked;
      const rows = pm.filter(x => (!f || (x.titulo + x.item + x.promo + (x.nome || '')).toLowerCase().includes(f)) && (!t || x.tipo === t) && (!st || x.statusItem === st) && (!p || (x.margemPromo != null && x.margemPromo < 0)) && (!sc || x.margemPromo == null)).slice(0, 400);
      $('#ls').innerHTML = `<p style="color:var(--mut)">${rows.length} linhas${rows.length === 400 ? ' (máx. 400)' : ''}. Comissão: tarifa exata do ML no preço promocional (/listing_prices, já inclui a tarifa fixa quando existe). Frete = média real por unidade do anúncio nos últimos 90 dias; quando o preço promocional cruza R$ 79 (muda a regra do frete grátis) ou o anúncio não vendeu em 90 dias, usa a cotação do próprio ML no preço promocional. “~” = estimativa (faltou a tarifa ou a cotação).</p>` +
        tbl([{ t: 'Loja', f: ln }, { t: 'Promoção', f: x => `${esc(x.nome || x.promo)}<br><small style="color:var(--mut)">${esc(x.tipo)} · ${esc(x.statusItem)}</small>` }, { t: 'Anúncio', f: x => linkItem(x.item, x.titulo) },
          { t: 'Preço atual', n: 1, f: x => brl(x.precoAtual) }, { t: 'Preço promo', n: 1, f: x => `<b>${brl(x.precoPromo)}</b>` }, { t: 'Desc.', n: 1, f: x => x.desconto == null ? '' : pct(x.desconto) },
          { t: 'Comissão', n: 1, f: x => brl(x.comissao) }, { t: 'Frete', n: 1, f: x => `${x.estimado ? '~' : ''}${brl(x.frete)}<br><small style="color:var(--mut)" title="${x.freteFonte === 'cotacao' ? 'Cotação do próprio ML para 1 unidade neste preço' : x.freteFonte === 'media' ? 'Média real paga por unidade deste anúncio nos últimos 90 dias' : 'Sem vendas em 90 dias e sem cotação: média de frete da loja'}">${{ cotacao: 'cotação ML', media: 'média 90d', media_loja: 'média da loja' }[x.freteFonte] || ''}</small>${x.cruzaFaixa ? ' <small class="warn">cruza R$ 79</small>' : ''}` }, { t: 'Imposto', n: 1, f: x => brl(x.imposto) }, { t: 'Custo', n: 1, f: x => x.custo == null ? '<span class="warn">sem custo</span>' : brl(x.custo) },
          { t: 'Margem R$/un', n: 1, f: x => x.margemPromo == null ? '—' : `<b class="${x.margemPromo < 0 ? 'bad' : 'ok'}">${brl(x.margemPromo)}</b>` }, { t: 'Margem %', n: 1, f: x => x.margemPromoPct == null ? '—' : `<span class="${x.margemPromoPct < 0 ? 'bad' : ''}">${pct(x.margemPromoPct)}</span>` },
          { t: 'Margem atual/un', n: 1, f: x => x.margemAtualUn == null ? '' : brl(x.margemAtualUn) }, { t: 'Un. 90d', n: 1, f: x => num(x.unidades90) }], rows, 'tpm'); sortable('#tpm'); };
    ['#fs', '#fp', '#fc'].forEach(i => $(i).oninput = draw); ['#ft', '#fst'].forEach(i => $(i).onchange = draw); draw();
  },
});

// Menu: novas telas logo depois de "Lucro real"; selo de alertas
MENU.splice(1, 0, ['alertas', 'Alertas'], ['dre', 'Financeiro (DRE)'], ['devolucoes', 'Devoluções']);
fetch('api/alertas?loja=all').then(r => r.json()).then(a => {
  window.NALERTA = a.filter(x => x.nivel === 'alta').length; if (typeof montaAbas === 'function') montaAbas((location.hash.slice(1) || 'lucro').split(':')[0]);
}).catch(() => {});
