// Telas adicionais: Alertas, Financeiro (DRE), Devoluções, Promoções com margem.
// Carregado depois do script principal; usa seus utilitários globais ($, api, tbl, brl, num, pct, dt, esc, ln, lv, mk, ch, sortable, LOJAS, MENU, VIEWS).
const card2 = (l, v, c = '') => `<div class="card"><div class="l">${l}</div><div class="v ${c}">${v}</div></div>`;
const linkItem = (id, txt) => `<a class="lk" target="_blank" rel="noopener" href="${mlUrl('item', id)}">${esc(txt ?? id)}</a>`;
const linkPedido = (id) => `<a class="lk" target="_blank" rel="noopener" href="${mlUrl('order', id)}">${esc(id)}</a>`;
const mesNome = m => { const [y, mm] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+mm - 1] + '/' + y.slice(2); };

// Período do DRE (hash dre:<arg>):
//   'Nm' = últimos N meses (1 a 60) · 'AAAA-MM' = um mês, com o anterior ao lado para comparar
//   'AAAA-MM~AAAA-MM' = intervalo de meses · 'AAAA-MM,AAAA-MM,...' = meses escolhidos, lado a lado
// Volta { sel, tipo: 'ultimos' | 'mes' | 'intervalo' | 'escolhidos', meses (os que entram nos totais), tabela (colunas, se diferente), de, ate (o que buscar no servidor) }
const somaMes = (m, n) => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const mesesDe = (a, b) => { const l = []; for (let m = a; m <= b && l.length < 60; m = somaMes(m, 1)) l.push(m); return l; };
function drePeriodo(arg) {
  const atual = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7), ehMes = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '') && s <= atual;
  const s = String(arg || ''), fim = P => ({ ...P, de: (P.tabela || P.meses)[0], ate: P.meses.at(-1) });
  const n = /^\d+m$/.test(s) ? parseInt(s) : 0;
  if (n >= 1 && n <= 60) return fim({ sel: s, tipo: 'ultimos', meses: mesesDe(somaMes(atual, 1 - n), atual) });
  if (ehMes(s)) return fim({ sel: s, tipo: 'mes', meses: [s], tabela: [somaMes(s, -1), s] });
  const [a, b] = s.split('~');
  if (ehMes(a) && ehMes(b)) { const [x, y] = a <= b ? [a, b] : [b, a]; if (x === y) return drePeriodo(x); const meses = mesesDe(x, y); return fim({ sel: `${x}~${meses.at(-1)}`, tipo: 'intervalo', meses }); }
  const lista = [...new Set(s.split(','))].filter(ehMes).sort();
  if (lista.length === 1) return drePeriodo(lista[0]);
  if (lista.length > 1) { const ok = lista.filter(m => m >= somaMes(lista.at(-1), -59)); return fim({ sel: ok.join(','), tipo: 'escolhidos', meses: ok }); }
  return drePeriodo('12m');
}
// Por que um mês do DRE não está fechado (vai no título da coluna, com ⚠, e na caixa acima da tabela).
// x = linha do mês já montada (pedidos, semFatura, sp); ml / shopee = canais que aparecem na tela.
// d.primeiroDia = 1º pedido do ML; d.shopee.primeiroDia / adsDesde = 1º pedido e 1º dia de Ads coletados da Shopee (só na versão com Shopee).
const dataBR = s => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;
// Mês inteiro dentro da série diária da API de Ads: a janela de 90 dias ou, desde d.adsDesde, o histórico que a coleta guarda
// (sem a chave adsDesde = servidor antigo: só a janela).
const adsCobre = (mes, d) => mes > new Date(Date.now() - 3 * 3600e3 - 89 * 864e5).toISOString().slice(0, 7) || (!!d.adsDesde && mes + '-01' >= d.adsDesde);
function avisosDoMes(x, d, { ml = true, shopee = true } = {}) {
  const a = [], atual = drePeriodo('1m').meses[0];
  const comecaNoMeio = dia => dia && x.mes === dia.slice(0, 7) && !dia.endsWith('-01');
  if (x.mes === atual) a.push('mês em andamento (valores parciais)');
  if (ml && comecaNoMeio(d.primeiroDia)) a.push(`pedidos do Mercado Livre só a partir de ${dataBR(d.primeiroDia)}`);
  if (ml && x.pedidos && x.semFatura) a.push(adsCobre(x.mes, d) ? 'sem fatura do Mercado Livre: outras cobranças (Full, DIFAL…) ficam de fora' : 'sem fatura do Mercado Livre: Ads e outras cobranças ficam de fora');
  const S = d.shopee;
  if (shopee && S && x.sp) {
    if (comecaNoMeio(S.primeiroDia)) a.push(`pedidos da Shopee só a partir de ${dataBR(S.primeiroDia)}`);
    // sem a chave adsDesde = servidor antigo (ainda não reiniciado): não avisa sobre Ads, para não avisar à toa
    const semAds = 'adsDesde' in S && (!S.adsDesde || x.mes < S.adsDesde.slice(0, 7));
    if (semAds) a.push('Ads da Shopee não coletado');
    else if (S.adsDesde && comecaNoMeio(S.adsDesde)) a.push(`Ads da Shopee só a partir de ${dataBR(S.adsDesde)}`);
  }
  return a;
}

