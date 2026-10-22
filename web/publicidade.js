// Gestão Mercado Livre › Gerenciar Ads: Product Ads pelo sistema. Resumo de 30 dias contra os 30 anteriores, campanhas (pausar, ativar,
// orçamento, ROAS alvo, estratégia) e anúncios patrocinados com o lucro depois do Ads (incluir, pausar, ativar, mover e tirar da campanha).
// Carregado depois de acoes.js e anuncios.js (reaproveita $, api, brl, num, pc, esc, ic, kpi, thumb, mgPill, confirmaAcao, postAcao, avisoAcao).
(() => {
  document.head.insertAdjacentHTML('beforeend', `<style>
#pcb td,#pab td{vertical-align:middle}#pcb input{width:78px;padding:5px 6px;text-align:right}#pcb select,#pab select{padding:5px 6px;font-size:12px;max-width:170px}
#pcb small,#pab small{display:block;color:var(--mut);font-size:11px}.pu-ac{display:flex;gap:4px;flex-wrap:wrap;align-items:center}.pu-ac .btn2{padding:4px 9px;font-size:11.5px}
</style>`);

  ICO.publicidade = '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>';
  const g = GRUPOS.find(x => x.n === 'Gestão Mercado Livre');
  if (g && !g.tabs.some(t => t[0] === 'publicidade')) g.tabs.splice(g.tabs.findIndex(t => t[0] === 'ads') + 1, 0, ['publicidade', 'Gerenciar Ads']);
  SUB.publicidade = 'Campanhas e anúncios patrocinados com o lucro depois do Ads, e as ações: pausar, orçamento, ROAS alvo, incluir e tirar anúncios';
  NOTA.publicidade = 'Dados de Ads coletados de 3 em 3 horas';

  const F = { so: 'ativos', q: '', conta: '' };
  let D = null;
  const varia = (a, b) => b ? `${a >= b ? '▲' : '▼'} ${pc(Math.abs(a / b - 1), 0)} vs 30 dias antes` : '30 dias antes: 0';
  const x2 = v => v == null ? '—' : `${String(Math.round(v * 10) / 10).replace('.', ',')}x`;

  VIEWS.publicidade = async function () {
    D = await api('pub/painel');
    const A = D.resumo.atual, P = D.resumo.anterior, S = D.resumo.semana, C = D.cartoes;
    $('#view').innerHTML = `<div class="kgrid">${kpi('Investimento', brl(A.custo), varia(A.custo, P.custo), 'ads', 'red')}${kpi('Receita com Ads', brl(A.receita), varia(A.receita, P.receita), 'lucro', 'green')}
        ${kpi('ROAS', x2(A.custo ? A.receita / A.custo : null), `ACOS ${A.receita ? pc(A.custo / A.receita, 1) : '—'} · antes ${x2(P.custo ? P.receita / P.custo : null)}`, 'abc', 'blue')}
        ${kpi('Vendas por Ads', num(A.vendas), `${num(S.vendas)} nos últimos 7 dias`, 'pedidos', 'purple')}${kpi('Impressões', num(A.impressoes), `${num(A.cliques)} cliques · ${A.impressoes ? pc(A.cliques / A.impressoes, 2) : '—'}`, 'visao', 'teal')}</div>
      <div class="kgrid"><div data-pf="prejuizo" style="cursor:pointer">${kpi('Ads com prejuízo', num(C.prejuizo), 'ACOS maior que a margem antes do Ads', 'alertas', C.prejuizo ? 'red' : 'green')}</div>
        <div data-pf="sugeridos" style="cursor:pointer">${kpi('Sugeridos pelo ML', num(C.sugeridos), 'recomendados e fora de campanha', 'rocket', C.sugeridos ? 'amber' : 'slate')}</div>
        <div data-pf="semvenda" style="cursor:pointer">${kpi('Gasto sem venda', num(C.semVenda), 'ativos que gastaram e não venderam (90 dias)', 'cancel', C.semVenda ? 'red' : 'slate')}</div>
        <div data-pf="retidos" style="cursor:pointer">${kpi('Retidos', num(C.retidos), 'o ML segurou (sem estoque, pausado…)', 'info', 'slate')}</div></div>
      <div class="box" style="margin-bottom:14px"><div class="boxh"><h3>Campanhas</h3><small>últimos 30 dias · mude orçamento, ROAS alvo ou estratégia e clique em Salvar</small></div>
        <div class="tw" style="max-height:none"><table class="rt"><thead><tr><th>Campanha</th><th>Situação</th><th class="n">Orçamento/dia</th><th class="n">ROAS alvo</th><th>Estratégia</th><th class="n">Investido</th><th class="n">Receita</th><th class="n">ACOS</th><th class="n">Impressões</th><th></th></tr></thead><tbody id="pcb"></tbody></table></div></div>
      <div class="box"><div class="boxh"><h3>Anúncios patrocinados</h3><small>gasto e receita de 90 dias · margem e lucro dos últimos 30 dias</small></div>
        <div class="vd-f" style="margin-bottom:10px"><label style="flex:1;min-width:200px">Buscar<input type="search" id="paq" placeholder="Título ou MLB"></label>
          <label>Conta<select id="pac"><option value="">Todas</option>${D.lojas.map(l => `<option value="${esc(l.loja)}">${esc(l.nome)}</option>`).join('')}</select></label>
          <label>Mostrar<select id="pas"><option value="ativos">Ativos</option><option value="prejuizo">Com prejuízo</option><option value="semvenda">Gasto sem venda</option><option value="sugeridos">Sugeridos pelo ML</option><option value="fora">Fora de campanha</option><option value="pausados">Pausados</option><option value="retidos">Retidos</option><option value="">Todos</option></select></label><span id="pafs"></span></div>
        <div class="tw" style="max-height:none"><table class="rt"><thead><tr><th>Anúncio</th><th>Situação / campanha</th><th class="n">Investido</th><th class="n">Receita Ads</th><th class="n">ACOS</th><th class="n">Margem antes</th><th class="n">Margem depois</th><th class="n">Lucro 30 dias</th><th>Ações</th></tr></thead><tbody id="pab"></tbody></table></div></div>`;
    $('#pas').value = F.so; $('#pac').value = F.conta; $('#paq').value = F.q;
    $('#pas').onchange = $('#pac').onchange = $('#paq').oninput = () => { F.so = $('#pas').value; F.conta = $('#pac').value; F.q = $('#paq').value.trim().toLowerCase(); desenhaAnuncios(); };
    document.querySelectorAll('[data-pf]').forEach(c => c.onclick = () => { F.so = c.dataset.pf; $('#pas').value = F.so; desenhaAnuncios(); $('#pab').closest('.box').scrollIntoView({ behavior: 'smooth' }); });
    window.filtrosSalvos?.($('#pafs'), 'publicidade', () => ({ ...F }), f => { Object.assign(F, f); $('#pas').value = F.so; $('#pac').value = F.conta; $('#paq').value = F.q; desenhaAnuncios(); });
    $('#pcb').onclick = acaoCampanha; $('#pab').onclick = acaoAnuncio; $('#pab').onchange = e => { if (e.target.matches('select[data-mv]') && e.target.value) acaoAnuncio({ target: e.target }); };
    desenhaCampanhas(); desenhaAnuncios();
  };

  function desenhaCampanhas() {
    $('#pcb').innerHTML = D.campanhas.map(c => `<tr data-c="${esc(c.loja)}|${esc(c.id)}"><td><b>${esc(c.nome)}</b><small>${esc(c.nomeLoja)} · ${num(c.anuncios)} anúncio(s) ativo(s)</small></td>
      <td><span class="tag ${c.status === 'active' ? 'ok' : 'warn'}">${c.status === 'active' ? 'Ativa' : 'Pausada'}</span><div class="pu-ac" style="margin-top:4px"><button class="btn2" data-st="${c.status === 'active' ? 'paused' : 'active'}">${c.status === 'active' ? 'Pausar' : 'Ativar'}</button></div></td>
      <td class="n"><input data-f="orcamento" inputmode="decimal" value="${c.orcamento != null ? String(c.orcamento).replace('.', ',') : ''}">${c.perdidoOrcamento > 0.15 ? `<small class="warn" title="Impressões perdidas por orçamento">perde ${pc(c.perdidoOrcamento, 0)} por orçamento</small>` : ''}</td>
      <td class="n"><input data-f="roas" inputmode="decimal" value="${c.roas != null ? String(c.roas).replace('.', ',') : ''}"><small>ACOS alvo ${c.acosAlvo != null ? `${String(c.acosAlvo).replace('.', ',')}%` : '—'}</small></td>
      <td><select data-f="estrategia">${[['profitability', 'Rentabilidade'], ['increase', 'Crescimento'], ['visibility', 'Visibilidade']].map(([v, t]) => `<option value="${v}"${c.estrategiaId === v ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
      <td class="n">${brl(c.custo)}</td><td class="n">${brl(c.receita)}<small>${num(c.vendas)} venda(s)</small></td><td class="n">${c.acos != null ? pc(c.acos, 1) : '—'}${c.acosReferencia ? `<small>referência ${String(c.acosReferencia).replace('.', ',')}%</small>` : ''}</td>
      <td class="n">${c.parcela != null ? pc(c.parcela, 0) : '—'}${c.perdidoRank > 0.3 ? `<small title="Impressões perdidas por classificação do anúncio">perde ${pc(c.perdidoRank, 0)} por classificação</small>` : ''}</td>
      <td><button class="btn2" data-sv="1" style="padding:5px 10px;font-size:12px">Salvar</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">Nenhuma campanha de Product Ads coletada.</td></tr>';
  }
  const FILTRO = { ativos: a => a.status === 'active', prejuizo: a => a.status === 'active' && a.prejuizo, semvenda: a => a.status === 'active' && a.custo90 > 0 && !a.receita90, sugeridos: a => a.status === 'idle' && a.recomendado,
    fora: a => a.status === 'idle', pausados: a => a.status === 'paused', retidos: a => a.status === 'hold', '': () => true };
  function desenhaAnuncios() {
    const L = D.anuncios.filter(a => FILTRO[F.so](a) && (!F.conta || a.loja === F.conta) && (!F.q || `${a.titulo} ${a.item}`.toLowerCase().includes(F.q)));
    const camps = l => D.campanhas.filter(c => c.loja === l);
    $('#pab').innerHTML = L.slice(0, 400).map(a => { const cs = camps(a.loja).filter(c => c.id !== a.campanha);
      return `<tr data-a="${esc(a.loja)}|${esc(a.item)}"><td><div class="pr">${thumb(a.thumb)}<div><b title="${esc(a.titulo)}">${esc(a.titulo)}</b><small>${esc(a.item)} · ${esc(a.nomeLoja)}${a.recomendado && a.status === 'idle' ? ' · <span class="warn">sugerido pelo ML</span>' : ''}</small></div></div></td>
        <td><span class="tag ${a.status === 'active' ? 'ok' : a.status === 'hold' ? 'bad' : 'warn'}">${esc(a.statusTxt)}</span><small>${esc(a.nomeCampanha || 'sem campanha')}</small></td>
        <td class="n">${brl(a.custo90)}</td><td class="n">${brl(a.receita90)}<small>${num(a.vendas90)} venda(s)</small></td><td class="n">${a.acos != null ? `<b class="${a.prejuizo ? 'bad' : ''}">${pc(a.acos, 1)}</b>` : '—'}</td>
        <td class="n">${a.margemPre != null ? mgPill(a.margemPre, false) : '<small class="warn">sem custo</small>'}</td><td class="n">${a.margemPos != null ? mgPill(a.margemPos, false) : '—'}</td>
        <td class="n">${a.lucro30 != null ? `<b class="${a.lucro30 < 0 ? 'bad' : 'ok'}">${brl(a.lucro30)}</b><small>Ads ${brl(a.ads30)}</small>` : '—'}</td>
        <td><div class="pu-ac">${a.status === 'active' ? '<button class="btn2" data-ac="pausar">Pausar</button>' : a.status === 'paused' ? '<button class="btn2" data-ac="ativar">Ativar</button>' : ''}
          ${a.campanha && a.status !== 'idle' ? '<button class="btn2" data-ac="tirar">Tirar</button>' : ''}
          ${cs.length ? `<select data-mv="${a.status === 'idle' || !a.campanha ? 'incluir' : 'mover'}"><option value="">${a.status === 'idle' || !a.campanha ? 'Incluir em…' : 'Mover para…'}</option>${cs.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select>` : ''}</div></td></tr>`; }).join('')
      || '<tr><td colspan="9" class="empty">Nenhum anúncio aqui.</td></tr>';
  }

  async function recarrega() { try { D = await api('pub/painel'); desenhaCampanhas(); desenhaAnuncios(); } catch { /* a próxima visita atualiza */ } }
  async function acaoCampanha(e) {
    const tr = e.target.closest('tr[data-c]'), b = e.target.closest('button'); if (!tr || !b) return;
    const [loja, id] = tr.dataset.c.split('|'), c = D.campanhas.find(x => x.loja === loja && x.id === id), corpo = { loja, id }, mud = [];
    if (b.dataset.st) { corpo.status = b.dataset.st; mud.push(b.dataset.st === 'paused' ? 'pausar a campanha (os anúncios dela param de aparecer como patrocinados)' : 'ativar a campanha'); }
    else {
      const n = s => Number(String(s).replace(/\./g, '').replace(',', '.')), o = n(tr.querySelector('[data-f=orcamento]').value), r = n(tr.querySelector('[data-f=roas]').value), es = tr.querySelector('[data-f=estrategia]').value;
      if (o > 0 && o !== c.orcamento) { corpo.orcamento = o; mud.push(`orçamento diário ${brl(c.orcamento)} → <b>${brl(o)}</b>`); }
      if (r > 0 && r !== c.roas) { corpo.roas = r; mud.push(`ROAS alvo ${x2(c.roas)} → <b>${x2(r)}</b> (ACOS alvo ${String(Math.round(10000 / r) / 100).replace('.', ',')}%)`); }
      if (es !== c.estrategiaId) { corpo.estrategia = es; mud.push(`estratégia ${esc(c.estrategia || '—')} → <b>${esc(tr.querySelector('[data-f=estrategia] option:checked').textContent)}</b>`); }
      if (!mud.length) return avisoAcao('Nada mudou nesta campanha.', true);
    }
    if (!await confirmaAcao({ titulo: `Campanha ${c.nome}`, texto: `Conta ${esc(c.nomeLoja)}:<br>${mud.join('<br>')}`, botao: 'Confirmar' })) return;
    b.disabled = true;
    try { await postAcao('api/pub/campanha', corpo); avisoAcao('Campanha atualizada no Mercado Livre.'); await recarrega(); } catch (er) { avisoAcao(er.message, true); b.disabled = false; }
  }
  async function acaoAnuncio(e) {
    const tr = e.target.closest('tr[data-a]'); if (!tr) return;
    const b = e.target.closest('button[data-ac]'), s = e.target.closest('select[data-mv]'); if (!b && !(s && s.value && e.type !== 'click')) return;
    const [loja, item] = tr.dataset.a.split('|'), a = D.anuncios.find(x => x.loja === loja && x.item === item), acao = b ? b.dataset.ac : s.dataset.mv, camp = s?.value || null;
    const nomeC = id => D.campanhas.find(c => c.loja === loja && c.id === id)?.nome || id;
    const txt = { pausar: 'para de aparecer como patrocinado', ativar: 'volta a aparecer como patrocinado', tirar: `sai da campanha <b>${esc(a.nomeCampanha || '')}</b>`, mover: `vai para a campanha <b>${esc(nomeC(camp))}</b>`, incluir: `entra na campanha <b>${esc(nomeC(camp))}</b>` }[acao];
    const ok = await confirmaAcao({ titulo: 'Anúncio patrocinado', texto: `${esc(a.titulo)} (${esc(a.item)}) ${txt}.${acao === 'incluir' && a.margemPre != null ? `<br>Margem antes do Ads: ${pc(a.margemPre, 0)}.` : ''}`, botao: 'Confirmar' });
    if (!ok) { if (s) s.value = ''; return; }
    try { await postAcao('api/pub/anuncio', { loja, item, acao, campanha: camp }); avisoAcao('Feito no Mercado Livre.'); await recarrega(); } catch (er) { avisoAcao(er.message, true); if (s) s.value = ''; }
  }
})();
