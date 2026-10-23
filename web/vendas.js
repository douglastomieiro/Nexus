// Vendas: ficha completa do pedido (painel lateral, abre de qualquer lista: clique na linha ou no nº do pedido)
// e Análise de Pedidos › Ao vivo (vendas de hoje chegando, comparadas com ontem até a mesma hora).
// Carregado depois de jodda.js (reaproveita $, api, brl, num, pc, esc, ic, kpi, thumb, mk, ch, mgPill, canalChip, skuLink, GRUPOS, ICO, SUB, NOTA, VIEWS).
(() => {
  document.head.insertAdjacentHTML('beforeend', `<style>
#dw{z-index:30} /* a ficha fica por cima do menu (no celular o menu ocupa o topo) */
.fc-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.fc-sec{border:1px solid var(--bd);border-radius:10px;padding:11px 13px;margin-bottom:12px}
.fc-sec h5{margin:0 0 8px;font-size:10.5px;letter-spacing:.06em;color:var(--ac);text-transform:uppercase}
.fl{display:flex;justify-content:space-between;gap:12px;padding:3px 0;font-size:12.5px;color:var(--tx3)}.fl b{color:var(--tx1);text-align:right}
.fl.sub{border-top:1px solid var(--line);margin-top:3px;padding-top:6px}.fl.sub b,.fl.sub span{font-weight:700;color:var(--tx1)}
.fl.tot{border-top:2px solid var(--bd);margin-top:4px;padding-top:7px;font-size:13.5px}.fl.tot span{font-weight:700;color:var(--tx1)}
.fl small{color:var(--mut)}
.fc-it{display:flex;gap:10px;align-items:flex-start;padding:6px 0}.fc-it+.fc-it{border-top:1px solid var(--line)}
.fc-it img,.fc-it .th{width:46px;height:46px;border-radius:8px;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 1px var(--bd);background:var(--soft)}
.fc-it b{display:block;color:var(--tx1);font-size:12.5px;line-height:1.3}.fc-it small{display:block;color:var(--mut);font-size:11.5px;margin-top:2px}
.fc-tl{list-style:none;margin:0;padding:0 0 0 14px;border-left:2px solid var(--line)}.fc-tl li{position:relative;padding:2px 0 7px;font-size:12.5px;color:var(--tx2)}
.fc-tl li::before{content:'';position:absolute;left:-19px;top:7px;width:8px;height:8px;border-radius:50%;background:var(--ac)}.fc-tl small{color:var(--mut);margin-right:6px}
.fc-msg{padding:7px 10px;border-radius:9px;margin:5px 0;max-width:88%;font-size:12.5px;white-space:pre-wrap}.fc-msg small{display:block;color:var(--mut);font-size:10.5px;margin-top:3px}
.fc-msg.comprador{background:var(--hov)}.fc-msg.voce{background:var(--ac2);margin-left:auto}
.fc-nota{font-size:11.5px;color:var(--mut);margin-top:6px;line-height:1.45}
.av-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;font-size:12.5px;color:var(--mut)}
.av-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:avp 2s infinite}
@keyframes avp{70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
#avb tr.novo td{animation:avn 4s ease-out}@keyframes avn{0%,40%{background:color-mix(in srgb,#22c55e 18%,var(--panel))}}
</style>`);

  const hora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const quando = d => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const L = (t, v, cls = '', dica = '') => `<div class="fl ${cls}"${dica ? ` title="${esc(dica)}"` : ''}><span>${t}</span><b>${v}</b></div>`;
  const neg = v => (v ? `− ${brl(Math.abs(v))}` : brl(0));
  const sec = (t, html) => html ? `<div class="fc-sec"><h5>${t}</h5>${html}</div>` : '';

  // ───────── ficha do pedido ─────────
  async function abreFicha(loja, id) {
    $('#dt').textContent = `Pedido ${id}`; $('#db').innerHTML = '<p style="color:var(--mut)">Carregando…</p>'; $('#dw').classList.add('on');
    let F; try { F = await fetch(`api/pedido?loja=${encodeURIComponent(loja)}&id=${encodeURIComponent(id)}`).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.erro || `HTTP ${r.status}`); return j; }); }
    catch (e) { $('#db').innerHTML = `<div class="note">${esc(e.message)}</div>`; return; }
    const C = F.conta, ml = F.canal === 'ml';
    $('#dt').innerHTML = `${ml ? 'Venda' : 'Pedido Shopee'} ${esc(F.id)}`;
    const itens = F.itens.map(i => `<div class="fc-it">${i.thumb ? `<img src="${esc(i.thumb)}" alt="">` : '<span class="th"></span>'}<div style="flex:1;min-width:0">
      <b>${i.link ? `<a class="lk" target="_blank" rel="noopener" href="${esc(i.link)}">${esc(i.titulo)}</a>` : esc(i.titulo)}</b>
      <small>${i.sku ? `SKU ${esc(i.sku)}` : 'sem SKU'}${i.variacao ? ` · ${esc(i.variacao)}` : ''}${i.tipo ? ` · ${esc(i.tipo)}` : ''}</small>
      <small>${num(i.qtd)} × ${brl(i.preco)}${i.precoCheio && i.precoCheio > i.preco ? ` <s>${brl(i.precoCheio)}</s>` : ''} = <b style="display:inline">${brl(i.qtd * i.preco)}</b>${i.tarifa != null ? ` · tarifa ${brl(i.tarifa)}/un.` : ''}</small>
      ${i.sku ? `<small><a class="lk" href="#sku:${encodeURIComponent(i.sku)}" onclick="fecha()">Ver todas as vendas deste produto →</a></small>` : ''}</div></div>`).join('');
    const det = C?.det.length > 1 ? C.det.map(d => `<small>${esc(d.titulo)}: ${num(d.qtd)} × ${brl(d.custoUnit)}</small>`).join('<br>') : '';
    const conta = C ? [
      L('Total da venda', brl(C.receita)), C.devolucao ? L('(−) Reembolso ao comprador', neg(C.devolucao)) : '',
      L(ml ? '(−) Comissão do Mercado Livre' : '(−) Comissão e taxas da Shopee', neg(C.comissao), '', C.receita ? `${pc(C.comissao / C.receita)} do total` : ''),
      L('(−) Frete pago por você', neg(C.frete) + (C.flags.includes('frete estimado') ? ' <small>(estimado)</small>' : '')),
      C.ajustes ? L('(−) Ajustes (cupons, compensações)', neg(C.ajustes)) : '',
      L(`(=) Repasse ${ml ? 'do Mercado Livre' : 'da Shopee'}`, brl(C.repasse), 'sub'),
      L('(−) Custo dos produtos', C.flags.includes('sem custo') ? `${neg(C.custo)} <small class="warn">sem custo cadastrado</small>` : neg(C.custo), '', C.det.map(d => `${d.titulo}: ${d.qtd} × ${brl(d.custoUnit)}`).join('\n')),
      L('(−) Imposto', neg(C.imposto) + (C.impostoFrete ? ` <small>(${brl(C.impostoFrete)} sobre o frete da nota)</small>` : '')),
      L('(−) Ads', C.ads ? neg(C.ads) : '<small>sem Ads ligado a este pedido</small>', '', 'Gasto de Ads do anúncio no dia da venda, dividido entre as unidades vendidas no dia.'),
      L('(=) Resultado do pedido', `<span class="${C.lucro < 0 ? 'bad' : 'ok'}">${brl(C.lucro)}</span>`, 'tot'), L('Margem', mgPill(C.margem, C.flags.includes('sem custo'))),
      C.freteNF ? `<div class="fc-nota">Frete na nota: o comprador pagou ${brl(C.freteNF)} de frete. Esse valor vai na nota fiscal (entra na base do imposto), mas não é receita sua.</div>` : '',
      det ? `<div class="fc-nota">Custo por item:<br>${det}</div>` : '',
    ].join('') : `<div class="fc-nota">${F.cancelado ? 'Pedido cancelado: não entra no faturamento.' : F.devolucao ? 'Pedido devolvido: o resultado está em Devoluções (abaixo).' : 'A conta deste pedido ainda não está disponível (pagamento pendente ou dados em coleta).'}</div>`;
    const ext = F.extrato ? F.extrato.map(x => L(esc(x.txt), x.total ? `<b>${brl(x.valor)}</b>` : x.valor < 0 ? neg(x.valor) : brl(x.valor), x.total ? 'sub' : '')).join('') : '';
    const E = F.envio, envio = E ? [L('Logística', E.logistica ? `<span class="lgt ${esc(E.logistica)}" style="margin:0">${esc(E.logistica)}</span>` : '—'), L('Status', esc(E.status || '—') + (E.atraso ? ' <span class="tag bad">atrasado</span>' : '')),
      E.transportadora ? L('Transportadora', esc(E.transportadora)) : '', E.rastreio ? L('Rastreio', esc(E.rastreio)) : '', E.prazoEntrega ? L('Previsão de entrega', new Date(E.prazoEntrega).toLocaleDateString('pt-BR')) : '',
      E.situacao ? L('Situação do envio', esc(E.situacao)) : '', E.despacharAte ? L('Despachar até', quando(E.despacharAte)) : '', E.origem ? L('Sai de', esc(E.origem)) : '',
      E.custoVendedor != null ? L('Frete pago por você', brl(E.custoVendedor)) : '', E.freteComprador != null ? L('Frete pago pelo comprador', brl(E.freteComprador)) : '', F.prazoDespacho ? L('Despachar até', quando(F.prazoDespacho)) : ''].join('') : '';
    const N = F.nota, nota = N ? [L('Nota fiscal', `nº ${esc(N.numero)} · série ${esc(N.serie)}`), L('Situação', esc(N.status)), L('Emitida em', quando(N.data)), N.valor != null ? L('Valor da nota', brl(N.valor)) : '',
      L('Frete na nota', N.frete ? brl(N.frete) : 'não teve'), N.chave ? `<div class="fc-nota">Chave: <code style="word-break:break-all">${esc(N.chave)}</code></div>` : ''].join('')
      : ml ? '<div class="fc-nota">Sem nota fiscal coletada. O sistema só busca a nota dos pedidos em que o comprador pagou frete (esse frete vai na nota e muda o imposto).</div>' : '';
    const pag = F.pagamentos.map(p => [L('Forma', esc(p.metodo || '—') + (p.parcelas > 1 ? ` em ${p.parcelas}×` : '')), L('Valor pago pelo comprador', brl(p.pago ?? p.valor) + (p.freteComprador ? ` <small>(com ${brl(p.freteComprador)} de frete)</small>` : '')),
      p.reembolsado ? L('Reembolsado', `<span class="bad">${brl(p.reembolsado)}</span>`) : '', p.data ? L('Aprovado em', quando(p.data)) : ''].join('')).join('<hr style="margin:6px 0">');
    const D = F.devolucao, dev = D ? [L('Tipo', esc(D.tipo)), L('Reembolsado', brl(D.reembolsado)), D.status ? L('Situação', esc(D.status)) : '', D.freteIda != null ? L('Frete de ida perdido', brl(D.freteIda)) : '', D.freteVolta ? L('Frete de volta', brl(D.freteVolta)) : '',
      D.tarifas ? L('Tarifas não devolvidas', brl(D.tarifas)) : '', D.custoProduto ? L('Produto perdido', brl(D.custoProduto)) : '', D.perda != null ? L('Perda total', `<span class="bad">${brl(D.perda)}</span>`, 'sub') : '',
      D.mantida ? L('Venda mantida pelo ML (resultado)', brl(D.resultadoMantido)) : '', D.motivos?.length ? `<div class="fc-nota">Motivo: ${esc(D.motivos.join(' · '))}</div>` : ''].join('') : '';
    const rec = F.reclamacoes.map(c => L(`${esc(c.tipo)} <small>${quando(c.data)}</small>`, `${esc(c.status)}${c.motivo ? `<br><small>${esc(c.motivo)}</small>` : ''}`)).join('');
    const msgs = F.mensagens.map(m => `<div class="fc-msg ${m.de}">${esc(m.texto)}<small>${m.de === 'voce' ? 'Você' : 'Comprador'} · ${quando(m.data)}</small></div>`).join('');
    const tempo = F.tempo.length ? `<ul class="fc-tl">${F.tempo.map(t => `<li><small>${quando(t.data)}</small>${esc(t.txt)}</li>`).join('')}</ul>` : '';
    $('#db').innerHTML = `<div class="fc-top">${canalChip(F.canal, F.loja)}<span class="tag ${F.cancelado ? 'bad' : ''}">${esc(F.status)}</span><small style="color:var(--mut)">${quando(F.data)}</small>
        <a class="btn2" style="margin-left:auto;text-decoration:none" target="_blank" rel="noopener" href="${esc(F.link)}">${ic('ext', 13)}${ml ? 'Abrir no Mercado Livre' : 'Abrir na Shopee'}</a></div>
      <div id="fca"></div>${sec('Produtos', itens)}${sec('Conta do pedido', conta)}${sec('Extrato da Shopee (repasse)', ext)}${sec('Envio', envio)}${sec('Nota fiscal', nota)}${sec('Pagamento', pag)}
      ${sec('Comprador', [F.comprador.apelido ? L('Apelido', esc(F.comprador.apelido)) : '', ...(E?.endereco ? [E.endereco.destinatario ? L('Quem recebe', esc(E.endereco.destinatario)) : '',
        E.endereco.linha ? L('Endereço', `${esc(E.endereco.linha)}${E.endereco.bairro ? ' · ' + esc(E.endereco.bairro) : ''}`) : '', E.endereco.cep ? L('CEP', esc(E.endereco.cep)) : '',
        E.endereco.referencia ? L('Referência', esc(E.endereco.referencia)) : ''] : []), F.comprador.cidade ? L('Destino', `${esc(F.comprador.cidade)}${F.comprador.uf ? ' / ' + esc(F.comprador.uf) : ''}`) : '', F.pack ? L('Carrinho (pack)', esc(F.pack)) : ''].join(''))}
      ${sec('Devolução', dev)}${sec('Reclamações', rec)}${sec('Linha do tempo', tempo)}${sec('Mensagens', msgs)}
      ${ml ? `<p class="fc-nota"><a class="lk lv" href="#" data-t="order" data-i="${esc(F.id)}" data-l="${esc(F.loja)}">Ver o retorno da API deste pedido { }</a></p>` : ''}`;
    window.fichaAcoes?.(F); // ações da venda (etiqueta, nota interna, NF-e, mensagem): vendas-lista.js
  }
  window.abreFicha = abreFicha;
  // abre a ficha de qualquer elemento com data-ficha="conta|pedido" (linha de tabela ou nº do pedido); links e botões dentro da linha continuam com a ação deles
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-ficha]'); if (!el) return;
    if (el.tagName !== 'A' && e.target.closest('a,button,input,select,label')) return;
    e.preventDefault(); const [l, ...i] = el.dataset.ficha.split('|'); abreFicha(l, i.join('|'));
  });

  // ───────── Análise de Pedidos › Ao vivo ─────────
  ICO.aovivo = '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>';
  const g = GRUPOS.find(x => x.n === 'Análise de Pedidos'); if (g && !g.tabs.some(t => t[0] === 'aovivo')) g.tabs.unshift(['aovivo', 'Ao vivo']);
  SUB.aovivo = 'Vendas de hoje chegando, comparadas com ontem até a mesma hora';
  NOTA.aovivo = 'Período fixo: hoje · atualiza sozinho a cada 30 s';
  let timer = null, vistos = new Set(), graf = null;
  const varia = (a, b) => b ? `${a >= b ? '▲' : '▼'} ${pc(Math.abs(a / b - 1), 0)} vs ontem até agora` : 'ontem até agora: 0';
  // margem: diferença em pontos percentuais; avisa quantas vendas ficaram fora por não ter custo
  const variaMg = (a, b, sem) => `${a == null || b == null ? `ontem até agora: ${b == null ? '—' : pc(b, 1)}` : `${a >= b ? '▲' : '▼'} ${String(Math.abs((a - b) * 100).toFixed(1)).replace('.', ',')} p.p. vs ontem até agora`}${sem ? ` · ${num(sem)} sem custo fora da conta` : ''}`;

  VIEWS.aovivo = async function () {
    clearInterval(timer); vistos = new Set(); graf = null;
    const D = await api('aovivo');
    $('#view').innerHTML = `<div class="av-top"><span class="av-dot"></span><b style="color:var(--tx1)">Ao vivo</b><span id="avu"></span>
        <span style="margin-left:auto">Clique numa venda para ver a ficha completa · o aviso de venda nova liga e desliga no rodapé do sino</span></div>
      <div class="kgrid" id="avk"></div><div id="avn"></div>
      <div class="box" style="margin-bottom:14px"><div class="boxh"><h3>Faturamento acumulado do dia</h3><small>hoje × ontem, hora a hora</small></div><div style="height:230px"><canvas id="avc"></canvas></div></div>
      <div class="box"><div class="boxh"><h3>Vendas de hoje</h3><small id="avq"></small></div><div class="tw" style="max-height:none"><table class="rt"><thead><tr><th>Hora</th><th>Produto</th><th>Canal</th><th class="c">Qtd</th><th class="n">Total</th><th class="n">Frete</th><th class="n">Ads</th><th class="n">Resultado</th><th class="n">Margem</th></tr></thead><tbody id="avb"></tbody></table></div></div>`;
    desenha(D, true);
    const rota = location.hash;
    timer = setInterval(async () => {
      if (location.hash !== rota) return clearInterval(timer);
      if (document.visibilityState !== 'visible') return;
      try { desenha(await api('aovivo'), false); } catch (e) { if (e === STALE) clearInterval(timer); }
    }, 30e3);
  };

  function desenha(D, primeira) {
    const H = D.kpi.hoje, O = D.kpi.ontemAteAgora, proj = O.receita ? H.receita * D.kpi.ontem.receita / O.receita : null;
    $('#avu').textContent = `atualizado às ${hora(D.agora)}${D.ultimaColeta ? ` · última coleta de pedidos às ${hora(D.ultimaColeta)}` : ''}`;
    $('#avk').innerHTML = kpi('Faturamento hoje', brl(H.receita), varia(H.receita, O.receita), 'lucro', 'blue') + kpi('Pedidos hoje', num(H.pedidos), varia(H.pedidos, O.pedidos), 'pedidos', 'purple')
      + kpi('Resultado estimado', brl(H.lucro), varia(H.lucro, O.lucro), 'abc', H.lucro < 0 ? 'red' : 'green')
      + kpi('Margem média hoje', H.margem == null ? '—' : pc(H.margem, 1), variaMg(H.margem, O.margem, H.semCusto), 'abc', H.margem == null ? 'slate' : H.margem < 0 ? 'red' : H.margem * 100 < (window.REGRAS?.margemMin ?? 15) ? 'amber' : 'green') + kpi('Ticket médio', brl(H.pedidos ? H.receita / H.pedidos : 0), `${num(H.unidades)} unidade(s)`, 'itens', 'amber')
      + kpi('No ritmo de ontem', proj == null ? '—' : brl(proj), `ontem fechou em ${brl(D.kpi.ontem.receita)}`, 'rocket', 'teal') + kpi('Cancelados hoje', num(D.cancelados), 'não entram no faturamento', 'cancel', D.cancelados ? 'red' : 'slate');
    $('#avn').innerHTML = D.adsHoje || !H.pedidos ? '' : '<div class="note">O gasto de Ads de hoje ainda não foi coletado (a coleta de Ads é de 3 em 3 horas): o resultado aparece sem Ads e se ajusta sozinho depois.</div>';
    // acumulado: hoje até a hora atual, ontem o dia todo
    const acum = a => a.reduce((s, v, i) => (s.push((s[i - 1] || 0) + v), s), []), hAt = Math.floor(D.minuto / 60), hojeA = acum(D.horas.hoje).map((v, i) => (i <= hAt ? v : null));
    if (!graf) graf = mk('#avc', { type: 'line', data: { labels: [...Array(24).keys()].map(h => `${String(h).padStart(2, '0')}h`), datasets: [
      { label: 'Hoje', data: hojeA, borderColor: '#3b82f6', backgroundColor: '#3b82f622', fill: true, tension: .3, pointRadius: 0, borderWidth: 2.5 },
      { label: 'Ontem', data: acum(D.horas.ontem), borderColor: '#94a3b8', borderDash: [5, 4], tension: .3, pointRadius: 0, borderWidth: 2 }] },
      options: { ...ch, interaction: { mode: 'index', intersect: false }, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } } } });
    else { graf.data.datasets[0].data = hojeA; graf.data.datasets[1].data = acum(D.horas.ontem); graf.update('none'); }
    $('#avq').textContent = `${num(D.feed.length)} venda(s) · ${D.temShopee ? 'Mercado Livre e Shopee' : 'Mercado Livre'}`;
    $('#avb').innerHTML = D.feed.map(x => { const k = x.loja + '|' + x.id, novo = !primeira && !vistos.has(k);
      return `<tr data-ficha="${esc(k)}" style="cursor:pointer"${novo ? ' class="novo"' : ''}><td><b>${hora(x.data)}</b></td>
        <td><div class="pr">${thumb(x.thumb)}<div><b title="${esc(x.titulo)}">${esc(x.titulo)}${x.outros ? ` <small>+${x.outros} item(ns)</small>` : ''}</b><small>${x.sku ? esc(x.sku) : 'sem SKU'}${x.lg && x.lg !== 'Shopee' ? ` · <span class="lgt ${x.lg}" style="margin:0">${x.lg}</span>` : ''}${x.uf ? ` · ${x.uf}` : ''}${x.flags.map(f => ` · <span class="warn">${esc(f)}</span>`).join('')}</small></div></div></td>
        <td>${canalChip(x.canal, x.loja)}</td><td class="c">${num(x.qtd)}</td><td class="n"><b>${brl(x.receita)}</b></td><td class="n">${brl(x.frete)}</td><td class="n">${x.ads ? brl(x.ads) : '—'}</td>
        <td class="n"><b class="${x.lucro < 0 ? 'bad' : 'ok'}">${brl(x.lucro)}</b></td><td class="n">${mgPill(x.margem, x.flags.includes('sem custo'))}</td></tr>`; }).join('') || '<tr><td colspan="9" class="empty">Nenhuma venda hoje ainda.</td></tr>';
    D.feed.forEach(x => vistos.add(x.loja + '|' + x.id));
  }
})();
