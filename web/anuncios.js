// Gestão Mercado Livre › Gestão de anúncios: a tela de anúncios do ML dentro do sistema, com custo, margem, quanto sobra em cada preço,
// preço mínimo pela margem que você escolher e cobertura de estoque. Ações por anúncio (ficha de edição) e em massa (pela tela ou por planilha).
// Carregado depois de acoes.js (reaproveita $, api, getJ, brl, num, pc, esc, ic, kpi, thumb, mgPill, canalChip, confirmaAcao, postAcao, avisoAcao, lerArquivos).
(() => {
  document.head.insertAdjacentHTML('beforeend', `<style>
#anb td{vertical-align:middle}#anb tr.sel td{background:var(--ac2)}#anb small{display:block;color:var(--mut);font-size:11px}#anb .pr b{max-width:280px}
.an-q{display:inline-block;min-width:34px;text-align:center;border-radius:6px;padding:1px 6px;font-weight:700;font-size:12px}.an-q.b{background:#dcfce7;color:#15803d}.an-q.m{background:#fef3c7;color:#b45309}.an-q.r{background:#fee2e2;color:#b91c1c}
.an-alvo{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--tx2)}.an-alvo input{width:56px;padding:5px 6px}
.an-ed .fl input{width:120px;text-align:right}.an-fotos{display:flex;flex-wrap:wrap;gap:8px}.an-fotos div{position:relative;width:76px}.an-fotos img{width:76px;height:76px;object-fit:cover;border-radius:8px;box-shadow:0 0 0 1px var(--bd)}
.an-fotos span{display:flex;justify-content:center;gap:2px}.an-fotos button{background:none;border:0;color:var(--mut);cursor:pointer;font-size:13px;padding:0 3px}.an-fotos button:hover{color:var(--tx1)}
.an-at{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}.an-at label{font-size:11.5px;color:var(--mut);display:flex;flex-direction:column;gap:2px}.an-at label.ob{color:var(--tx1);font-weight:600}
.an-fila{max-height:260px;overflow:auto;font-size:12.5px;margin-top:8px}.an-fila div{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding:4px 0}
@media(max-width:700px){.an-at{grid-template-columns:1fr}}
</style>`);

  ICO.anuncios = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>';
  const g = GRUPOS.find(x => x.n === 'Gestão Mercado Livre');
  if (g && !g.tabs.some(t => t[0] === 'anuncios')) g.tabs.unshift(['anuncios', 'Gestão de anúncios']);
  SUB.anuncios = 'Seus anúncios do Mercado Livre com custo, margem e preço mínimo, e as ações: pausar, preço, estoque, título, fotos, ficha técnica';
  NOTA.anuncios = 'Vendas e margem dos últimos 30 dias';

  const lerAlvo = () => { try { return Number(localStorage.getItem('anuncios_alvo')) || 15; } catch { return 15; } };
  const F = { q: '', conta: '', st: 'active', lg: '', tipo: '', card: '' };
  let D = null, sel = new Set(), alvo = lerAlvo();
  // conta de um preço: o que o ML repassa, o lucro e a margem (estimativa com a comissão, frete e Ads por unidade do anúncio)
  const contaPreco = (c, p) => { const recebe = p - p * c.com - c.fixa - (c.frete || 0); const lucro = c.custo == null ? null : recebe - p * c.imp - c.custo - c.ads; return { recebe, lucro, margem: lucro == null || !p ? null : lucro / p }; };
  const precoMin = (c, m) => { if (c.custo == null) return null; const d = 1 - c.com - c.imp - m; return d > 0.05 ? (c.custo + (c.frete || 0) + c.fixa + c.ads) / d : null; };
  const qual = q => !q ? '<small>—</small>' : `<span class="an-q ${q.score >= 75 ? 'b' : q.score >= 50 ? 'm' : 'r'}" title="Qualidade do anúncio no ML">${q.score}</span>`;
  const k = x => `${x.loja}|${x.id}`;

  VIEWS.anuncios = async function () {
    sel = new Set(); D = await api('anuncios/lista');
    $('#view').innerHTML = `<div class="kgrid" id="ank"></div>
      <div class="flt" style="margin-top:0"><div class="vd-f">
        <label style="flex:1;min-width:200px">Buscar<input type="search" id="anq" placeholder="Título, código MLB ou SKU"></label>
        <label>Conta<select id="anc"><option value="">Todas</option>${D.lojas.map(l => `<option value="${esc(l.loja)}">${esc(l.nome)}</option>`).join('')}</select></label>
        <label>Situação<select id="ans"><option value="active">Ativos</option><option value="paused">Pausados</option><option value="closed">Finalizados</option><option value="">Todos</option></select></label>
        <label>Entrega<select id="anl"><option value="">Todas</option><option>Padrão</option><option>Flex</option><option>Full</option></select></label>
        <label>Tipo<select id="ant"><option value="">Todos</option><option>Clássico</option><option>Premium</option></select></label>
        <span class="an-alvo">Margem mínima <input id="ana" inputmode="decimal" value="${alvo}">%</span></div></div>
      <div class="vd-bar"><span class="n" id="ani"></span>
        <button class="btn2" id="anx">${ic('down', 13)}Planilha</button><label class="btn2" style="cursor:pointer">Importar planilha<input type="file" id="anf" accept=".csv,.txt" hidden></label>
        <button class="btn2" data-m="pausar" disabled>Pausar</button><button class="btn2" data-m="reativar" disabled>Reativar</button><button class="btn2" data-m="preco" disabled>Preço</button><button class="btn2" data-m="estoque" disabled>Estoque</button></div>
      <div class="box"><div class="tw" style="max-height:none"><table class="rt"><thead><tr><th style="width:28px"><input type="checkbox" id="anall"></th><th>Anúncio</th><th class="n">Preço</th><th class="n">Estoque</th>
        <th class="n">30 dias</th><th class="c">Qualidade</th><th>Catálogo</th><th class="n">Margem</th><th class="n">Preço mínimo</th><th></th></tr></thead><tbody id="anb"></tbody></table></div></div>`;
    $('#ans').value = F.st; $('#anc').value = F.conta; $('#anl').value = F.lg; $('#ant').value = F.tipo; $('#anq').value = F.q;
    const muda = () => { F.q = $('#anq').value.trim().toLowerCase(); F.conta = $('#anc').value; F.st = $('#ans').value; F.lg = $('#anl').value; F.tipo = $('#ant').value; desenha(); };
    for (const id of ['#anc', '#ans', '#anl', '#ant']) $(id).onchange = muda; $('#anq').oninput = muda;
    $('#ana').onchange = () => { alvo = Math.min(Math.max(Number($('#ana').value.replace(',', '.')) || 0, 0), 80); $('#ana').value = alvo; try { localStorage.setItem('anuncios_alvo', alvo); } catch { /* só nesta visita */ } desenha(); };
    $('#ank').onclick = e => { const c = e.target.closest('[data-cd]'); if (!c) return; F.card = F.card === c.dataset.cd ? '' : c.dataset.cd; if (F.card) { F.st = c.dataset.cd === 'pausados' ? 'paused' : ''; $('#ans').value = F.st; } desenha(); };
    $('#anb').onchange = e => { const c = e.target.closest('input[data-s]'); if (!c) return; c.checked ? sel.add(c.dataset.s) : sel.delete(c.dataset.s); c.closest('tr').classList.toggle('sel', c.checked); barra(); };
    $('#anb').onclick = e => { const b = e.target.closest('[data-ed]'); if (b) { const [l, i] = b.dataset.ed.split('|'); abreEdicao(l, i); } };
    $('#anall').onchange = e => { for (const x of filtrados().slice(0, 400)) e.target.checked ? sel.add(k(x)) : sel.delete(k(x)); desenha(); };
    document.querySelectorAll('.vd-bar [data-m]').forEach(b => b.onclick = () => massa(b.dataset.m));
    $('#anx').onclick = planilha; $('#anf').onchange = importa;
    desenha();
  };

  const CARDS = { ativos: x => x.status === 'active', pausados: x => x.status === 'paused', semEstoque: x => x.status !== 'closed' && x.lg !== 'Full' && !x.estoque, qualidade: x => x.status === 'active' && x.qualidade && x.qualidade.score < 60,
    semCusto: x => x.status === 'active' && x.conta.custo == null, catalogo: x => x.status === 'active' && x.catalogo?.status && x.catalogo.status !== 'winning', repor: x => x.status === 'active' && x.sugFull > 0,
    margem: x => { if (x.status !== 'active') return false; const m = contaPreco(x.conta, x.venda).margem; return m != null && m < alvo / 100; } };
  function filtrados() {
    return D.itens.filter(x => (!F.st || x.status === F.st) && (!F.conta || x.loja === F.conta) && (!F.lg || x.lg === F.lg) && (!F.tipo || x.tipo === F.tipo) && (!F.card || CARDS[F.card](x))
      && (!F.q || `${x.titulo} ${x.id} ${x.sku || ''}`.toLowerCase().includes(F.q)));
  }
  function desenha() {
    const C = D.cards, nm = D.itens.filter(CARDS.margem).length, cd = (id, t, v, s, i, cor) => `<div data-cd="${id}" style="cursor:pointer${F.card === id ? ';outline:2px solid var(--ac);border-radius:14px' : ''}">${kpi(t, num(v), s, i, cor)}</div>`;
    $('#ank').innerHTML = cd('ativos', 'Ativos', C.ativos, `${num(C.pausados)} pausado(s)`, 'itens', 'blue') + cd('semEstoque', 'Sem estoque', C.semEstoque, 'pausam sozinhos no ML', 'alertas', C.semEstoque ? 'red' : 'green')
      + cd('margem', 'Abaixo da margem', nm, `menos de ${alvo}% no preço de hoje`, 'abc', nm ? 'red' : 'green') + cd('qualidade', 'Qualidade a melhorar', C.qualidade, 'nota abaixo de 60 no ML', 'reputacao', C.qualidade ? 'amber' : 'green')
      + cd('catalogo', 'Catálogo sem ganhar', C.catalogo, 'outro vendedor leva a venda', 'catalogo', C.catalogo ? 'amber' : 'slate') + cd('semCusto', 'Sem custo', C.semCusto, 'margem não calculada', 'custos', C.semCusto ? 'red' : 'slate')
      + cd('repor', 'Repor no Full', C.repor, 'estoque do Full para menos de 30 dias', 'envios', C.repor ? 'amber' : 'slate');
    const L = filtrados(), m = alvo / 100;
    $('#ani').textContent = `${num(L.length)} anúncio(s)${L.length > 400 ? ' · mostrando os 400 primeiros' : ''}${sel.size ? ` · ${sel.size} selecionado(s)` : ''}`;
    $('#anb').innerHTML = L.slice(0, 400).map(x => { const c = x.conta, cp = contaPreco(c, x.venda), pm = precoMin(c, m), s = k(x);
      return `<tr${sel.has(s) ? ' class="sel"' : ''}><td><input type="checkbox" data-s="${esc(s)}"${sel.has(s) ? ' checked' : ''}></td>
        <td><div class="pr">${thumb(x.thumb)}<div><b title="${esc(x.titulo)}">${esc(x.titulo)}</b><small>${esc(x.id)}${x.sku ? ` · ${esc(x.sku)}` : ''} · ${esc(x.nomeLoja)} · ${esc(x.tipo)}<span class="lgt ${esc(x.lg)}">${esc(x.lg)}</span></small>
          <small>${x.status !== 'active' ? `<span class="${x.status === 'paused' ? 'warn' : 'bad'}">${esc(x.statusTxt)}</span>` : ''}${x.sub.length ? ` ${esc(x.sub.join(', '))}` : ''}${x.automatico ? ' · <span title="Ajuste automático de preço ligado no ML">preço automático</span>' : ''}${x.variacoes ? ` · ${x.variacoes} variações` : ''}</small></div></div></td>
        <td class="n"><b>${brl(x.venda)}</b>${x.promo ? `<small><s>${brl(x.preco)}</s> promoção</small>` : ''}<small title="Preço − comissão − tarifa fixa − frete por unidade">recebe ${brl(cp.recebe)}</small></td>
        <td class="n">${x.lg === 'Full' ? `<b>${num(x.full ?? 0)}</b><small>no Full</small>` : `<b class="${x.estoque ? '' : 'bad'}">${num(x.estoque)}</b>`}${x.cobertura != null ? `<small>${x.cobertura > 365 ? '+1 ano' : `${num(x.cobertura)} dias`}</small>` : ''}${x.sugFull ? `<small class="warn">mandar ${num(x.sugFull)}</small>` : ''}</td>
        <td class="n"><b>${num(x.v30)}</b> <small>vendas</small><small>${num(x.visitas30)} visitas${x.conversao != null ? ` · ${pc(x.conversao, 1)}` : ''}</small></td>
        <td class="c">${qual(x.qualidade)}</td>
        <td>${x.catalogo ? `<span class="tag ${x.catalogo.status === 'winning' ? 'ok' : x.catalogo.status ? 'warn' : ''}">${esc(x.catalogo.txt)}</span>${x.catalogo.ptw && x.catalogo.status !== 'winning' ? `<small>ganha com ${brl(x.catalogo.ptw)}</small>` : ''}` : '<small>—</small>'}</td>
        <td class="n">${cp.margem != null ? mgPill(cp.margem, false) : '<small class="warn">sem custo</small>'}${x.margem30 != null ? `<small title="Margem real das vendas dos últimos 30 dias">30 dias ${pc(x.margem30, 0)}</small>` : ''}</td>
        <td class="n">${pm != null ? `<b class="${x.venda < pm ? 'bad' : ''}">${brl(pm)}</b>` : '—'}${c.frete == null ? '<small title="Sem vendas em 30 dias: frete não entra">sem frete</small>' : ''}</td>
        <td><button class="btn2" data-ed="${esc(s)}" style="padding:5px 10px;font-size:12px">Editar</button></td></tr>`; }).join('') || '<tr><td colspan="10" class="empty">Nenhum anúncio aqui.</td></tr>';
    $('#anall').checked = L.length > 0 && L.slice(0, 400).every(x => sel.has(k(x)));
    barra();
  }
  const barra = () => document.querySelectorAll('.vd-bar [data-m]').forEach(b => { b.disabled = !sel.size; });
  const doItem = s => D.itens.find(x => k(x) === s);

  // ───────── fila de ações (massa e planilha): uma por vez, no ritmo que o ML aceita ─────────
  async function fila(titulo, tarefas) {
    document.getElementById('acm')?.remove();
    const d = document.createElement('div'); d.id = 'acm';
    d.innerHTML = `<div class="cx"><h4>${esc(titulo)}</h4><div class="co"><div id="anp">0 de ${tarefas.length}</div><div class="an-fila" id="anr"></div></div><div class="ro"><button class="btn2" id="anpar">Parar</button></div></div>`;
    document.body.appendChild(d); let parar = false, ok = 0; $('#anpar').onclick = () => { if ($('#anpar').textContent === 'Fechar') d.remove(); else parar = true; };
    for (const [i, t] of tarefas.entries()) {
      if (parar) break;
      let r; try { await postAcao('api/anuncios/acao', t.corpo); ok++; r = '<span class="ok">feito</span>'; } catch (e) { r = `<span class="bad">${esc(e.message)}</span>`; }
      $('#anr').insertAdjacentHTML('afterbegin', `<div><span>${esc(t.nome)}</span>${r}</div>`); $('#anp').textContent = `${i + 1} de ${tarefas.length} · ${ok} feito(s)`;
      await new Promise(res => setTimeout(res, 350));
    }
    $('#anpar').textContent = 'Fechar'; avisoAcao(`${ok} de ${tarefas.length} alteração(ões) feitas no Mercado Livre.`, ok < tarefas.length);
    try { D = await api('anuncios/lista'); sel.clear(); desenha(); } catch { /* a próxima visita atualiza */ }
  }
  async function massa(m) {
    const L = [...sel].map(doItem).filter(Boolean); if (!L.length) return;
    if (m === 'pausar' || m === 'reativar') {
      const alvoSt = m === 'pausar' ? 'paused' : 'active', V = L.filter(x => x.status !== alvoSt && x.status !== 'closed');
      if (!V.length) return avisoAcao(`Nenhum dos selecionados precisa ${m === 'pausar' ? 'ser pausado' : 'ser reativado'}.`, true);
      if (!await confirmaAcao({ titulo: m === 'pausar' ? 'Pausar anúncios' : 'Reativar anúncios', texto: `${V.length} anúncio(s) ${m === 'pausar' ? 'deixam de aparecer no Mercado Livre até você reativar' : 'voltam a aparecer no Mercado Livre'}.`, previa: V.map(x => `${x.id} · ${x.titulo}`).join('\n'), botao: m === 'pausar' ? 'Pausar' : 'Reativar' })) return;
      return fila(m === 'pausar' ? 'Pausando anúncios' : 'Reativando anúncios', V.map(x => ({ nome: `${x.id} · ${x.titulo}`, corpo: { loja: x.loja, id: x.id, acao: 'status', status: alvoSt } })));
    }
    if (m === 'preco') {
      const v = prompt('Novo preço para os selecionados.\nUse um valor (ex.: 89,90) ou uma variação em % (ex.: +5% ou -10%):'); if (!v) return;
      const pctM = v.trim().match(/^([+-]?\d+(?:[.,]\d+)?)\s*%$/), val = Number(v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
      const novo = x => Math.round((pctM ? x.preco * (1 + Number(pctM[1].replace(',', '.')) / 100) : val) * 100) / 100;
      if (!pctM && !(val > 0)) return avisoAcao('Valor inválido.', true);
      const V = L.filter(x => x.status !== 'closed' && novo(x) > 0 && novo(x) !== x.preco);
      if (!await confirmaAcao({ titulo: 'Mudar preço', texto: `${V.length} anúncio(s). Confira a margem de cada um com o novo preço:`, botao: 'Mudar preços',
        previa: V.map(x => { const n = novo(x), mg = contaPreco(x.conta, n).margem; return `${x.id} · ${brl(x.preco)} → ${brl(n)}${mg != null ? ` (margem ${pc(mg, 0)})` : ''}`; }).join('\n') })) return;
      return fila('Mudando preços', V.map(x => ({ nome: `${x.id} · ${brl(novo(x))}`, corpo: { loja: x.loja, id: x.id, acao: 'preco', preco: novo(x) } })));
    }
    if (m === 'estoque') {
      const V = L.filter(x => x.lg !== 'Full' && x.status !== 'closed' && !x.variacoes); if (!V.length) return avisoAcao('Nenhum selecionado aceita estoque em massa (Full e anúncios com variações são editados um por um).', true);
      const v = prompt(`Estoque para ${V.length} anúncio(s) (Full e anúncios com variações ficam de fora):`); if (v == null || v === '') return; const q = Math.floor(Number(v)); if (!(q >= 0)) return avisoAcao('Quantidade inválida.', true);
      if (!await confirmaAcao({ titulo: 'Mudar estoque', texto: `${V.length} anúncio(s) passam a ter <b>${num(q)}</b> unidade(s) disponíveis.`, previa: V.map(x => `${x.id} · ${num(x.estoque)} → ${num(q)}`).join('\n'), botao: 'Mudar estoque' })) return;
      return fila('Mudando estoque', V.map(x => ({ nome: `${x.id} · ${num(q)} un.`, corpo: { loja: x.loja, id: x.id, acao: 'estoque', quantidade: q } })));
    }
  }
  // planilha: as colunas Preço, Estoque e Situação podem ser editadas e importadas de volta
  function planilha() {
    const L = filtrados(), cel = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }, dec = v => v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ',');
    const cab = ['Conta', 'Anúncio', 'Título', 'SKU', 'Tipo', 'Entrega', 'Situação', 'Preço', 'Preço de venda', 'Estoque', 'Estoque Full', 'Vendas 30 dias', 'Visitas 30 dias', 'Qualidade', 'Margem no preço %', 'Preço mínimo'];
    const linhas = L.map(x => { const cp = contaPreco(x.conta, x.venda), pm = precoMin(x.conta, alvo / 100);
      return [x.loja, x.id, x.titulo, x.sku || '', x.tipo, x.lg, x.status === 'active' ? 'ativo' : x.status === 'paused' ? 'pausado' : 'finalizado', dec(x.preco), dec(x.venda), x.estoque, x.full ?? '', x.v30, x.visitas30, x.qualidade?.score ?? '', cp.margem != null ? dec(cp.margem * 100) : '', dec(pm)]; });
    const csv = '﻿' + [cab, ...linhas].map(l => l.map(cel).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `anuncios-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  async function importa() {
    const f = $('#anf').files[0]; $('#anf').value = ''; if (!f) return;
    const txt = (await f.text()).replace(/^﻿/, ''), sep = txt.split('\n')[0].includes(';') ? ';' : ',';
    const linhas = txt.split(/\r?\n/).filter(Boolean).map(l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); });
    const cab = linhas.shift().map(s => s.toLowerCase()), col = n => cab.indexOf(n);
    const cId = col('anúncio') >= 0 ? col('anúncio') : col('anuncio'), cConta = col('conta'), cP = col('preço') >= 0 ? col('preço') : col('preco'), cE = col('estoque'), cS = col('situação') >= 0 ? col('situação') : col('situacao');
    if (cId < 0) return avisoAcao('A planilha precisa da coluna "Anúncio" (use a planilha baixada aqui).', true);
    const numBR = s => Number(String(s).replace(/\./g, '').replace(',', '.')), tarefas = [], previa = [];
    for (const l of linhas) {
      const x = D.itens.find(i => i.id === l[cId] && (cConta < 0 || !l[cConta] || i.loja === l[cConta])); if (!x || x.status === 'closed') continue;
      if (cP >= 0 && l[cP] !== '' && Math.abs(numBR(l[cP]) - x.preco) > 0.004 && numBR(l[cP]) > 0) { tarefas.push({ nome: `${x.id} · preço ${brl(numBR(l[cP]))}`, corpo: { loja: x.loja, id: x.id, acao: 'preco', preco: numBR(l[cP]) } }); previa.push(`${x.id} · preço ${brl(x.preco)} → ${brl(numBR(l[cP]))}`); }
      if (cE >= 0 && l[cE] !== '' && x.lg !== 'Full' && !x.variacoes && Math.floor(numBR(l[cE])) !== x.estoque && numBR(l[cE]) >= 0) { tarefas.push({ nome: `${x.id} · estoque ${l[cE]}`, corpo: { loja: x.loja, id: x.id, acao: 'estoque', quantidade: Math.floor(numBR(l[cE])) } }); previa.push(`${x.id} · estoque ${num(x.estoque)} → ${l[cE]}`); }
      const st = cS >= 0 ? { ativo: 'active', pausado: 'paused' }[String(l[cS]).toLowerCase()] : null;
      if (st && st !== x.status) { tarefas.push({ nome: `${x.id} · ${l[cS]}`, corpo: { loja: x.loja, id: x.id, acao: 'status', status: st } }); previa.push(`${x.id} · ${x.status === 'active' ? 'ativo' : 'pausado'} → ${l[cS]}`); }
    }
    if (!tarefas.length) return avisoAcao('Nenhuma mudança encontrada na planilha (preço, estoque ou situação).', true);
    if (!await confirmaAcao({ titulo: 'Importar planilha', texto: `${tarefas.length} mudança(s) para enviar ao Mercado Livre:`, previa: previa.join('\n'), botao: 'Enviar mudanças' })) return;
    fila('Aplicando a planilha', tarefas);
  }

  // ───────── ficha de edição de um anúncio ─────────
  async function abreEdicao(loja, id) {
    $('#dt').textContent = `Anúncio ${id}`; $('#db').innerHTML = '<p style="color:var(--mut)">Lendo o anúncio no Mercado Livre…</p>'; $('#dw').classList.add('on');
    let A; try { A = await getJ(`api/anuncios/item?loja=${encodeURIComponent(loja)}&id=${encodeURIComponent(id)}`); } catch (e) { if (e !== STALE) $('#db').innerHTML = `<div class="note">${esc(e.message)}</div>`; return; }
    const sec = (t, h) => `<div class="fc-sec an-ed"><h5>${t}</h5>${h}</div>`, fl = (t, v) => `<div class="fl"><span>${t}</span><b>${v}</b></div>`;
    const C = A.conta, simula = p => { if (!C) return ''; const cp = contaPreco(C, p), pm = precoMin(C, alvo / 100);
      return `${fl('Você recebe', brl(cp.recebe))}${cp.lucro != null ? fl('Lucro por venda', `<span class="${cp.lucro < 0 ? 'bad' : 'ok'}">${brl(cp.lucro)}</span>`) + fl('Margem', mgPill(cp.margem, false)) : fl('Margem', '<small class="warn">cadastre o custo do SKU</small>')}${pm ? fl(`Preço mínimo para ${alvo}%`, brl(pm)) : ''}`; };
    $('#dt').textContent = A.titulo;
    $('#db').innerHTML = `<div class="fc-top">${canalChip('ml', A.loja)}<span class="tag ${A.status === 'active' ? 'ok' : 'warn'}">${A.status === 'active' ? 'Ativo' : A.status === 'paused' ? 'Pausado' : 'Finalizado'}</span><small style="color:var(--mut)">${esc(A.id)} · ${esc(A.tipo)} · ${esc(A.lg)} · ${num(A.vendidos)} vendidos</small>
        <a class="btn2" style="margin-left:auto;text-decoration:none" target="_blank" rel="noopener" href="${esc(A.link)}">${ic('ext', 13)}Ver anúncio</a></div>
      ${A.aoVivo ? '' : '<div class="note">Não consegui ler o anúncio ao vivo; mostrando a última cópia coletada.</div>'}
      ${A.status !== 'closed' ? sec('Situação', `<div class="vd-ac">${A.status === 'active' ? '<button class="btn2" data-st="paused">Pausar</button>' : '<button class="btn2" data-st="active">Reativar</button>'}<button class="btn2" data-st="closed" style="color:var(--bad)">Finalizar</button></div>`) : ''}
      ${sec('Preço', `${A.variacoes.length ? '<div class="fc-nota" style="margin:0 0 6px">Todas as variações ficam com o mesmo preço.</div>' : ''}${fl('Preço', `<input id="aep" inputmode="decimal" value="${A.preco.toFixed(2).replace('.', ',')}">`)}
        ${A.venda < A.preco ? `<div class="fc-nota" style="margin:0 0 4px">Em promoção agora: o comprador paga ${brl(A.venda)}.</div>` : ''}${A.catalogo?.ptw && A.catalogo.status !== 'winning' ? `<div class="fc-nota" style="margin:0 0 4px">Catálogo: ganha a venda com ${brl(A.catalogo.ptw)} <a class="lk" href="#" id="aeg">usar este preço</a></div>` : ''}
        <div id="aes">${simula(A.preco)}</div><div class="atm-ro"><span style="margin-right:auto"></span><button id="aepb">Salvar preço</button></div>`)}
      ${!A.full ? sec('Estoque', `${A.variacoes.length ? A.variacoes.map(v => fl(`${esc(v.nome)}${v.sku ? ` <small>${esc(v.sku)}</small>` : ''}`, `<input data-ve="${esc(v.id)}" inputmode="numeric" value="${v.estoque}">`)).join('')
          : A.depositos.length > 1 ? A.depositos.map(d => fl(`Depósito ${esc(d.store)}`, `<input data-de="${esc(d.store)}" inputmode="numeric" value="${d.qtd}">`)).join('') : fl('Disponível', `<input id="aeq" inputmode="numeric" value="${A.estoque}">`)}
        <div class="atm-ro"><span style="margin-right:auto"></span><button id="aeqb">Salvar estoque</button></div>`) : sec('Estoque', '<div class="fc-nota" style="margin:0">Anúncio Full: o estoque é o que está no centro do Mercado Livre.</div>')}
      ${sec('Título', A.podeTitulo ? `<input id="aet" maxlength="60" value="${esc(A.titulo)}" style="width:100%"><div class="atm-ro"><small id="aetn" style="color:var(--mut);margin-right:auto"></small><button id="aetb">Salvar título</button></div>` : `<b style="font-size:13px">${esc(A.titulo)}</b><div class="fc-nota">O Mercado Livre não deixa mudar o título de anúncio que já vendeu.</div>`)}
      ${sec('Fotos', `<div class="an-fotos" id="aef"></div><div class="atm-ro"><label class="btn2" style="cursor:pointer">${ic('down', 13)}Adicionar fotos<input type="file" id="aefn" accept=".jpg,.jpeg,.png,.webp" multiple hidden></label><small id="aefa" style="color:var(--mut);margin-right:auto"></small><button id="aefb">Salvar fotos</button></div>`)}
      ${sec('Descrição', `<textarea id="aed" style="width:100%;min-height:140px">${esc(A.descricao)}</textarea><div class="atm-ro"><span style="margin-right:auto"></span><button id="aedb">Salvar descrição</button></div>`)}
      ${A.atributos.length ? sec('Ficha técnica', `<div class="an-at">${A.atributos.map(a => `<label class="${a.obrigatorio ? 'ob' : ''}">${esc(a.nome)}${a.obrigatorio ? ' *' : ''}<input data-at="${esc(a.id)}" value="${esc(a.valor || '')}" list="al_${esc(a.id)}" placeholder="${a.unidade ? 'ex.: 10 ' + esc(a.unidade) : ''}">${a.opcoes.length ? `<datalist id="al_${esc(a.id)}">${a.opcoes.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}</label>`).join('')}</div>
        <div class="atm-ro"><small style="color:var(--mut);margin-right:auto">* obrigatório na categoria</small><button id="aeab">Salvar ficha técnica</button></div>`) : ''}
      ${A.upgrades.length ? sec('Tipo de anúncio', `${fl('Hoje', esc(A.tipo))}<div class="vd-ac">${A.upgrades.map(u => `<button class="btn2" data-tp="${esc(u.id)}">Mudar para ${esc(u.nome)}</button>`).join('')}</div><div class="fc-nota">Premium tem tarifa maior e parcelamento sem juros para o comprador.</div>`) : ''}
      ${A.pendencias.length ? sec(`Qualidade ${A.qualidade != null ? `· ${A.qualidade}` : ''}`, A.pendencias.map(p => `<div class="fl"><span>${esc(p.txt)}</span><small>${esc(p.grupo || '')}</small></div>`).join('')) : ''}`;
    const enviar = async (titulo, corpo, texto = '', perigo = '', marcar = '') => {
      if (!await confirmaAcao({ titulo, texto: `Anúncio ${esc(A.id)} (${esc(A.nomeLoja)})${texto ? ': ' + texto : '.'}`, perigo, marcar, botao: titulo })) return false;
      try { await postAcao('api/anuncios/acao', { loja: A.loja, id: A.id, ...corpo }); avisoAcao('Feito no Mercado Livre.'); D = await api('anuncios/lista').catch(() => D); if ($('#anb')) desenha(); return true; } catch (e) { avisoAcao(e.message, true); return false; }
    };
    const numBR = s => Number(String(s).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    $('#aep').oninput = () => { const p = numBR($('#aep').value); if (p > 0) $('#aes').innerHTML = simula(p); };
    $('#aeg')?.addEventListener('click', e => { e.preventDefault(); $('#aep').value = Number(A.catalogo.ptw).toFixed(2).replace('.', ','); $('#aep').oninput(); });
    $('#aepb').onclick = () => { const p = numBR($('#aep').value); if (!(p > 0)) return avisoAcao('Preço inválido.', true); const mg = C ? contaPreco(C, p).margem : null;
      enviar('Salvar preço', { acao: 'preco', preco: p }, `${brl(A.preco)} → <b>${brl(p)}</b>${mg != null ? ` (margem ${pc(mg, 0)})` : ''}`, mg != null && mg < 0 ? 'Com esse preço a venda dá prejuízo.' : ''); };
    $('#aeqb')?.addEventListener('click', () => {
      const vs = [...document.querySelectorAll('[data-ve]')].map(i => ({ id: i.dataset.ve, qtd: i.value })), ds = [...document.querySelectorAll('[data-de]')].map(i => ({ store: i.dataset.de, qtd: i.value }));
      enviar('Salvar estoque', vs.length ? { acao: 'estoque', variacoes: vs } : ds.length ? { acao: 'estoque', depositos: ds } : { acao: 'estoque', quantidade: $('#aeq').value },
        vs.length ? vs.map((v, i) => `${esc(A.variacoes[i].nome)}: ${esc(v.qtd)}`).join(', ') : ds.length ? ds.map(d => `depósito ${esc(d.store)}: ${esc(d.qtd)}`).join(', ') : `${num(A.estoque)} → <b>${esc($('#aeq').value)}</b> unidade(s)`);
    });
    document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const st = b.dataset.st;
      enviar(st === 'paused' ? 'Pausar' : st === 'active' ? 'Reativar' : 'Finalizar', { acao: 'status', status: st }, st === 'paused' ? 'deixa de aparecer até você reativar' : st === 'active' ? 'volta a aparecer no Mercado Livre' : '',
        st === 'closed' ? 'Anúncio finalizado não volta: para vender de novo é preciso republicar.' : '', st === 'closed' ? 'Entendi que não dá para desfazer' : '').then(ok => ok && abreEdicao(A.loja, A.id)); });
    if ($('#aet')) { const n = () => { $('#aetn').textContent = `${$('#aet').value.length}/60`; }; $('#aet').oninput = n; n();
      $('#aetb').onclick = () => enviar('Salvar título', { acao: 'titulo', titulo: $('#aet').value.trim() }, `<b>${esc($('#aet').value.trim())}</b>`); }
    $('#aedb').onclick = () => enviar('Salvar descrição', { acao: 'descricao', texto: $('#aed').value }, 'a descrição do anúncio é trocada pelo texto novo');
    $('#aeab')?.addEventListener('click', () => { const mud = [...document.querySelectorAll('[data-at]')].filter(i => i.value.trim() !== (A.atributos.find(a => a.id === i.dataset.at).valor || '')).map(i => ({ id: i.dataset.at, valor: i.value.trim() }));
      if (!mud.length) return avisoAcao('Nada mudou na ficha técnica.', true);
      enviar('Salvar ficha técnica', { acao: 'ficha', atributos: mud }, mud.map(m => `${esc(A.atributos.find(a => a.id === m.id).nome)}: <b>${esc(m.valor || '(vazio)')}</b>`).join(', ')); });
    document.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => enviar('Mudar tipo de anúncio', { acao: 'tipo', tipo: b.dataset.tp }, `${esc(A.tipo)} → <b>${esc(b.textContent.replace('Mudar para ', ''))}</b>`, 'A tarifa de venda muda junto com o tipo.').then(ok => ok && abreEdicao(A.loja, A.id)));
    // fotos: reordenar, tirar e adicionar
    let fotos = A.fotos.map(f => ({ ...f }));
    const desenhaFotos = () => { $('#aef').innerHTML = fotos.map((f, i) => `<div><img src="${esc(f.url)}" alt=""><span><button data-fm="${i}|-1" title="Antes">◀</button><button data-fm="${i}|x" title="Tirar">✕</button><button data-fm="${i}|1" title="Depois">▶</button></span></div>`).join('') || '<small style="color:var(--mut)">Sem fotos.</small>'; };
    $('#aef').onclick = e => { const b = e.target.closest('[data-fm]'); if (!b) return; const [i, m] = b.dataset.fm.split('|'), n = +i;
      if (m === 'x') fotos.splice(n, 1); else { const j = n + Number(m); if (j >= 0 && j < fotos.length) [fotos[n], fotos[j]] = [fotos[j], fotos[n]]; } desenhaFotos(); };
    $('#aefn').onchange = () => { $('#aefa').textContent = [...$('#aefn').files].map(f => f.name).join(', '); };
    $('#aefb').onclick = async () => { const novas = [...$('#aefn').files];
      if (!fotos.length && !novas.length) return avisoAcao('O anúncio precisa de pelo menos uma foto.', true);
      let arqs; try { arqs = await lerArquivos(novas, 10); } catch (e) { return avisoAcao(e.message, true); }
      if (await enviar('Salvar fotos', { acao: 'fotos', ordem: fotos.map(f => f.id), novas: arqs }, `${fotos.length} foto(s) na ordem escolhida${novas.length ? ` e ${novas.length} nova(s) no fim` : ''}`)) abreEdicao(A.loja, A.id); };
    desenhaFotos();
  }
  window.abreAnuncio = abreEdicao;
})();
