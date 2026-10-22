// Dashboard › Resumo: a tela inicial da central do vendedor. O que está pendente em cada parte (com atalho), vendas e lucro da semana,
// visitas e conversão, reputação de cada conta com o que pesou nela, desempenho de envios e a fatura do Mercado Livre.
// Carregado por último (reaproveita $, api, brl, num, pc, esc, ic, kpi, mk, ch, GRUPOS, ICO, SUB, NOTA, VIEWS).
(() => {
  document.head.insertAdjacentHTML('beforeend', `<style>
.rs-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-bottom:14px}
.rs-b{background:var(--panel);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;box-shadow:var(--sh)}.rs-b h4{margin:0 0 8px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--ac)}
.rs-i{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--line);text-decoration:none;color:var(--tx2);font-size:13px}.rs-i:first-of-type{border-top:0}
.rs-i b{font-size:15px;color:var(--tx1)}.rs-i b.z{color:var(--mut);font-weight:500}.rs-i b.r{color:var(--bad)}.rs-i:hover span{color:var(--tx1);text-decoration:underline}
.rs-rep{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:14px}
.rs-cor{display:flex;gap:4px;margin:6px 0 10px}.rs-cor i{flex:1;height:9px;border-radius:5px;opacity:.25}.rs-cor i.on{opacity:1;box-shadow:0 0 0 2px var(--panel),0 0 0 3px currentColor}
.rs-m{width:100%;border-collapse:collapse;font-size:12.5px}.rs-m td{padding:5px 4px;border-top:1px solid var(--line)}.rs-m td.n{text-align:right}.rs-m th{font-size:10.5px;color:var(--mut);text-align:right;font-weight:600;padding:2px 4px}.rs-m th:first-child{text-align:left}
.rs-urg{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.rs-urg a{display:flex;align-items:center;gap:10px;background:color-mix(in srgb,var(--bad) 12%,var(--panel));border:1px solid var(--bad);border-radius:12px;padding:10px 14px;text-decoration:none;color:var(--tx1)}.rs-urg b{font-size:22px;color:var(--bad)}.rs-urg span{font-size:13px}
.rs-l{font-size:12px;color:var(--tx2);margin-top:8px}.rs-l summary{cursor:pointer;color:var(--ac)}.rs-l div{border-top:1px dashed var(--line);padding:3px 0}
</style>`);

  ICO.central = '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>';
  const g = GRUPOS.find(x => x.n === 'Dashboard'); if (g && !g.tabs.some(t => t[0] === 'central')) g.tabs.unshift(['central', 'Resumo']);
  SUB.central = 'O que precisa de você hoje, como foi a semana e como está a reputação de cada conta';
  NOTA.central = 'Pendências de agora · semana = últimos 7 dias';
  // a central abre no Resumo
  if (!location.hash || location.hash === '#') location.replace('#central');

  const CORES = [['1_red', '#ef4444'], ['2_orange', '#f97316'], ['3_yellow', '#eab308'], ['4_light_green', '#84cc16'], ['5_green', '#16a34a']];
  const varia = (a, b) => b ? `${a >= b ? '▲' : '▼'} ${pc(Math.abs(a / b - 1), 0)} vs 7 dias antes` : '7 dias antes: 0';
  const dt = d => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
  // cada pendência: onde abre, o texto e se número > 0 é ruim
  const PEND = { perguntas: ['#atendimento:perguntas', 'Perguntas sem resposta'], mensagens: ['#atendimento:mensagens', 'Mensagens não lidas'], reclamacoes: ['#atendimento:reclamacoes', 'Reclamações abertas'],
    reclamacoesPrazo: ['#atendimento:reclamacoes', 'Com prazo em menos de 24 h'], devolucoesShopee: ['#atendimento', 'Devoluções na Shopee'], enviosHoje: ['#vendas', 'Vendas para despachar hoje', false],
    paraImprimir: ['#vendas', 'Etiquetas para imprimir'], atrasadas: ['#vendas', 'Envios atrasados'], nfPendente: ['#vendas', 'NF-e para anexar'], semEstoque: ['#anuncios', 'Anúncios sem estoque'],
    qualidade: ['#anuncios', 'Qualidade abaixo do mínimo'], catalogo: ['#anuncios', 'Catálogo sem ganhar'], reporFull: ['#anuncios', 'Repor no Full'], semCusto: ['#custos', 'Sem custo cadastrado'],
    adsPrejuizo: ['#publicidade', 'Ads com prejuízo'], adsSugeridos: ['#publicidade', 'Sugeridos pelo ML fora de campanha', false] };

  VIEWS.central = async function () {
    const R = await api('central'), P = R.pendencias, S = R.semana, V = R.visitas;
    // módulo ligado para a operação e para o perfil de quem entrou
    const lig = id => (R.modulos || {})[id] !== false && (window.moduloLigado ? window.moduloLigado(id) : true), M = Object.fromEntries(['atendimento', 'vendas', 'anuncios', 'ads'].map(m => [m, lig(m)]));
    const C = { ...(window.RESUMO_PADRAO || { ordem: [], ocultos: [], urgentes: [] }), ...(window.prefLocal?.ler('resumo:config', {}) || {}) };
    const it = k => { const [href, txt, ruim = true] = PEND[k], v = P[k]; return `<a class="rs-i" href="${href}"><span>${txt}</span><b class="${v == null ? 'z' : v ? (ruim ? 'r' : '') : 'z'}">${v == null ? '—' : num(v)}</b></a>`; };
    const conv = S && V.atual ? S.atual.pedidos / V.atual : null, LIM = Object.fromEntries(Object.entries(R.limites || {}).map(([k, v]) => [k, v.map(x => x / 100)]));
    // urgentes com algo pendente sobem para o topo
    const DE = { '#atendimento': 'atendimento', '#vendas': 'vendas', '#anuncios': 'anuncios', '#custos': 'anuncios', '#publicidade': 'ads' }, modDe = k => DE[PEND[k][0].split(':')[0]];
    const urg = (C.urgentes || []).filter(k => PEND[k] && P[k] > 0 && M[modDe(k)] !== false);
    const env = R.envios, taxa = e => e.noPrazo + e.atrasados ? pc(e.noPrazo / (e.noPrazo + e.atrasados), 1) : '—';
    const B = {
      atendimento: M.atendimento !== false && `<div class="rs-b"><h4>Atendimento</h4>${['perguntas', 'mensagens', 'reclamacoes', 'reclamacoesPrazo'].map(it).join('')}${P.devolucoesShopee ? it('devolucoesShopee') : ''}</div>`,
      envios: M.vendas !== false && `<div class="rs-b"><h4>Envios de hoje</h4>${['enviosHoje', 'paraImprimir', 'atrasadas', 'nfPendente'].map(it).join('')}
          <div class="rs-i"><span>Horário limite</span><b class="${P.limite ? '' : 'z'}">${P.limite ? new Date(P.limite).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</b></div></div>`,
      anuncios: M.anuncios !== false && `<div class="rs-b"><h4>Anúncios</h4>${['semEstoque', 'qualidade', 'catalogo', 'reporFull', 'semCusto'].map(it).join('')}</div>`,
      publicidade: M.ads !== false && `<div class="rs-b"><h4>Publicidade</h4>${['adsPrejuizo', 'adsSugeridos'].map(it).join('')}
          ${R.ads ? `<div class="rs-i"><span>ROAS em 30 dias</span><b>${R.ads.custo ? `${String(Math.round(R.ads.receita / R.ads.custo * 10) / 10).replace('.', ',')}x` : '—'}</b></div><div class="rs-i"><span>Investido em 30 dias</span><b>${brl(R.ads.custo)}</b></div>` : ''}</div>`,
      semana: S && `<div class="kgrid">${kpi('Faturamento da semana', brl(S.atual.receita), varia(S.atual.receita, S.anterior.receita), 'lucro', 'blue')}${kpi('Lucro da semana', brl(S.atual.lucro), varia(S.atual.lucro, S.anterior.lucro), 'abc', S.atual.lucro < 0 ? 'red' : 'green')}
        ${kpi('Pedidos', num(S.atual.pedidos), varia(S.atual.pedidos, S.anterior.pedidos), 'pedidos', 'purple')}${kpi('Visitas', num(V.atual), `${varia(V.atual, V.anterior)}${conv != null ? ` · conversão ${pc(conv, 2)}` : ''}`, 'visao', 'teal')}
        ${kpi('Envios no prazo', taxa(env.semana), `4 semanas: ${taxa(env.quatroSemanas)} · ${num(env.quatroSemanas.atrasados)} atrasado(s)`, 'envios', env.semana.atrasados ? 'amber' : 'green')}</div>`,
      grafico: S && '<div class="box" style="margin-bottom:14px"><div class="boxh"><h3>Últimos 7 dias</h3><small>faturamento e lucro por dia</small></div><div style="height:210px"><canvas id="rsc"></canvas></div></div>',
      reputacao: R.reputacao.length > 0 && `<div class="rs-rep">${R.reputacao.map(r => { const i = CORES.findIndex(c => c[0] === r.nivel);
        const lin = (t, m, k) => { const [v, l] = LIM[k] || [0, 0], x = m?.rate; return `<tr><td>${t}</td><td class="n"><b class="${x == null ? '' : x > v ? 'bad' : x > l ? 'warn' : 'ok'}">${x == null ? '—' : pc(x, 2)}</b> <small style="color:var(--mut)">(${num(m?.value ?? 0)})</small></td><td class="n">${pc(v, 1)}</td><td class="n">${pc(l, 1)}</td></tr>`; };
        return `<div class="box"><div class="boxh"><h3>${esc(r.nome)}${r.apelido ? ` <small>${esc(r.apelido)}</small>` : ''}</h3><small>${esc(r.nivelTxt)}${r.lider ? ` · ${esc(r.lider)}` : ''}</small></div>
          <div class="rs-cor">${CORES.map(([k, c], j) => `<i style="background:${c};color:${c}" class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
          <table class="rs-m"><tr><th>Últimos 60 dias · ${num(r.vendas60 ?? 0)} vendas</th><th>Você</th><th>Verde</th><th>Líder</th></tr>${lin('Reclamações', r.reclamacoes, 'reclamacoes')}${lin('Envios com atraso', r.atrasos, 'atrasos')}${lin('Cancelamentos por você', r.cancelamentos, 'cancelamentos')}</table>
          <p class="dica" style="margin-top:6px">${r.positivas != null ? `${pc(r.positivas, 0)} de avaliações positivas · ` : ''}${num(r.historico ?? 0)} vendas no histórico. Limites em Configurações › Personalizar; confira os do ML na central de vendedores.</p>
          ${r.reclamacoesQueAfetam.length ? `<details class="rs-l"><summary>${r.reclamacoesQueAfetam.length} reclamação(ões) que afetam a reputação</summary>${r.reclamacoesQueAfetam.map(c => `<div><a class="lk" href="#atendimento:reclamacoes:${esc(r.loja)}:${esc(c.id)}">${dt(c.data)} · venda ${esc(c.pedido)}</a> · ${esc(c.motivo || '')}</div>`).join('')}</details>` : ''}
          ${r.enviosAtrasados.length ? `<details class="rs-l"><summary>${num(r.totalAtrasos60)} envio(s) passaram do prazo em 60 dias</summary><div class="dica" style="border:0">O ML só conta na reputação os atrasos por sua causa; esta lista mostra todos.</div>${r.enviosAtrasados.map(x => `<div>${x.pedido ? `<a class="lk" href="#" data-ficha="${esc(r.loja)}|${esc(x.pedido)}">venda ${esc(x.pedido)}</a>` : `envio ${esc(x.envio)}`} · despachar até ${dt(x.data)}</div>`).join('')}</details>` : ''}</div>`; }).join('')}</div>`,
      fatura: R.fatura.length > 0 && `<div class="box" style="margin-bottom:14px"><div class="boxh"><h3>Fatura do Mercado Livre</h3><small>período mais recente de cada conta</small></div><table class="rs-m">${R.fatura.map(f => `<tr><td><b>${esc(f.nome)}</b> <small style="color:var(--mut)">${dt(f.de)} a ${dt(f.ate)} · ${esc(f.situacao)}</small></td><td class="n">${brl(f.valor)}</td><td class="n">${f.emAberto ? `<b class="bad">${brl(f.emAberto)} em aberto</b>` : '<span class="ok">paga</span>'}</td><td class="n">vence ${dt(f.vence)}</td></tr>`).join('')}</table></div>`,
    };
    // na ordem escolhida; os quadros de pendência (pequenos) ficam juntos numa grade
    const ordem = [...(C.ordem || []), ...Object.keys(B).filter(k => !(C.ordem || []).includes(k))].filter(k => B[k] && !(C.ocultos || []).includes(k)), PEQ = new Set(['atendimento', 'envios', 'anuncios', 'publicidade']);
    let html = '', grade = '';
    for (const k of ordem) { if (PEQ.has(k)) { grade += B[k]; continue; } if (grade) { html += `<div class="rs-g">${grade}</div>`; grade = ''; } html += B[k]; }
    if (grade) html += `<div class="rs-g">${grade}</div>`;
    $('#view').innerHTML = `${urg.length ? `<div class="rs-urg">${urg.map(k => `<a href="${PEND[k][0]}"><b>${num(P[k])}</b><span>${PEND[k][1]}</span></a>`).join('')}</div>` : ''}${html}
      <p class="dica" style="text-align:right"><a class="lk" href="#personalizar">Personalizar o Resumo</a></p>`;
    if (S && ordem.includes('grafico')) mk('#rsc', { type: 'bar', data: { labels: S.dias.map(d => new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })),
      datasets: [{ label: 'Faturamento', data: S.dias.map(d => d.receita), backgroundColor: '#3b82f6aa', borderRadius: 5 }, { label: 'Lucro', data: S.dias.map(d => d.lucro), backgroundColor: '#22c55eaa', borderRadius: 5 }] },
      options: { ...ch, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } } } });
  };
})();