// DRE com meses em colunas: seções escuras, subtotais em destaque e coluna de total (estilo Jodda). Linhas = {mes, receita, comissao, frete, imposto, custo, adsTotal, perdaDevolucao, outras, final, ...}
// cats = categorias de custo fixo (com elas, o DRE ganha a seção CUSTOS FIXOS e o lucro líquido; x.fixos = { categoria: valor }, x.liquido)
// total: false tira a coluna Total (DRE de um mês só, com o anterior ao lado)
// x.sp = mês da Shopee (só quando o servidor manda; a versão pública não manda): o DRE ganha a seção SHOPEE e o resultado soma os dois canais
//   (x.finalML = lucro do ML, x.final = ML + Shopee, x.receitaTotal / x.pedidosTotal = os dois canais)
function dreTabela(linhas, cats = [], { total = true, csv = false } = {}) {
  const L = linhas.slice().sort((a, b) => a.mes.localeCompare(b.mes)), comSp = L.some(x => x.sp);
  // com mais de 6 meses, valores sem "R$" e sem centavos (e espaçamento menor) para a tabela caber na tela
  const comp = L.length > 6, fm = comp ? v => (Math.round(v) || 0).toLocaleString('pt-BR') : brl;
  const sm = (k, f) => L.reduce((t, x) => t + f(x), 0);
  const mc = x => x.receita - x.comissao - x.frete - x.imposto - x.custo;
  const aj = x => (x.finalML ?? x.final) - (mc(x) - x.adsTotal - x.perdaDevolucao - x.outras); // reembolsos parciais, vendas mantidas por cobertura etc.
  const cel = (v, o = {}, x) => `<td class="n ${o.c || ''}">${o.pct ? pct(v) : o.neg ? (v ? '(−) ' + fm(Math.abs(v)) : fm(0)) : fm(v)}${o.nota && x ? o.nota(x) : ''}</td>`;
  const T = html => (total ? html : '');
  const secH = t => `<tr class="sec"><td colspan="${L.length + (total ? 2 : 1)}">${t}</td></tr>`;
  const rowH = (nome, f, o = {}) => `<tr class="${o.cls || ''}"><td class="lb">${nome}</td>${L.map(x => cel(f(x), o, x)).join('')}${T(cel(o.pct ? (o.tot ? o.tot() : 0) : sm(0, f), { ...o, nota: null }))}</tr>`;
  const eqH = (nome, f, ft) => `<tr class="eq"><td class="lb">${nome}</td>${L.map(x => `<td class="n">${f(x)}</td>`).join('')}${T(`<td class="n">${ft()}</td>`)}</tr>`;
  // csv: as mesmas linhas como listas de valores (números completos; deduções negativas) para a planilha
  const txt = h => { const e = document.createElement('div'); e.innerHTML = h; return e.textContent; };
  const vc = (v, o) => (o.neg ? -(v || 0) : v || 0);
  const { sec, row, eq } = csv ? {
    sec: t => [txt(t)],
    row: (nome, f, o = {}) => [txt(nome), ...L.map(x => vc(f(x), o)), ...(total ? [vc(sm(0, f), o)] : [])],
    eq: (nome, f, ft) => [txt(nome), ...L.map(f), ...(total ? [ft()] : [])],
  } : { sec: secH, row: rowH, eq: eqH };
  const rec = x => x.receitaTotal ?? x.receita, totRec = sm(0, rec), sp = (x, k) => x.sp?.[k] || 0;
  const ml = comSp ? 'MERCADO LIVRE · ' : '';
  const out = [
    sec(ml + 'RECEITA'),
    row('Receita bruta (já líquida de devoluções)', x => x.receita, { cls: 'sub' }),
    sec(ml + 'CUSTOS VARIÁVEIS'),
    row('(−) Comissão Mercado Livre', x => x.comissao, { neg: 1 }), row('(−) Frete pago pelo vendedor', x => x.frete, { neg: 1 }),
    row('(−) Imposto (Simples)', x => x.imposto, { neg: 1 }), row('(−) Custo dos produtos', x => x.custo, { neg: 1 }),
    row('(=) Margem de contribuição', mc, { cls: 'sub' }),
    sec(ml + 'DESPESAS E PERDAS'),
    row('(−) Ads (Product Ads)', x => x.adsTotal, { neg: 1, nota: x => `<br><small style="color:var(--mut)">${x.adsFonte}</small>` }), row('(−) Perda com devoluções', x => x.perdaDevolucao, { neg: 1 }), row('(−) Outras cobranças da fatura', x => x.outras, { neg: 1, nota: x => x.semFatura ? '<br><small style="color:var(--warn)">sem fatura</small>' : '' }),
    ...(L.some(x => Math.abs(aj(x)) > 0.5) ? [row('(±) Ajustes (reembolsos parciais / cobertura ML)', aj)] : []),
    ...(comSp ? [
      row('(=) Lucro Mercado Livre', x => x.finalML, { cls: 'sub' }),
      sec('SHOPEE'),
      row('Receita bruta', x => sp(x, 'receita'), { cls: 'sub' }),
      row('(−) Devoluções e reembolsos', x => sp(x, 'devolucao'), { neg: 1 }), row('(−) Comissão e taxas Shopee', x => sp(x, 'comissao'), { neg: 1 }),
      row('(−) Frete pago pelo vendedor', x => sp(x, 'frete'), { neg: 1 }),
      row('(±) Ajustes (cupons do vendedor, compensações)', x => -sp(x, 'ajustes')),
      row('(−) Imposto (Simples)', x => sp(x, 'imposto'), { neg: 1 }), row('(−) Custo dos produtos', x => sp(x, 'custo'), { neg: 1 }),
      row('(−) Ads Shopee', x => sp(x, 'ads'), { neg: 1 }),
      row('(=) Lucro Shopee', x => x.spLucro, { cls: 'sub' }),
    ] : []),
    sec('RESULTADO'),
    ...(comSp ? [row('Receita total (ML + Shopee)', rec)] : []),
    ...(cats.length ? [
      row(comSp ? '(=) Lucro das vendas (ML + Shopee)' : '(=) Lucro antes dos custos fixos', x => x.final, { cls: 'sub' }),
      sec('CUSTOS FIXOS'),
      ...cats.map(c => row(`(−) ${esc(c)}`, x => x.fixos[c] || 0, { neg: 1 })),
      row('(=) LUCRO LÍQUIDO', x => x.liquido, { cls: 'tot', c: '' }),
      eq('Margem líquida', x => pct(rec(x) ? x.liquido / rec(x) : 0), () => pct(totRec ? sm(0, x => x.liquido) / totRec : 0)),
    ] : [row(comSp ? '(=) LUCRO FINAL (ML + Shopee)' : '(=) LUCRO FINAL', x => x.final, { cls: 'tot', c: '' })]),
    eq(`Margem ${cats.length ? 'antes dos custos fixos' : 'final'}`, x => pct(x.margem), () => pct(totRec ? sm(0, x => x.final) / totRec : 0)),
    eq(comSp ? 'Pedidos (ML + Shopee)' : 'Pedidos', x => num(x.pedidosTotal ?? x.pedidos), () => num(sm(0, x => x.pedidosTotal ?? x.pedidos))),
  ];
  if (csv) return [['Demonstrativo', ...L.map(x => mesNome(x.mes)), ...(total ? ['Total'] : [])], ...out];
  // título do mês: 🔒 fechado, ⚠ incompleto (motivos ao passar o mouse)
  const thMes = x => { const t = [...(x.fechado ? [x.fechado.txt] : []), ...(x.avisos || [])];
    return `<th class="n"${t.length ? ` title="${esc(t.join(' · '))}"` : ''}>${mesNome(x.mes)}${x.fechado ? ' <span style="cursor:help">🔒</span>' : ''}${x.avisos?.length ? ' <span style="color:#f59e0b;cursor:help">⚠</span>' : ''}</th>`; };
  return `${comp ? '<p style="margin:0 0 6px;color:var(--mut);font-size:11.5px">Valores em R$, sem centavos (muitos meses na tabela).</p>' : ''}<div class="tw dre"><table id="tdre"${comp ? ' class="cmp"' : ''}><thead><tr><th>${'Demonstrativo'}</th>${L.map(thMes).join('')}${T('<th class="n">Total</th>')}</tr></thead><tbody>${out.join('')}</tbody></table></div>`;
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
  // arg (hash dre:<arg>): últimos N meses, um mês, intervalo ou meses escolhidos (ver drePeriodo)
  async dre(arg) {
    const P = drePeriodo(arg), sel = P.sel, umMes = P.tipo === 'mes';
    // FECH = fechamentos guardados; null = servidor ainda não tem a função (botões ficam escondidos)
    const [d, FECH] = await Promise.all([api('dre', `&de=${P.de}&ate=${P.ate}`), fetch('api/dre/fechamentos').then(r => (r.ok ? r.json() : null)).catch(() => null)]);
    const g = {}, mesVazio = mes => ({ mes, pedidos: 0, receita: 0, devolvido: 0, comissao: 0, frete: 0, imposto: 0, custo: 0, ads: 0, adsSemVenda: 0, lucro: 0, perdaDevolucao: 0, freteNF: 0 });
    d.porMes.forEach(x => { const o = g[x.mes] ||= mesVazio(x.mes);
      for (const k of Object.keys(o)) if (k !== 'mes') o[k] += x[k] || 0; });
    // Shopee (só quando o servidor manda): um mês por linha, já somadas as contas do filtro
    const spMes = Object.fromEntries((d.shopee?.porMes || []).map(x => [x.mes, x])), comSp = !!d.shopee;
    for (const m of Object.keys(spMes)) g[m] ||= mesVazio(m);
    // Cobranças da fatura do ML que NÃO são modeladas por pedido: Full (armazenagem/coleta/inconformidade), eShop, DIFAL e outras.
    // Fora daqui (já estão no lucro pedido a pedido ou não são custo):
    //  · comissão (CV*), frete (CXDE/CFFE/...) e Ads;
    //  · devolução (CXDED/CDSDB...) — já está na "perda com devoluções" de cada pedido (antes era contada duas vezes);
    //  · parcelamento (CFONPN) — acréscimo pago pelo COMPRADOR e repassado ao MP: soma zero para o vendedor (antes entrava como custo).
    const fat = {};
    d.faturas.forEach(f => { const o = fat[f.mes] ||= { n: 0, outras: 0, ads: 0, parcelamento: 0, devolucao: 0 };
      o.n++; o.outras += ['full', 'eshop', 'difal', 'outros'].reduce((t, k) => t + (f.classes[k] || 0), 0); o.ads += f.classes.ads || 0;
      o.parcelamento += f.classes.parcelamento || 0; o.devolucao += f.classes.devolucao || 0; });
    const todas = Object.values(g).sort((a, b) => a.mes.localeCompare(b.mes)).map(m => {
      const f = fat[m.mes];
      const coberto = adsCobre(m.mes, d);
      const adsApi = m.ads + m.adsSemVenda;
      const adsTotal = coberto || !f ? adsApi : f.ads; // fora da janela: o Product Ads da fatura (já líquido da bonificação BPAD)
      const outras = f ? f.outras : 0;
      // m.lucro já descontou m.ads (Ads ligado aos pedidos): soma de volta e desconta o total do mês uma vez só
      // (antes, no mês parcialmente coberto pela API, o Ads era descontado duas vezes: API + fatura)
      const finalML = m.lucro + m.ads - adsTotal - m.perdaDevolucao - outras;
      const sp = spMes[m.mes] || null, spLucro = sp ? sp.receita - sp.devolucao - sp.comissao - sp.frete - sp.ajustes - sp.imposto - sp.custo - sp.ads : 0;
      const final = finalML + spLucro, receitaTotal = m.receita + (sp ? sp.receita - sp.devolucao : 0);
      const fixos = d.fixos?.[m.mes] || {}, fixosTotal = Object.values(fixos).reduce((t, v) => t + v, 0);
      return { ...m, adsTotal, adsFonte: coberto || !f ? 'API' : 'fatura', outras, semFatura: !f, finalML, sp, spLucro, final, receitaTotal, pedidosTotal: m.pedidos + (sp?.pedidos || 0),
        impostoTotal: m.imposto + (sp?.imposto || 0), margem: receitaTotal ? final / receitaTotal : 0, fixos, fixosTotal, liquido: final - fixosTotal };
    });
    todas.forEach(x => { x.avisos = avisosDoMes(x, d); });
    // fechamento mensal: foto dos números do mês para o filtro da tela (loja e, na versão com Shopee, canal); avisa se algo mudou depois
    const filtroFech = $('#loja').value + (typeof canal === 'string' && canal !== 'ambos' ? '.' + canal : '');
    const filtroTxt = 'Loja: ' + ($('#loja').selectedOptions[0]?.text || 'Todas as lojas') + (typeof canal === 'string' ? ' · Canal: ' + ({ ambos: 'Mercado Livre + Shopee', ml: 'Mercado Livre', shopee: 'Shopee' })[canal] : '');
    const CAMPOS = { receitaTotal: 'Receita', comissao: 'Comissão', frete: 'Frete', imposto: 'Imposto', custo: 'Custo dos produtos', adsTotal: 'Ads', perdaDevolucao: 'Perda com devoluções', outras: 'Outras cobranças da fatura', spLucro: 'Lucro Shopee', final: 'Lucro das vendas', fixosTotal: 'Custos fixos', liquido: 'Lucro líquido', pedidosTotal: 'Pedidos' };
    const fotoMes = x => Object.fromEntries(Object.keys(CAMPOS).map(k => [k, Math.round((x[k] || 0) * 100) / 100]));
    todas.forEach(x => { const f = FECH?.[`${x.mes}|${filtroFech}`]; if (!f) return;
      const mud = Object.keys(CAMPOS).filter(k => k in f.linha && Math.abs((x[k] || 0) - f.linha[k]) > 0.5);
      x.fechado = { em: f.fechado_em, mud, foto: f.linha, txt: `fechado em ${new Date(f.fechado_em).toLocaleDateString('pt-BR')}${mud.length ? ' · mudou depois: ' + mud.map(k => CAMPOS[k]).join(', ') : ' · sem mudança desde então'}` }; });
    const BTN2 = 'background:#fff;color:var(--ac);border:1px solid var(--bd);padding:6px 12px;font-size:12px', tabOpts = { total: !(P.tipo === 'mes'), soShopee: typeof soSp === 'boolean' && soSp };
    // período escolhido: os cartões somam só ele; com um mês só, a tabela mostra também o mês anterior para comparar
    const linhas = todas.filter(x => P.meses.includes(x.mes));
    const tabela = P.tabela ? todas.filter(x => P.tabela.includes(x.mes)) : linhas;
    const nMeses = P.tipo === 'ultimos' ? linhas.length || P.meses.length : P.meses.length;
    const rot = umMes ? mesNome(sel) : P.tipo === 'intervalo' ? `${mesNome(P.meses[0])} a ${mesNome(P.meses.at(-1))}` : P.tipo === 'escolhidos' ? `${nMeses} meses escolhidos` : nMeses === 1 ? '1 mês' : `${nMeses} meses`;
    const tot = k => linhas.reduce((t, x) => t + x[k], 0), fats = d.faturas.filter(f => linhas.some(x => x.mes === f.mes));
    // categorias de custo fixo que aparecem nos meses do DRE, da maior para a menor
    const catTot = {}; tabela.forEach(x => Object.entries(x.fixos).forEach(([c, v]) => { catTot[c] = (catTot[c] || 0) + v; }));
    const cats = Object.keys(catTot).sort((a, b) => catTot[b] - catTot[a]), comFixos = cats.length > 0;
    const aviso = [];
    if (d.cobertura.pctReceitaSemCusto > 0.01) aviso.push(`${pct(d.cobertura.pctReceitaSemCusto)} da receita sem custo de produto cadastrado — lucro superestimado.`);
    if (d.shopee?.cobertura?.pctReceitaSemCusto > 0.01) aviso.push(`Shopee: ${pct(d.shopee.cobertura.pctReceitaSemCusto)} da receita sem custo de produto cadastrado — lucro superestimado.`);
    if (d.cobertura.pctReceitaFreteEstimado > 0.01) aviso.push(`${pct(d.cobertura.pctReceitaFreteEstimado)} da receita com frete estimado (coleta histórica ainda em andamento ou frete indisponível).`);
    // meses incompletos da tabela; meses seguidos com o mesmo aviso viram uma linha só ("nov/25 a jun/26: …")
    const comAviso = tabela.filter(x => x.avisos.length), blocos = [];
    for (const x of comAviso) { const txt = x.avisos.join('; '), u = blocos.at(-1);
      if (u && u.txt === txt && somaMes(u.ate, 1) === x.mes) u.ate = x.mes; else blocos.push({ de: x.mes, ate: x.mes, txt }); }
    for (const x of tabela.filter(x => x.fechado?.mud.length)) aviso.push(`<b>${mesNome(x.mes)} mudou depois do fechamento</b> (${new Date(x.fechado.em).toLocaleDateString('pt-BR')}): ` + x.fechado.mud.map(k => `${CAMPOS[k]} ${k === 'pedidosTotal' ? num(x.fechado.foto[k]) + ' → ' + num(x[k]) : brl(x.fechado.foto[k]) + ' → ' + brl(x[k])}`).join(' · ') + '. Se a mudança estiver certa, abra o mês e use “Atualizar fechamento”.');
    if (blocos.length) aviso.push(`<b>${comAviso.length > 1 ? 'Meses incompletos' : 'Mês incompleto'}</b>: o resultado ${comAviso.length > 1 ? 'desses meses' : 'deste mês'} ainda não está fechado.
      <ul style="margin:6px 0 0;padding-left:20px">${blocos.map(g => `<li><b>${g.de === g.ate ? mesNome(g.de) : `${mesNome(g.de)} a ${mesNome(g.ate)}`}</b>: ${esc(g.txt)}</li>`).join('')}</ul>`);
    // opções do período: atalhos, anos e meses desde o pedido mais antigo (até 60 meses), mais intervalo e meses escolhidos à mão
    const atual = drePeriodo('1m').meses[0], SEL = 'padding:7px 9px;border:1px solid var(--bd);border-radius:7px;font:inherit';
    const primeiro = [d.primeiroMes, todas[0]?.mes, somaMes(atual, -11)].filter(Boolean).sort()[0];
    const disp = mesesDe(primeiro < somaMes(atual, -59) ? somaMes(atual, -59) : primeiro, atual), anos = [...new Set(disp.map(m => m.slice(0, 4)))].reverse();
    const grupos = [['Atalhos', [['3m', 'Últimos 3 meses'], ['6m', 'Últimos 6 meses'], ['12m', 'Últimos 12 meses'], ...(disp.length > 12 ? [['24m', 'Últimos 24 meses']] : [])]],
      ['Ano', anos.map(a => [a, disp.filter(m => m.startsWith(a))]).filter(([, ms]) => ms.length > 1)
        .map(([a, ms]) => [`${ms[0]}~${ms.at(-1)}`, `Ano ${a}${a === atual.slice(0, 4) ? ' (até agora)' : ms.length < 12 ? ` (desde ${mesNome(ms[0])})` : ''}`])],
      ['Personalizado', [['intervalo', 'De um mês até outro…'], ['escolher', 'Escolher meses…']]],
      ['Um mês só', disp.slice().reverse().map(m => [m, `Só ${mesNome(m)}${m === atual ? ' (mês atual, parcial)' : ''}`])]];
    const valOpc = grupos.some(([, os]) => os.some(([v]) => v === sel)) ? sel : P.tipo === 'escolhidos' ? 'escolher' : 'intervalo';
    $('#view').innerHTML = `<div class="box" style="padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><label style="display:flex;align-items:center;gap:8px;font-weight:600">Período do DRE
        <select id="drep" style="${SEL}">${grupos.map(([n, os]) => `<optgroup label="${n}">${os.map(([v, t]) => `<option value="${v}" ${v === valOpc ? 'selected' : ''}>${esc(t)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        ${umMes ? `<small style="color:var(--mut)">a tabela mostra ${tabela.length > 1 ? `${mesNome(tabela[0].mes)} ao lado para comparar` : 'só este mês'}</small>` : ''}
        ${umMes && FECH && linhas[0] ? (linhas[0].fechado ? `<span style="color:var(--mut)">🔒 ${esc(linhas[0].fechado.txt)}</span><button id="drefecha" style="${BTN2}">Atualizar fechamento</button><button id="dreabre" style="${BTN2}">Reabrir</button>` : `<button id="drefecha" style="${BTN2}">🔒 Fechar ${mesNome(sel)}</button><small style="color:var(--mut)">guarda os números de agora para comparar depois</small>`) : ''}
        <div id="drex" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;flex-basis:100%"></div></div>`
      + aviso.map(a => `<div class="box" style="border-color:var(--warn);margin-bottom:10px">⚠ ${a}</div>`).join('') + `<div class="cards">
      ${card2(`Receita${comSp ? ' ML + Shopee' : ''} (${rot})`, brl(tot('receitaTotal')))}${comFixos
        ? card2(comSp ? 'Lucro das vendas (ML + Shopee)' : 'Lucro antes dos custos fixos', brl(tot('final')), tot('final') < 0 ? 'bad' : 'ok') + card2(`Custos fixos (${rot})`, '−' + brl(tot('fixosTotal')), 'warn')
          + card2(`Lucro líquido (${rot})`, brl(tot('liquido')), tot('liquido') < 0 ? 'bad' : 'ok') + card2('Margem líquida', pct(tot('receitaTotal') ? tot('liquido') / tot('receitaTotal') : 0))
        : card2(`Lucro final${comSp ? ' ML + Shopee' : ''} (${rot})`, brl(tot('final')), tot('final') < 0 ? 'bad' : 'ok') + card2('Margem final', pct(tot('receitaTotal') ? tot('final') / tot('receitaTotal') : 0))}
      ${card2(`Imposto (${rot})`, '−' + brl(tot('impostoTotal')))}${card2('Outras cobranças da fatura', '−' + brl(tot('outras')), 'warn')}
      ${card2(`Perda real com devoluções${comSp ? ' (ML)' : ''}`, tot('perdaDevolucao') >= 0 ? '−' + brl(tot('perdaDevolucao')) : '+' + brl(-tot('perdaDevolucao')), tot('perdaDevolucao') > 0 ? 'bad' : 'ok')}${card2(`Estornado em pedidos cancelados${comSp ? ' (ML)' : ''} <span title="Valor que voltou ao comprador nos pedidos cancelados com reembolso (a maioria cancelada antes do envio). Esses pedidos já estão fora da receita: não é prejuízo. O que você perdeu de fato está em “Perda real com devoluções”." style="cursor:help">ⓘ</span>`, brl(tot('devolvido')))}</div>
      ${umMes ? '' : `<div class="box" style="margin-bottom:14px"><h3>${comFixos ? 'Lucro líquido' : 'Lucro final'} e margem por mês</h3><div style="height:260px"><canvas id="c1"></canvas></div></div>`}
      <div class="box dre-imp" style="margin-bottom:14px"><h3 style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">${umMes ? `DRE de ${mesNome(sel)}` : `DRE mensal · ${rot}`} <small>(mês = data do pedido, fuso de Brasília)</small><span style="margin-left:auto;display:flex;gap:6px"><button id="drecsv" style="${BTN2}">Baixar planilha</button><button id="dreimp" style="${BTN2}">Imprimir / PDF</button></span></h3><p class="so-imp" style="margin:0 0 8px;color:var(--mut)">${esc(filtroTxt)} · gerado em ${new Date().toLocaleString('pt-BR')}</p>${dreTabela(tabela, cats, tabOpts)}
        <p style="color:var(--mut);margin:8px 0 0;font-size:12px">Receita já desconta devoluções (pedidos reembolsados saem da receita). Por isso o “estornado em pedidos cancelados” não é descontado de novo: o que entra no resultado é a perda real (frete, tarifa de devolução e comissão não estornados). “Outras (fatura)” = serviços do Full (armazenagem, coleta, inconformidade), eShop, DIFAL e cobranças não identificadas, líquidas das bonificações. <b>Não</b> entram aqui: a taxa de parcelamento (CFONPN — acréscimo pago pelo comprador e repassado ao Mercado Pago, soma zero para você) e as tarifas de devolução (já contadas pedido a pedido em “Perda devol.”). Ads: API de Ads nos meses inteiros cobertos pela série diária (os últimos 90 dias e os dias que o sistema guardou desde que passou a acumular o histórico); antes disso, o valor da fatura. Atenção: a fatura do ML é por <b>período de cobrança</b> (≈ dia 16 do mês anterior ao dia 15), não por mês-calendário — “Outras” e o Ads da fatura são aproximações do mês. O mês corrente usa a fatura ainda em aberto (parcial).${comSp ? ' Shopee: valores do extrato (escrow) de cada pedido pela data do pedido; Ads = gasto total do mês na Shopee (inclui dias sem venda); ajustes = cupons do vendedor, compensações e retenções.' : ''}${comFixos ? ' Custos fixos: valor do mês inteiro, inclusive no mês corrente (que ainda está com as vendas pela metade).' : ''}</p></div>
      <div class="box" style="margin-bottom:14px" id="cfbox"></div>
      <div class="box"><h3>Faturas do Mercado Livre (cobranças por tipo, já líquidas das bonificações)</h3>${fats.length ? fats.slice().reverse().map(f => `<details style="margin-bottom:6px"><summary style="cursor:pointer">${ln(f)} ${esc(f.grupo === 'MP' ? 'Mercado Pago' : 'Mercado Livre')} · fatura ${esc(f.key)} · <b>${brl(f.total)}</b>
        ${Object.entries(f.classes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="tag">${esc(k)} ${brl(v)}</span>`).join(' ')}</summary>
        ${tbl([{ t: 'Tipo', k: 'tipo' }, { t: 'Descrição', k: 'label' }, { t: 'Classe', k: 'classe' }, { t: 'Valor', n: 1, f: r => `<span class="${r.valor < 0 ? 'ok' : ''}">${brl(r.valor)}</span>` }], f.linhas)}</details>`).join('') : '<p style="color:var(--mut)">Fatura ainda não coletada (a coleta roda às 04:30 e é lenta: limite de 5 chamadas por minuto).</p>'}</div>`;
    if (!umMes) mk('#c1', { type: 'bar', data: { labels: linhas.map(x => mesNome(x.mes)), datasets: [{ type: 'line', label: 'Margem %', yAxisID: 'y2', borderColor: '#f59e0b', backgroundColor: '#f59e0b', data: linhas.map(x => +((comFixos ? (x.receitaTotal ? x.liquido / x.receitaTotal : 0) : x.margem) * 100).toFixed(1)) },
      { label: comFixos ? 'Lucro líquido' : 'Lucro final', backgroundColor: '#3ecf8e', data: linhas.map(x => comFixos ? x.liquido : x.final) }, { label: comSp ? 'Receita ML + Shopee' : 'Receita', backgroundColor: '#4da3ff55', data: linhas.map(x => x.receitaTotal) }] },
      options: { ...ch, scales: { ...ch.scales, y2: { position: 'right', ticks: { color: '#d97706', callback: v => v + '%' }, grid: { display: false } } } } });
    // sem await (o DRE já está na tela); STALE = o usuário trocou de tela antes de a caixa carregar
    custosFixos($('#cfbox'), () => VIEWS.dre(sel)).catch(e => { if (e !== STALE && $('#cfbox')) $('#cfbox').innerHTML = `<p class="bad" style="margin:0">Não foi possível carregar os custos fixos: ${esc(e.message)}</p>`; });
    // "De um mês até outro" e "Escolher meses" abrem uma linha com os campos; o resto já troca o período
    const vai = v => { location.hash = 'dre:' + v; };
    const painel = modo => {
      const box = $('#drex');
      if (modo === 'intervalo') {
        const op = (id, v) => `<select id="${id}" style="${SEL}">${disp.map(m => `<option value="${m}" ${m === v ? 'selected' : ''}>${mesNome(m)}</option>`).join('')}</select>`;
        box.innerHTML = `<b>De</b> ${op('drede', disp.includes(P.meses[0]) ? P.meses[0] : disp[0])} <b>até</b> ${op('dreate', disp.includes(P.meses.at(-1)) ? P.meses.at(-1) : atual)} <button id="drea">Ver período</button>`;
        $('#drea').onclick = () => vai(`${$('#drede').value}~${$('#dreate').value}`);
      } else if (modo === 'escolher') {
        const marc = new Set(P.tipo === 'escolhidos' || umMes ? P.meses : []);
        box.innerHTML = anos.map(a => `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex-basis:100%"><b style="min-width:40px">${a}</b>${disp.filter(m => m.startsWith(a)).map(m =>
          `<label class="tag" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px"><input type="checkbox" value="${m}" ${marc.has(m) ? 'checked' : ''}>${mesNome(m).slice(0, 3)}</label>`).join('')}</div>`).join('')
          + `<button id="drea">Ver meses marcados</button><small id="dream" style="color:var(--mut)">marque um ou mais meses: eles aparecem lado a lado, com o total só deles</small>`;
        $('#drea').onclick = () => { const ms = [...box.querySelectorAll('input:checked')].map(i => i.value); if (ms.length) vai(ms.join(',')); else $('#dream').innerHTML = '<b class="bad">marque pelo menos um mês</b>'; };
      } else box.innerHTML = '';
      box.style.display = box.innerHTML ? 'flex' : 'none';
    };
    painel(valOpc);
    $('#drep').onchange = () => { const v = $('#drep').value; if (v === 'intervalo' || v === 'escolher') painel(v); else vai(v); };
    // planilha: a mesma tabela com números completos (deduções negativas); separador ; e vírgula decimal (Excel em português)
    $('#drecsv').onclick = () => {
      const cel = c => (typeof c === 'number' ? c.toFixed(2).replace('.', ',') : `"${String(c ?? '').replace(/"/g, '""')}"`);
      const txt = '\uFEFF' + [[`DRE ${umMes ? mesNome(sel) : rot}`], [filtroTxt], [], ...dreTabela(tabela, cats, { ...tabOpts, csv: true })].map(r => r.map(cel).join(';')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
      a.download = `dre-${(umMes ? sel : rot).replace(/[^\w-]+/g, '-')}.csv`; a.click(); URL.revokeObjectURL(a.href);
    };
    $('#dreimp').onclick = () => { document.body.classList.add('imp-dre'); addEventListener('afterprint', () => document.body.classList.remove('imp-dre'), { once: true }); print(); };
    // fechar / atualizar / reabrir o mês da tela
    if ($('#drefecha')) $('#drefecha').onclick = async () => {
      const x = linhas[0];
      if (x.avisos.length && !confirm(`${mesNome(sel)} ainda está incompleto: ${x.avisos.join('; ')}.\n\nFechar mesmo assim?`)) return;
      const r = await fetch('api/dre/fechamentos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mes: sel, filtro: filtroFech, linha: fotoMes(x) }) });
      if (!r.ok) return alert((await r.json().catch(() => ({}))).erro || 'Não foi possível fechar o mês.');
      go();
    };
    if ($('#dreabre')) $('#dreabre').onclick = async () => {
      if (!confirm(`Reabrir ${mesNome(sel)}? A foto do fechamento é descartada; os números do mês continuam calculados normalmente.`)) return;
      await fetch(`api/dre/fechamentos/${sel}/${encodeURIComponent(filtroFech)}`, { method: 'DELETE' });
      go();
    };
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
