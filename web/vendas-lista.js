// Análise de Pedidos › Vendas: a lista de despacho do Mercado Livre dentro do sistema (envios de hoje, próximos dias, Full, em trânsito, finalizadas),
// com o resultado de cada venda, etiquetas em massa (PDF ou térmica) e planilha. Também as ações da ficha da venda: etiqueta, nota interna, NF-e e mensagem.
// Carregado depois de vendas.js e acoes.js (reaproveita $, api, getJ, brl, num, pc, esc, ic, kpi, thumb, mgPill, canalChip, abreFicha, confirmaAcao, postAcao, avisoAcao, lerArquivos).
(() => {
  document.head.insertAdjacentHTML('beforeend', `<style>
.vd-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.vd-bar .n{color:var(--mut);font-size:12.5px;margin-right:auto}
.vd-f{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.vd-f label{display:flex;flex-direction:column;gap:3px;font-size:10.5px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
.vd-f select,.vd-f input[type=search]{padding:6px 8px;font-size:12.5px}.vd-f .ck{flex-direction:row;align-items:center;gap:5px;text-transform:none;font-size:12.5px;color:var(--tx2);font-weight:500;letter-spacing:0;padding-bottom:6px}
#vdb td{vertical-align:middle}#vdb td.env{min-width:210px}#vdb .pr b{max-width:260px}#vdb tr{cursor:pointer}#vdb tr.sel td{background:var(--ac2)}#vdb .env small{display:block;color:var(--mut);font-size:11px}
.vd-ac{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.vd-ac .btn2{padding:5px 10px;font-size:12px}
.vd-nt{border-top:1px dashed var(--line);padding:5px 0;font-size:12.5px;color:var(--tx2);display:flex;gap:8px;justify-content:space-between;white-space:pre-wrap}.vd-nt small{color:var(--mut)}
.vd-nt button{background:none;border:0;color:var(--mut);cursor:pointer;padding:0 4px}.vd-nt button:hover{color:var(--bad)}
</style>`);

  ICO.vendas = '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 16v5h-5"/><path d="M3 16v5h5"/><rect x="7" y="7" width="10" height="10" rx="1"/>';
  const g = GRUPOS.find(x => x.n === 'Análise de Pedidos');
  if (g && !g.tabs.some(t => t[0] === 'vendas')) g.tabs.splice(g.tabs.findIndex(t => t[0] === 'aovivo') + 1, 0, ['vendas', 'Vendas']);
  SUB.vendas = 'Envios de hoje, próximos dias, Full, em trânsito e finalizadas, com o resultado de cada venda';
  NOTA.vendas = 'Últimos 45 dias · atualiza sozinho a cada minuto';

  const ABAS = [['hoje', 'Envios de hoje'], ['proximos', 'Próximos dias'], ['full', 'Full (o ML envia)'], ['transito', 'Em trânsito'], ['finalizadas', 'Finalizadas (30 dias)']];
  const quando = d => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const F = { aba: 'hoje', q: '', conta: '', log: '', sit: '', nf: '', rec: false, pub: false, prej: false };
  let D = null, sel = new Set(), timer = null;

  VIEWS.vendas = async function () {
    clearInterval(timer); sel = new Set();
    D = await api(`vendas/lista?aba=${F.aba}`);
    $('#view').innerHTML = `<div class="kgrid" id="vdk"></div><div class="chips" id="vda"></div>
      <div class="flt" style="margin-top:0"><div class="vd-f">
        <label style="flex:1;min-width:200px">Buscar<input type="search" id="vdq" placeholder="Nº da venda, produto, SKU ou comprador"></label>
        <label>Conta<select id="vdc"></select></label><label>Forma de entrega<select id="vdl"></select></label><label>Situação<select id="vds"></select></label>
        <label>NF-e<select id="vdn"><option value="">Todas</option><option value="emitida">Com nota</option><option value="falta">Falta anexar</option><option value="sem">Sem nota coletada</option></select></label>
        <label class="ck"><input type="checkbox" id="vdr"> Com reclamação</label><label class="ck"><input type="checkbox" id="vdp"> Vendas com publicidade</label><label class="ck"><input type="checkbox" id="vdx"> Com prejuízo</label></div></div>
      <div class="vd-bar"><span class="n" id="vdi"></span><button class="btn2" id="vdt">${ic('down', 13)}Baixar planilha</button>
        <button class="btn2" id="vdz" disabled>Etiquetas térmicas (ZPL)</button><button id="vde" disabled>${ic('pedidos', 13)}Imprimir etiquetas (PDF)</button></div>
      <div class="box"><div class="tw" style="max-height:none"><table class="rt"><thead><tr><th style="width:28px"><input type="checkbox" id="vdall" title="Selecionar as etiquetas liberadas"></th><th>Venda</th><th>Produto</th><th>Envio</th><th>NF-e</th>
        <th class="n">Total</th><th class="n">Frete</th><th class="n">Ads</th><th class="n">Resultado</th><th class="n">Margem</th></tr></thead><tbody id="vdb"></tbody></table></div></div>`;
    const v = (id, val) => { const el = $(id); el.value = val; return el; };
    $('#vdc').innerHTML = `<option value="">Todas</option>${D.lojas.map(x => `<option value="${esc(x.loja)}">${esc(x.nome)}</option>`).join('')}`;
    $('#vdl').innerHTML = `<option value="">Todas</option>${['Padrão', 'Flex', 'Full', ...(D.temShopee ? ['Shopee'] : [])].map(l => `<option>${esc(l)}</option>`).join('')}`;
    v('#vdq', F.q); v('#vdc', F.conta); v('#vdl', F.log); v('#vdn', F.nf); $('#vdr').checked = F.rec; $('#vdp').checked = F.pub; $('#vdx').checked = F.prej;
    const muda = () => { F.q = $('#vdq').value.trim().toLowerCase(); F.conta = $('#vdc').value; F.log = $('#vdl').value; F.sit = $('#vds').value; F.nf = $('#vdn').value; F.rec = $('#vdr').checked; F.pub = $('#vdp').checked; F.prej = $('#vdx').checked; desenha(); };
    for (const id of ['#vdc', '#vdl', '#vds', '#vdn', '#vdr', '#vdp', '#vdx']) $(id).onchange = muda;
    $('#vdq').oninput = muda;
    $('#vda').onclick = e => { const c = e.target.closest('.chip'); if (c) trocaAba({ aba: c.dataset.k, sit: '' }); };
    $('#vdk').onclick = e => { const c = e.target.closest('[data-cf]'); if (c) trocaAba(JSON.parse(c.dataset.cf)); };
    $('#vdb').onchange = e => { const c = e.target.closest('input[data-s]'); if (!c) return; c.checked ? sel.add(c.dataset.s) : sel.delete(c.dataset.s); c.closest('tr').classList.toggle('sel', c.checked); barra(); };
    $('#vdall').onchange = e => { for (const x of filtradas().filter(x => x.envio?.imprimir)) e.target.checked ? sel.add(chave(x)) : sel.delete(chave(x)); desenha(); };
    $('#vde').onclick = () => imprimir('pdf'); $('#vdz').onclick = () => imprimir('zpl'); $('#vdt').onclick = planilha;
    desenha();
    const rota = location.hash;
    timer = setInterval(async () => {
      if (location.hash !== rota) return clearInterval(timer);
      if (document.visibilityState !== 'visible' || document.getElementById('acm')) return;
      try { D = await api(`vendas/lista?aba=${F.aba}`); desenha(); } catch (e) { if (e === STALE) clearInterval(timer); }
    }, 60e3);
  };
  // outra aba: busca as vendas dela no servidor (filtros que vieram junto, como o de situação, valem para a nova aba)
  async function trocaAba(o) {
    const mudou = o.aba && o.aba !== D.aba; Object.assign(F, o); sel.clear();
    if (mudou) { $('#vdb').innerHTML = '<tr><td colspan="10" class="empty">Carregando…</td></tr>'; try { D = await api(`vendas/lista?aba=${F.aba}`); } catch (e) { if (e === STALE) return; avisoAcao(e.message, true); } }
    desenha();
  }

  const chave = x => `${x.loja}|${x.envio.id}`;
  function filtradas() {
    return D.linhas.filter(x => x.aba === F.aba && (!F.conta || x.loja === F.conta) && (!F.log || x.envio?.logistica === F.log) && (!F.sit || (F.sit === 'imprimir' ? x.envio?.imprimir && !x.envio.impressa : F.sit === 'atrasadas' ? x.envio?.atrasado : x.envio?.sub === F.sit || x.envio?.status === F.sit))
      && (!F.nf || (F.nf === 'emitida' ? !!x.nota : F.nf === 'falta' ? x.envio?.nfPendente : !x.nota)) && (!F.rec || x.reclamacao) && (!F.pub || x.publicidade) && (!F.prej || (x.conta && x.conta.lucro < 0))
      && (!F.q || [x.id, x.pack, x.comprador, ...x.itens.map(i => `${i.titulo} ${i.sku || ''}`)].join(' ').toLowerCase().includes(F.q)));
  }
  function desenha() {
    const C = D.cards, cf = o => esc(JSON.stringify(o));
    $('#vdk').innerHTML = `<div data-cf="${cf({ aba: 'hoje', sit: 'imprimir' })}" style="cursor:pointer">${kpi('Para imprimir', num(C.paraImprimir), `${num(C.impressas)} já impressa(s) hoje`, 'pedidos', C.paraImprimir ? 'blue' : 'slate')}</div>
      <div data-cf="${cf({ aba: 'hoje', sit: 'atrasadas' })}" style="cursor:pointer">${kpi('Atrasadas', num(C.atrasadas), 'passaram do horário de despacho', 'alertas', C.atrasadas ? 'red' : 'green')}</div>
      ${kpi('Horário limite de hoje', C.limite ? new Date(C.limite).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—', 'para despachar na agência ou na coleta', 'cal', 'amber')}
      <div data-cf="${cf({ aba: 'hoje', nf: 'falta' })}" style="cursor:pointer">${kpi('NF-e para anexar', num(C.nfPendente), 'sem a nota o ML não libera a etiqueta', 'dre', C.nfPendente ? 'red' : 'slate')}</div>
      <a href="#atendimento:reclamacoes" style="text-decoration:none;color:inherit">${kpi('Devoluções abertas', num(C.devolucoes), 'produto voltando para você', 'devolucoes', C.devolucoes ? 'amber' : 'slate')}</a>
      <div data-cf="${cf({ aba: 'full' })}" style="cursor:pointer">${kpi('Full no centro do ML', num(C.full), 'o Mercado Livre despacha', 'envios', 'teal')}</div>`;
    $('#vda').innerHTML = ABAS.map(([k, t]) => `<span class="chip${F.aba === k ? ' on' : ''}" data-k="${k}">${t} <b>${num(D.contagem[k] || 0)}</b></span>`).join('');
    const sits = [...new Set(D.linhas.map(x => x.envio?.sub || x.envio?.status).filter(Boolean))].sort();
    $('#vds').innerHTML = `<option value="">Todas</option><option value="imprimir">Etiqueta para imprimir</option><option value="atrasadas">Atrasadas</option>${sits.map(s => `<option>${esc(s)}</option>`).join('')}`; $('#vds').value = F.sit;
    const L = filtradas();
    for (const k of [...sel]) if (!L.some(x => x.envio?.id && chave(x) === k)) sel.delete(k);
    const tot = L.reduce((t, x) => t + (x.total || 0), 0), res = L.reduce((t, x) => t + (x.conta?.lucro || 0), 0);
    $('#vdi').innerHTML = `${num(L.length)} venda(s) · ${brl(tot)} · resultado <b class="${res < 0 ? 'bad' : 'ok'}">${brl(res)}</b>${D.temShopee ? ' · Mercado Livre e Shopee' : ''}${D.ultimaColeta ? ` · coleta às ${new Date(D.ultimaColeta).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
    $('#vdb').innerHTML = L.slice(0, 600).map(x => { const E = x.envio, C = x.conta, i0 = x.itens[0] || {}, s = E?.imprimir ? chave(x) : null;
      return `<tr data-ficha="${esc(x.loja)}|${esc(x.id)}"${s && sel.has(s) ? ' class="sel"' : ''}><td>${s ? `<input type="checkbox" data-s="${esc(s)}"${sel.has(s) ? ' checked' : ''} title="Selecionar para imprimir">` : ''}</td>
        <td><b>${quando(x.data)}</b><small style="display:block;color:var(--mut)">${esc(x.id)}${x.comprador ? ` · ${esc(x.comprador)}` : ''}</small>${canalChip(x.canal, x.loja)}${x.reclamacao ? ' <span class="tag bad">reclamação</span>' : ''}</td>
        <td><div class="pr">${thumb(x.thumb)}<div><b title="${esc(i0.titulo)}">${esc(i0.titulo || '')}</b><small>${num(x.itens.reduce((t, i) => t + i.qtd, 0))} un.${x.itens.length > 1 ? ` · ${x.itens.length} produtos` : ''}${i0.sku ? ` · ${esc(i0.sku)}` : ''}${i0.variacao ? ` · ${esc(i0.variacao)}` : ''}</small></div></div></td>
        <td class="env">${E ? `<span class="lgt ${esc(E.logistica)}" style="margin:0 4px 0 0">${esc(E.logistica)}</span>${esc(E.sub || E.status || '')}${E.atrasado ? ' <span class="tag bad">atrasada</span>' : ''}
          ${E.prazo && ['hoje', 'proximos'].includes(x.aba) ? `<small>despachar até ${quando(E.prazo)}</small>` : ''}${E.rastreio && x.aba !== 'hoje' ? `<small>${esc(E.rastreio)}</small>` : ''}${E.uf ? `<small>${esc(E.uf)}</small>` : ''}` : '<small>sem envio do Mercado Livre</small>'}</td>
        <td>${x.nota ? `<span class="tag ok">${esc(x.nota)}</span>` : E?.nfPendente ? '<span class="tag bad">anexar</span>' : '<small style="color:var(--mut)">—</small>'}</td>
        <td class="n"><b>${brl(x.total)}</b></td><td class="n">${C ? brl(C.frete) : '—'}${C?.freteNF ? `<small style="display:block;color:var(--mut)" title="Frete pago pelo comprador, vai na nota">na nota ${brl(C.freteNF)}</small>` : ''}</td>
        <td class="n">${C?.ads ? brl(C.ads) : '—'}</td><td class="n">${C ? `<b class="${C.lucro < 0 ? 'bad' : 'ok'}">${brl(C.lucro)}</b>` : x.cancelado ? '<small class="bad">cancelada</small>' : '—'}</td><td class="n">${C ? mgPill(C.margem, C.semCusto) : ''}</td></tr>`; }).join('')
      || `<tr><td colspan="10" class="empty">Nenhuma venda aqui.</td></tr>`;
    const lib = L.filter(x => x.envio?.imprimir); $('#vdall').checked = lib.length > 0 && lib.every(x => sel.has(chave(x))); $('#vdall').disabled = !lib.length;
    barra();
  }
  function barra() {
    const n = sel.size; $('#vde').disabled = $('#vdz').disabled = !n;
    $('#vde').innerHTML = `${ic('pedidos', 13)}Imprimir etiquetas (PDF)${n ? ` · ${n}` : ''}`; $('#vdz').textContent = `Etiquetas térmicas (ZPL)${n ? ` · ${n}` : ''}`;
  }

  // baixa as etiquetas de uma conta (o servidor devolve o arquivo do ML)
  async function baixaEtiquetas(loja, envios, tipo) {
    const r = await fetch('api/vendas/etiquetas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loja, envios, tipo }) }).catch(() => null);
    if (!r) throw new Error('Sem conexão com o servidor.');
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.erro || `HTTP ${r.status}`); }
    const b = await r.blob(), nome = (r.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1] || `etiquetas.${tipo === 'zpl' ? 'zip' : 'pdf'}`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  async function imprimir(tipo) {
    const porLoja = {}; for (const k of sel) { const [l, id] = k.split('|'); (porLoja[l] ||= []).push(id); }
    const nomes = l => D.linhas.find(x => x.loja === l)?.nomeLoja || l, n = sel.size;
    if (!await confirmaAcao({ titulo: tipo === 'zpl' ? 'Etiquetas térmicas (ZPL)' : 'Imprimir etiquetas', botao: 'Baixar etiquetas',
      texto: `${n} etiqueta(s): ${Object.entries(porLoja).map(([l, ids]) => `${ids.length} da conta <b>${esc(nomes(l))}</b>`).join(', ')}.<br>O Mercado Livre passa a mostrar essas vendas como <b>etiqueta impressa</b>.${tipo === 'zpl' ? '<br>O arquivo térmico vem compactado (.zip) com o texto para a impressora Zebra.' : ''}` })) return;
    for (const [l, ids] of Object.entries(porLoja)) {
      for (let i = 0; i < ids.length; i += 50) {
        try { await baixaEtiquetas(l, ids.slice(i, i + 50), tipo); avisoAcao(`Etiquetas de ${nomes(l)} baixadas.`); } catch (e) { avisoAcao(e.message, true); }
      }
    }
    sel.clear(); setTimeout(async () => { try { D = await api(`vendas/lista?aba=${F.aba}`); desenha(); } catch { /* a próxima atualização traz */ } }, 2500);
  }
  function planilha() {
    const L = filtradas(), cel = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }, dec = v => v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ',');
    const cab = ['Data', 'Venda', 'Pacote', 'Conta', 'Comprador', 'Produto', 'Unidades', 'SKU', 'Entrega', 'Situação', 'Despachar até', 'Rastreio', 'NF-e', 'Total', 'Frete', 'Frete na nota', 'Ads', 'Resultado', 'Margem %'];
    const linhas = L.map(x => [quando(x.data), x.id, x.pack || '', x.nomeLoja, x.comprador || '', x.itens.map(i => i.titulo).join(' + '), x.itens.reduce((t, i) => t + i.qtd, 0), x.itens.map(i => i.sku || '').join(' + '),
      x.envio?.logistica || '', x.envio?.sub || x.envio?.status || '', quando(x.envio?.prazo), x.envio?.rastreio || '', x.nota || (x.envio?.nfPendente ? 'falta anexar' : ''), dec(x.total), dec(x.conta?.frete), dec(x.conta?.freteNF), dec(x.conta?.ads), dec(x.conta?.lucro), x.conta ? dec(x.conta.margem * 100) : '']);
    const csv = '﻿' + [cab, ...linhas].map(l => l.map(cel).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `vendas-${F.aba}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ───────── ações na ficha da venda (Mercado Livre) ─────────
  window.fichaAcoes = F => {
    const box = $('#fca'); if (!box || F.canal !== 'ml') return;
    const loja = F.loja, pedido = F.id, E = F.envio;
    box.innerHTML = `<div class="fc-sec"><h5>Ações da venda</h5><div class="vd-ac">
        ${E?.imprimir ? `<button class="btn2" data-fa="pdf">${ic('pedidos', 13)}Etiqueta (PDF)</button><button class="btn2" data-fa="zpl">Etiqueta térmica</button>` : ''}
        <button class="btn2" data-fa="msg">${ic('atendimento', 13)}Mensagem ao comprador</button>
        ${F.cancelado ? '' : `<label class="btn2" style="cursor:pointer">${ic('down', 13)}Anexar NF-e<input type="file" id="fcn" accept=".xml,.pdf" multiple hidden></label>`}</div>
        <div id="fcm"></div>
        <h5 style="margin-top:12px">Notas internas <small style="text-transform:none;letter-spacing:0;color:var(--mut);font-weight:400">só você vê · ficam na venda no Mercado Livre</small></h5>
        <div id="fcl"><small style="color:var(--mut)">Carregando…</small></div>
        <div class="atm-ro" style="margin-top:6px"><input id="fct" maxlength="300" placeholder="Nova nota (até 300 caracteres)" style="flex:1;min-width:0"><button class="btn2" id="fcs">Salvar nota</button></div></div>`;
    const notas = L => { $('#fcl').innerHTML = L.length ? L.map(n => `<div class="vd-nt"><span>${esc(n.texto)}<br><small>${quando(n.data)}</small></span><button data-n="${esc(n.id)}" title="Apagar nota">✕</button></div>`).join('') : '<small style="color:var(--mut)">Nenhuma nota.</small>'; };
    getJ(`api/vendas/notas?loja=${encodeURIComponent(loja)}&pedido=${encodeURIComponent(pedido)}`).then(notas).catch(e => { if (e !== STALE && $('#fcl')) $('#fcl').innerHTML = `<small class="bad">${esc(e.message)}</small>`; });
    $('#fcs').onclick = async () => {
      const texto = $('#fct').value.trim(); if (!texto) return avisoAcao('Escreva a nota.', true);
      $('#fcs').disabled = true;
      try { notas(await postAcao('api/vendas/notas', { loja, pedido, texto })); $('#fct').value = ''; avisoAcao('Nota salva na venda.'); } catch (e) { avisoAcao(e.message, true); } finally { $('#fcs').disabled = false; }
    };
    $('#fcl').onclick = async e => {
      const b = e.target.closest('button[data-n]'); if (!b) return;
      if (!await confirmaAcao({ titulo: 'Apagar nota', previa: b.previousElementSibling.firstChild.textContent, botao: 'Apagar', perigo: 'A nota some da venda.' })) return;
      try { notas(await postAcao('api/vendas/notas/apagar', { loja, pedido, nota: b.dataset.n })); avisoAcao('Nota apagada.'); } catch (er) { avisoAcao(er.message, true); }
    };
    $('#fcn')?.addEventListener('change', async () => {
      const fs = [...$('#fcn').files]; if (!fs.length) return;
      if (await confirmaAcao({ titulo: 'Anexar NF-e', texto: `Venda ${esc(pedido)} (${esc(F.nomeLoja)}): ${fs.map(f => `<b>${esc(f.name)}</b>`).join(', ')}.<br>A nota fica disponível para o comprador e libera a etiqueta quando o ML está esperando a NF-e.`, botao: 'Anexar' })) {
        try { await postAcao('api/vendas/nfe', { loja, pedido, anexos: await lerArquivos(fs, 2) }); avisoAcao('NF-e anexada à venda.'); } catch (e) { avisoAcao(e.message, true); }
      }
      $('#fcn').value = '';
    });
    box.querySelectorAll('button[data-fa="pdf"],button[data-fa="zpl"]').forEach(b => b.onclick = async () => {
      if (!await confirmaAcao({ titulo: 'Etiqueta da venda', texto: `Venda ${esc(pedido)} (${esc(F.nomeLoja)}). O Mercado Livre passa a mostrar a etiqueta como impressa.`, botao: 'Baixar etiqueta' })) return;
      try { await baixaEtiquetas(loja, [E.id], b.dataset.fa); avisoAcao('Etiqueta baixada.'); } catch (e) { avisoAcao(e.message, true); }
    });
    box.querySelector('button[data-fa="msg"]').onclick = async () => {
      const m = $('#fcm'); m.innerHTML = '<small style="color:var(--mut)">Consultando o Mercado Livre…</small>';
      let C; try { C = await getJ(`api/vendas/conversa?loja=${encodeURIComponent(loja)}&pedido=${encodeURIComponent(pedido)}`); } catch (e) { if (e !== STALE) m.innerHTML = `<small class="bad">${esc(e.message)}</small>`; return; }
      if (C.existe) { if (typeof fecha === "function") fecha(); location.hash = `atendimento:mensagens:${loja}:${C.pack}`; return; }
      if (!C.opcoes.length) { m.innerHTML = `<div class="fc-nota">${esc(C.motivo || 'O Mercado Livre não libera mensagem nesta venda agora.')}</div>`; return; }
      m.innerHTML = `<div style="margin-top:8px"><select id="fco" style="width:100%;margin-bottom:6px">${C.opcoes.map(o => `<option value="${esc(o.id)}">${esc(o.txt)}</option>`).join('')}</select>
        <textarea id="fcx" placeholder="Mensagem" style="width:100%;min-height:60px"></textarea><div class="atm-ro"><small id="fck" style="color:var(--mut);margin-right:auto"></small><button id="fce">Enviar</button></div>
        <div class="fc-nota">O ML só deixa o vendedor começar a conversa por um destes motivos. Os de modelo mandam um texto pronto do Mercado Livre.</div></div>`;
      const ajusta = () => { const o = C.opcoes.find(x => x.id === $('#fco').value); $('#fcx').hidden = !o.livre; $('#fcx').maxLength = o.limite; $('#fck').textContent = o.livre ? `até ${o.limite} caracteres` : 'texto pronto do Mercado Livre'; };
      $('#fco').onchange = ajusta; ajusta();
      $('#fce').onclick = async () => {
        const o = C.opcoes.find(x => x.id === $('#fco').value), texto = $('#fcx').value.trim();
        if (o.livre && !texto) return avisoAcao('Escreva a mensagem.', true);
        if (!await confirmaAcao({ titulo: 'Mensagem ao comprador', texto: `Venda ${esc(pedido)} (${esc(F.nomeLoja)}) · motivo: <b>${esc(o.txt)}</b>`, previa: o.livre ? texto : '', botao: 'Enviar' })) return;
        $('#fce').disabled = true;
        try { await postAcao('api/vendas/conversa', { loja, pedido, opcao: o.id, texto }); avisoAcao('Mensagem enviada. As respostas aparecem em Atendimento › Mensagens.'); m.innerHTML = ''; } catch (e) { avisoAcao(e.message, true); $('#fce').disabled = false; }
      };
    };
  };
})();
