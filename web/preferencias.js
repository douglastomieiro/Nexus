// Do jeito de cada pessoa: módulos ligados, "Minhas regras", Resumo e avisos do sino, menu (favoritos, ordem, abas escondidas),
// colunas e filtros salvos, e perfis de uso com senha. Tela em Configurações › Personalizar.
// O que vale para a operação inteira (módulos, regras, perfis) fica no servidor; o que é gosto de quem usa fica neste navegador.
// Carregado por último: troca montaMenu/montaAbas do index.html para aplicar os módulos, o perfil e o menu pessoal.
(() => {
  document.head.insertAdjacentHTML('beforeend', `<style>
#menu a.mfav span::before{content:'★ ';color:#f59e0b}#menu .msep{height:1px;background:var(--line);margin:6px 10px}
.pz-sec{margin-bottom:14px}.pz-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.pz-m{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--bd);border-radius:10px;padding:10px 12px;cursor:pointer}.pz-m input{margin-top:3px}.pz-m b{display:block;color:var(--tx1);font-size:13px}.pz-m small{color:var(--mut)}
.pz-f{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px 16px}.pz-f label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--tx2)}.pz-f input{padding:6px 8px}.pz-f small{color:var(--mut);font-size:11px}
.pz-l{width:100%;border-collapse:collapse;font-size:12.5px}.pz-l td,.pz-l th{padding:6px 6px;border-top:1px solid var(--line);text-align:left;vertical-align:middle}.pz-l th{font-size:10.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;border-top:0}
.pz-l button.mini{background:none;border:1px solid var(--bd);border-radius:6px;color:var(--tx2);cursor:pointer;padding:2px 7px}.pz-l .on{color:#f59e0b}
.pz-bar{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;align-items:center}.pz-bar small{margin-right:auto;color:var(--mut)}
#pzlog{position:fixed;inset:0;z-index:90;background:var(--bg);display:grid;place-items:center;padding:16px}#pzlog .cx{background:var(--panel);border:1px solid var(--bd);border-radius:16px;padding:26px;width:min(360px,94vw);box-shadow:0 20px 50px rgba(0,0,0,.25)}
#pzlog h3{margin:0 0 4px}#pzlog p{color:var(--mut);font-size:13px;margin:0 0 16px}#pzlog label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--tx2);margin-bottom:10px}#pzlog input,#pzlog select{padding:8px 10px}#pzlog button{width:100%;margin-top:6px}
#pzeu{background:none;border:1px solid var(--bd);border-radius:8px;color:var(--tx2);font-size:12px;padding:4px 9px;cursor:pointer;margin-right:6px}
.vd-fs{display:flex;gap:6px;align-items:flex-end}.vd-fs select{max-width:180px}
</style>`);

  // ───────── estado ─────────
  const L = { ler: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, grava: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: vale só agora */ } } };
  window.prefLocal = L;
  const REGRAS0 = { margemMin: 15, coberturaDias: 30, estoqueMinDias: 7, acosMax: 0, qualidadeMin: 60, respostaMin: 60, reputacao: { reclamacoes: [2, 1], atrasos: [10, 6], cancelamentos: [1.5, 0.5] } };
  window.REGRAS = REGRAS0; window.PREFS = null;
  // abas de cada módulo (os módulos que são grupos inteiros vão pelo nome do grupo)
  const MODTABS = { atendimento: { tabs: ['atendimento'] }, vendas: { tabs: ['vendas', 'aovivo', 'envios'] }, anuncios: { tabs: ['anuncios', 'catalogo', 'estoque'] },
    ads: { tabs: ['ads', 'campanhas', 'anunciosads', 'publicidade'] }, promocoes: { tabs: ['promocoes', 'descontos'] }, financas: { grupo: 'Finanças' }, metrics: { grupo: 'Nexus Metrics' }, shopee: { grupo: 'Gestão Shopee', tabs: ['consolidado'] } };
  const SEMPRE = new Set(['central', 'personalizar', 'config', 'contas']);
  let ORIG = null; // o menu completo, como as telas o montaram
  const clona = G => G.map(g => ({ ...g, tabs: g.tabs.map(t => [...t]) }));
  const tabsDe = id => { const m = MODTABS[id]; if (!m) return []; const g = (ORIG || GRUPOS).find(x => x.n === m.grupo); return [...(m.tabs || []), ...(g ? g.tabs.map(t => t[0]) : [])]; };
  window.moduloLigado = id => !window.PREFS || window.PREFS.modulos[id] !== false && (() => { const eu = window.PREFS.perfis.eu; return !eu || eu.dono || !eu.modulos || eu.modulos.includes(id); })();
  function escondidas() {
    const H = new Set(L.ler('menu:ocultas', []));
    if (window.PREFS) for (const id of Object.keys(MODTABS)) if (!window.moduloLigado(id)) tabsDe(id).forEach(t => H.add(t));
    if (window.PREFS?.perfis.eu && !window.PREFS.perfis.eu.dono) H.add('raw'); // o explorador da API fica só com o dono
    SEMPRE.forEach(t => H.delete(t)); return H;
  }
  const nomeTab = k => { for (const g of ORIG || GRUPOS) { const t = g.tabs.find(x => x[0] === k); if (t) return t[1]; } return k; };
  function aplicaMenu() {
    if (!ORIG) ORIG = clona(GRUPOS);
    const H = escondidas(), ordem = L.ler('menu:ordem', []), pos = n => { const i = ordem.indexOf(n); return i < 0 ? 999 + ORIG.findIndex(g => g.n === n) : i; };
    GRUPOS.length = 0;
    for (const g of [...ORIG].sort((a, b) => pos(a.n) - pos(b.n))) { const tabs = g.tabs.filter(t => !H.has(t[0])); if (tabs.length) GRUPOS.push({ ...g, tabs }); }
  }
  const visivel = v => GRUPOS.some(g => g.tabs.some(t => t[0] === v));
  if (typeof montaMenu === 'function') {
    const mm = montaMenu;
    montaMenu = function () { // eslint-disable-line no-global-assign
      aplicaMenu(); mm();
      const fav = L.ler('menu:favoritos', []).filter(visivel);
      if (fav.length) $('#menu').insertAdjacentHTML('afterbegin', fav.map(k => `<a class="mfav" href="#${k}">${svgIco(k)}<span>${esc(nomeTab(k))}</span></a>`).join('') + '<div class="msep"></div>');
    };
  }
  if (typeof montaAbas === 'function') {
    const ma = montaAbas;
    montaAbas = function (v) { if (ORIG && !visivel(v) && VIEWS.central) { location.replace('#central'); return; } ma(v); }; // eslint-disable-line no-global-assign
  }
  const refazMenu = () => { if ($('#menu')?.children.length) { montaMenu(); montaAbas((location.hash.slice(1) || 'central').split(':')[0]); } };

  // ───────── carga das preferências, login e "sair" ─────────
  async function carrega() {
    try { const r = await fetch('api/prefs'); if (!r.ok) return; window.PREFS = await r.json(); } catch { return; }
    window.REGRAS = { ...REGRAS0, ...window.PREFS.regras };
    if (window.PREFS.perfis.precisaLogin) return entrar();
    refazMenu(); botaoEu();
    if ($('#view')?.children.length && JSON.stringify(window.PREFS.regras) !== JSON.stringify(REGRAS0)) go(); // a primeira tela abriu com as regras padrão: redesenha com as suas
  }
  function botaoEu() {
    const eu = window.PREFS?.perfis.eu, ph = document.querySelector('.ph'); if (!eu || !ph || $('#pzeu')) return;
    const b = document.createElement('button'); b.id = 'pzeu'; b.type = 'button'; b.title = 'Sair deste perfil'; b.textContent = `${eu.nome} · sair`;
    b.onclick = async () => { await fetch('api/logout', { method: 'POST' }).catch(() => null); location.reload(); };
    ph.insertBefore(b, ph.firstChild?.nextSibling || null);
  }
  function entrar() {
    if ($('#pzlog')) return; const P = window.PREFS?.perfis;
    const d = document.createElement('div'); d.id = 'pzlog';
    d.innerHTML = `<form class="cx"><h3>Entrar</h3><p>Escolha o seu perfil e digite a senha.</p>
      <label>Perfil<select id="pzp">${(P?.opcoes || []).map(o => `<option value="${esc(o.id)}">${esc(o.nome)}</option>`).join('')}</select></label>
      <label>Senha<input id="pzs" type="password" autocomplete="current-password"></label><button type="submit">Entrar</button><small id="pze" class="bad" style="display:block;margin-top:8px"></small></form>`;
    document.body.appendChild(d); const ult = L.ler('perfil:ultimo', null); if (ult && P?.opcoes.some(o => o.id === ult)) $('#pzp').value = ult; $('#pzs').focus();
    d.querySelector('form').onsubmit = async e => { e.preventDefault(); $('#pze').textContent = '';
      const r = await fetch('api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ perfil: $('#pzp').value, senha: $('#pzs').value }) }).catch(() => null);
      if (r?.ok) { L.grava('perfil:ultimo', $('#pzp').value); location.reload(); } else $('#pze').textContent = (await r?.json().catch(() => null))?.erro || 'Não foi possível entrar.'; };
  }
  // qualquer resposta "entre com o seu perfil" (sessão vencida) abre a tela de entrada
  const f0 = window.fetch.bind(window);
  window.fetch = async (...a) => { const r = await f0(...a); if (r.status === 401 && String(a[0]).includes('api/') && !String(a[0]).includes('api/login')) r.clone().json().then(j => { if (j?.login) { window.PREFS ||= { perfis: {} }; fetch('api/prefs').then(x => x.json()).then(p => { window.PREFS = p; entrar(); }).catch(entrar); } }).catch(() => {}); return r; };
  carrega();

  // ───────── filtros salvos (usado pelas telas de vendas, anúncios e Ads) ─────────
  // chave = tela; pega = () => filtros atuais; aplica = filtros → tela
  window.filtrosSalvos = (el, chave, pega, aplica) => {
    if (!el) return; const k = 'filtros:' + chave;
    const desenha = () => { const S = L.ler(k, []);
      el.innerHTML = `<span class="vd-fs"><select title="Filtros salvos"><option value="">Filtros salvos${S.length ? ` (${S.length})` : ''}</option>${S.map((s, i) => `<option value="${i}">${esc(s.nome)}</option>`).join('')}</select><button class="btn2" type="button" style="padding:5px 9px;font-size:12px" title="Salvar os filtros de agora com um nome">Salvar filtro</button></span>`;
      el.querySelector('select').onchange = e => { const s = L.ler(k, [])[e.target.value]; if (s) aplica(JSON.parse(JSON.stringify(s.f))); e.target.value = ''; };
      el.querySelector('button').onclick = () => { const nome = prompt('Nome para estes filtros (ex.: Full sem estoque):'); if (!nome?.trim()) return; const S2 = L.ler(k, []).filter(s => s.nome !== nome.trim()); S2.push({ nome: nome.trim(), f: pega() }); L.grava(k, S2); desenha(); avisoAcao?.('Filtro salvo. Ele aparece na lista "Filtros salvos".'); }; };
    desenha();
  };

  // ───────── Configurações › Personalizar ─────────
  ICO.personalizar = '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>';
  const gc = GRUPOS.find(g => g.n === 'Configurações'); if (gc && !gc.tabs.some(t => t[0] === 'personalizar')) gc.tabs.splice(gc.tabs.findIndex(t => t[0] === 'config') + 1, 0, ['personalizar', 'Personalizar']);
  SUB.personalizar = 'Deixe o sistema do seu jeito: o que aparece, o que é importante e quem pode fazer o quê';
  if (typeof SEM_FILTRO === 'object') SEM_FILTRO.personalizar = 1;

  const BLOCOS = [['atendimento', 'Atendimento'], ['envios', 'Envios de hoje'], ['anuncios', 'Anúncios'], ['publicidade', 'Publicidade'], ['semana', 'Números da semana'], ['grafico', 'Gráfico dos 7 dias'], ['reputacao', 'Reputação'], ['fatura', 'Fatura do ML']];
  const PEND = [['perguntas', 'Perguntas sem resposta'], ['mensagens', 'Mensagens não lidas'], ['reclamacoes', 'Reclamações abertas'], ['reclamacoesPrazo', 'Reclamação com prazo em 24 h'], ['paraImprimir', 'Etiquetas para imprimir'],
    ['atrasadas', 'Envios atrasados'], ['nfPendente', 'NF-e para anexar'], ['semEstoque', 'Anúncios sem estoque'], ['qualidade', 'Qualidade abaixo do mínimo'], ['catalogo', 'Catálogo sem ganhar'], ['reporFull', 'Repor no Full'],
    ['semCusto', 'Sem custo cadastrado'], ['adsPrejuizo', 'Ads com prejuízo']];
  window.RESUMO_PADRAO = { ordem: BLOCOS.map(b => b[0]), ocultos: [], urgentes: ['perguntas', 'mensagens', 'reclamacoesPrazo', 'atrasadas', 'nfPendente'] };
  const AVISOS = [['pergunta', 'Pergunta nova'], ['mensagem', 'Mensagem de comprador'], ['reclamacao', 'Reclamação nova'], ['devolucao', 'Devolução (Shopee)'], ['chat', 'Chat (Shopee)']];

  VIEWS.personalizar = async function () {
    const r = await fetch('api/prefs'); const P = window.PREFS = await r.json(); window.REGRAS = { ...REGRAS0, ...P.regras };
    const dono = !P.perfis.ativo || !!P.perfis.eu?.dono, R = window.REGRAS, RS = { ...window.RESUMO_PADRAO, ...L.ler('resumo:config', {}) };
    const trava = dono ? '' : ' disabled', ordB = [...RS.ordem, ...BLOCOS.map(b => b[0]).filter(b => !RS.ordem.includes(b))];
    const pct = v => String(v).replace('.', ',');
    $('#view').innerHTML = `${dono ? '' : '<div class="note">Módulos, regras e perfis só o perfil dono muda. O resto desta tela é do seu jeito, neste navegador.</div>'}
      <div class="box pz-sec"><div class="boxh"><h3>Módulos</h3><small>o que fica desligado some do menu, do Resumo e do sino, e a coleta dele para</small></div>
        <div class="pz-g">${P.defs.map(m => `<label class="pz-m"><input type="checkbox" data-mod="${m.id}"${P.modulos[m.id] !== false ? ' checked' : ''}${trava}><span><b>${esc(m.nome)}</b><small>${esc(m.txt)}</small></span></label>`).join('')}</div>
        ${dono ? '<div class="pz-bar"><button id="pzmod">Salvar módulos</button></div>' : ''}</div>
      <div class="box pz-sec"><div class="boxh"><h3>Minhas regras</h3><small>valem para todas as telas: cores, cartões, alertas e o que vira pendência</small></div>
        <div class="pz-f">
          <label>Margem mínima (%)<input data-rg="margemMin" inputmode="decimal" value="${pct(R.margemMin)}"${trava}><small>abaixo disso o anúncio fica vermelho e entra em "abaixo da margem"</small></label>
          <label>Cobertura de estoque desejada (dias)<input data-rg="coberturaDias" inputmode="numeric" value="${R.coberturaDias}"${trava}><small>base da sugestão de reposição do Full</small></label>
          <label>Estoque mínimo (dias)<input data-rg="estoqueMinDias" inputmode="numeric" value="${R.estoqueMinDias}"${trava}><small>cobertura menor que isso fica em vermelho</small></label>
          <label>ACOS máximo do Ads (%)<input data-rg="acosMax" inputmode="decimal" value="${pct(R.acosMax)}"${trava}><small>0 = usar a margem de cada produto</small></label>
          <label>Qualidade mínima do anúncio<input data-rg="qualidadeMin" inputmode="numeric" value="${R.qualidadeMin}"${trava}><small>nota do ML de 0 a 100</small></label>
          <label>Prazo para responder (minutos)<input data-rg="respostaMin" inputmode="numeric" value="${R.respostaMin}"${trava}><small>pergunta mais velha que isso fica marcada</small></label></div>
        <table class="pz-l" style="margin-top:12px"><tr><th>Reputação (60 dias)</th><th>Limite do verde (%)</th><th>Limite MercadoLíder (%)</th></tr>
          ${[['reclamacoes', 'Reclamações'], ['atrasos', 'Envios com atraso'], ['cancelamentos', 'Cancelamentos por você']].map(([k, t]) => `<tr><td>${t}</td><td><input data-rp="${k}|0" inputmode="decimal" value="${pct(R.reputacao[k][0])}" style="width:80px"${trava}></td><td><input data-rp="${k}|1" inputmode="decimal" value="${pct(R.reputacao[k][1])}" style="width:80px"${trava}></td></tr>`).join('')}</table>
        ${dono ? '<div class="pz-bar"><small>Os limites de reputação são uma referência; confira os do ML na central de vendedores.</small><button id="pzrg">Salvar regras</button></div>' : ''}</div>
      <div class="box pz-sec"><div class="boxh"><h3>Resumo</h3><small>o que aparece na tela inicial e em que ordem; o que for urgente sobe para o topo em vermelho (neste navegador)</small></div>
        <div class="two"><table class="pz-l"><tr><th>Bloco</th><th>Mostrar</th><th>Ordem</th></tr>${ordB.map((b, i) => `<tr><td>${esc(BLOCOS.find(x => x[0] === b)?.[1] || b)}</td><td><input type="checkbox" data-bl="${b}"${RS.ocultos.includes(b) ? '' : ' checked'}></td>
          <td><button class="mini" data-bo="${i}|-1">↑</button> <button class="mini" data-bo="${i}|1">↓</button></td></tr>`).join('')}</table>
        <table class="pz-l"><tr><th>Pendência</th><th>Urgente</th></tr>${PEND.map(([k, t]) => `<tr><td>${t}</td><td><input type="checkbox" data-ur="${k}"${RS.urgentes.includes(k) ? ' checked' : ''}></td></tr>`).join('')}</table></div></div>
      <div class="box pz-sec"><div class="boxh"><h3>Avisos do sino</h3><small>o que gera cartão e som (neste navegador); tudo continua listado no sino</small></div>
        <div class="pz-g">${AVISOS.map(([k, t]) => `<label class="pz-m"><input type="checkbox" data-av="${k}"${L.ler('notifTipo:' + k, true) ? ' checked' : ''}><span><b>${t}</b></span></label>`).join('')}
          <label class="pz-m"><input type="checkbox" data-avs="notifSom"${(localStorage.getItem('notifSom') ?? '1') === '1' ? ' checked' : ''}><span><b>Som</b><small>toca junto com o cartão</small></span></label>
          <label class="pz-m"><input type="checkbox" data-avs="notifVendas"${(localStorage.getItem('notifVendas') ?? '1') === '1' ? ' checked' : ''}><span><b>Venda nova</b><small>cartão verde e som de caixa</small></span></label></div></div>
      <div class="box pz-sec"><div class="boxh"><h3>Menu</h3><small>★ fixa a tela no topo do menu; ⦸ esconde a aba (neste navegador)</small></div><div id="pzmenu"></div></div>
      <div class="box pz-sec"><div class="boxh"><h3>Colunas e filtros</h3><small>neste navegador</small></div>
        <p class="dica" style="margin:0 0 8px">Nas tabelas: arraste o título da coluna para mudar de lugar; botão direito no título para esconder a coluna ou mostrar as escondidas. Nas telas de vendas, anúncios e Ads, use "Salvar filtro" para guardar uma combinação de filtros.</p>
        <div id="pzcf"></div></div>
      <div class="box pz-sec"><div class="boxh"><h3>Perfis de uso</h3><small>cada pessoa entra com o seu perfil e senha, vê só os módulos dela e só age onde pode</small></div><div id="pzpf"></div></div>`;

    // módulos e regras (servidor)
    $('#pzmod')?.addEventListener('click', async () => { const b = {}; document.querySelectorAll('[data-mod]').forEach(i => { b[i.dataset.mod] = i.checked; });
      try { await postAcao('api/prefs/modulos', b); avisoAcao('Módulos salvos.'); setTimeout(() => location.reload(), 600); } catch (e) { avisoAcao(e.message, true); } });
    $('#pzrg')?.addEventListener('click', async () => { const b = { reputacao: {} }; document.querySelectorAll('[data-rg]').forEach(i => { b[i.dataset.rg] = i.value; });
      document.querySelectorAll('[data-rp]').forEach(i => { const [k, j] = i.dataset.rp.split('|'); (b.reputacao[k] ||= [])[+j] = i.value; });
      try { const r = await postAcao('api/prefs/regras', b); window.REGRAS = { ...REGRAS0, ...r }; avisoAcao('Regras salvas: as telas já usam os valores novos.'); } catch (e) { avisoAcao(e.message, true); } });
    // Resumo (local)
    const salvaRS = mud => { const atual = { ...window.RESUMO_PADRAO, ...L.ler('resumo:config', {}) }; L.grava('resumo:config', { ...atual, ...mud }); };
    document.querySelectorAll('[data-bl]').forEach(i => i.onchange = () => salvaRS({ ocultos: [...document.querySelectorAll('[data-bl]')].filter(x => !x.checked).map(x => x.dataset.bl) }));
    document.querySelectorAll('[data-ur]').forEach(i => i.onchange = () => salvaRS({ urgentes: [...document.querySelectorAll('[data-ur]')].filter(x => x.checked).map(x => x.dataset.ur) }));
    document.querySelectorAll('[data-bo]').forEach(b => b.onclick = () => { const [i, d] = b.dataset.bo.split('|').map(Number), o = [...ordB], j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; salvaRS({ ordem: o }); VIEWS.personalizar(); });
    // avisos (local; o sino lê estas chaves)
    document.querySelectorAll('[data-av]').forEach(i => i.onchange = () => L.grava('notifTipo:' + i.dataset.av, i.checked));
    document.querySelectorAll('[data-avs]').forEach(i => i.onchange = () => { try { localStorage.setItem(i.dataset.avs, i.checked ? '1' : '0'); } catch { /* sem armazenamento */ } });
    desenhaMenu(); desenhaColunas(); desenhaPerfis(P, dono);
  };

  function desenhaMenu() {
    if (!ORIG) ORIG = clona(GRUPOS);
    const fav = L.ler('menu:favoritos', []), oc = L.ler('menu:ocultas', []), ordem = L.ler('menu:ordem', []), pos = n => { const i = ordem.indexOf(n); return i < 0 ? 999 + ORIG.findIndex(g => g.n === n) : i; };
    const G = [...ORIG].sort((a, b) => pos(a.n) - pos(b.n)), H = escondidas();
    $('#pzmenu').innerHTML = `<table class="pz-l"><tr><th>Grupo</th><th>Abas</th><th>Ordem</th></tr>${G.map((g, i) => `<tr><td><b>${esc(g.n)}</b></td><td>${g.tabs.map(([k, t]) => { const fora = H.has(k) && !oc.includes(k);
        return `<span style="display:inline-flex;align-items:center;gap:2px;margin:2px 10px 2px 0;${fora ? 'opacity:.45' : ''}" title="${fora ? 'Desligada pelos módulos ou pelo perfil' : ''}"><button class="mini${fav.includes(k) ? ' on' : ''}" data-fv="${k}" title="Fixar no topo do menu">★</button>${SEMPRE.has(k) ? '' : `<button class="mini" data-oc="${k}" title="${oc.includes(k) ? 'Mostrar' : 'Esconder'}">${oc.includes(k) ? '⦸' : '◉'}</button>`} <span style="${oc.includes(k) ? 'text-decoration:line-through;color:var(--mut)' : ''}">${esc(t)}</span></span>`; }).join('')}</td>
      <td style="white-space:nowrap"><button class="mini" data-go="${i}|-1">↑</button> <button class="mini" data-go="${i}|1">↓</button></td></tr>`).join('')}</table>
      <div class="pz-bar"><button class="btn2" id="pzmz">Voltar o menu ao padrão</button></div>`;
    const muda = () => { desenhaMenu(); refazMenu(); };
    document.querySelectorAll('[data-fv]').forEach(b => b.onclick = () => { const f = L.ler('menu:favoritos', []), k = b.dataset.fv; L.grava('menu:favoritos', f.includes(k) ? f.filter(x => x !== k) : [...f, k]); muda(); });
    document.querySelectorAll('[data-oc]').forEach(b => b.onclick = () => { const o = L.ler('menu:ocultas', []), k = b.dataset.oc; L.grava('menu:ocultas', o.includes(k) ? o.filter(x => x !== k) : [...o, k]); muda(); });
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const [i, d] = b.dataset.go.split('|').map(Number), o = G.map(g => g.n), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; L.grava('menu:ordem', o); muda(); });
    $('#pzmz').onclick = () => { ['menu:favoritos', 'menu:ocultas', 'menu:ordem'].forEach(k => L.grava(k, null)); muda(); };
  }
  function desenhaColunas() {
    const ks = []; try { for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); } catch { /* sem armazenamento */ }
    const oc = ks.filter(k => k.startsWith('colunas-ocultas:')), fs = ks.filter(k => k.startsWith('filtros:')), F = fs.flatMap(k => L.ler(k, []).map((s, i) => ({ k, i, tela: k.slice(8), nome: s.nome })));
    $('#pzcf').innerHTML = `<div class="pz-bar" style="justify-content:flex-start"><span>${oc.length ? `${oc.length} tabela(s) com colunas escondidas` : 'Nenhuma coluna escondida.'}</span>${oc.length ? '<button class="btn2" id="pzco">Mostrar todas as colunas</button>' : ''}</div>
      ${F.length ? `<table class="pz-l" style="margin-top:8px"><tr><th>Filtro salvo</th><th>Tela</th><th></th></tr>${F.map(f => `<tr><td>${esc(f.nome)}</td><td>${esc(f.tela)}</td><td><button class="mini" data-fx="${esc(f.k)}|${f.i}">apagar</button></td></tr>`).join('')}</table>` : ''}`;
    $('#pzco')?.addEventListener('click', () => { oc.forEach(k => L.grava(k, null)); avisoAcao('As colunas escondidas voltaram.'); desenhaColunas(); });
    document.querySelectorAll('[data-fx]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.fx.split('|'), S = L.ler(k, []); S.splice(+i, 1); L.grava(k, S.length ? S : null); desenhaColunas(); });
  }
  function desenhaPerfis(P, dono) {
    const el = $('#pzpf'); if (P.perfis.possivel === false) { el.innerHTML = '<p class="dica" style="margin:0">Perfis com senha só no sistema instalado (aqui cada navegador já é de uma pessoa).</p>'; return; }
    if (!dono) { el.innerHTML = `<p class="dica" style="margin:0">Você entrou como <b>${esc(P.perfis.eu?.nome || '')}</b>.</p>`; return; }
    let lista = P.perfis.lista.map(p => ({ ...p, senha: '' })), ativo = P.perfis.ativo;
    const desenha = () => {
      el.innerHTML = `<label class="pz-m" style="max-width:520px;margin-bottom:10px"><input type="checkbox" id="pzat"${ativo ? ' checked' : ''}><span><b>Pedir perfil e senha para entrar</b><small>desligado, o sistema abre direto como sempre. Esqueceu a senha do dono: inicie o servidor com SEM_LOGIN=1.</small></span></label>
        <table class="pz-l"><tr><th>Nome</th><th>Dono</th><th>Pode agir no ML</th><th>Módulos</th><th>Senha</th><th></th></tr>${lista.map((p, i) => `<tr data-i="${i}"><td><input data-pf="nome" value="${esc(p.nome)}" style="width:130px"></td>
          <td><input type="checkbox" data-pf="dono"${p.dono ? ' checked' : ''}></td><td><input type="checkbox" data-pf="acoes"${p.dono || p.acoes ? ' checked' : ''}${p.dono ? ' disabled' : ''}></td>
          <td>${p.dono ? '<small style="color:var(--mut)">todos, e muda as configurações</small>' : P.defs.map(m => `<label style="display:inline-flex;gap:3px;margin-right:8px;font-size:12px"><input type="checkbox" data-pm="${m.id}"${!p.modulos || p.modulos.includes(m.id) ? ' checked' : ''}>${esc(m.nome)}</label>`).join('')}</td>
          <td><input data-pf="senha" type="password" autocomplete="new-password" placeholder="${p.temSenha ? 'manter a atual' : 'definir senha'}" style="width:130px"></td><td><button class="mini" data-rm="${i}">tirar</button></td></tr>`).join('')}</table>
        <div class="pz-bar"><button class="btn2" id="pzad">+ Perfil</button><button class="btn2" id="pzmd">Modelos: atendimento, expedição, financeiro</button><span style="flex:1"></span><button id="pzps">Salvar perfis</button></div>`;
      const le = () => { lista = [...el.querySelectorAll('tr[data-i]')].map(tr => { const p = lista[+tr.dataset.i], v = s => tr.querySelector(`[data-pf="${s}"]`);
        return { ...p, nome: v('nome').value, dono: v('dono').checked, acoes: v('dono').checked || v('acoes').checked, senha: v('senha').value, modulos: v('dono').checked ? null : [...tr.querySelectorAll('[data-pm]')].filter(x => x.checked).map(x => x.dataset.pm) }; }); ativo = $('#pzat').checked; };
      el.querySelectorAll('[data-pf="dono"]').forEach(c => c.onchange = () => { le(); desenha(); });
      el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { le(); lista.splice(+b.dataset.rm, 1); desenha(); });
      $('#pzad').onclick = () => { le(); lista.push({ nome: lista.length ? '' : 'Dono', dono: !lista.length, acoes: true, modulos: [], senha: '' }); desenha(); };
      $('#pzmd').onclick = () => { le(); const tem = n => lista.some(p => p.nome.toLowerCase() === n.toLowerCase());
        if (!lista.some(p => p.dono)) lista.push({ nome: 'Dono', dono: true, acoes: true, modulos: null, senha: '' });
        [['Atendimento', ['atendimento']], ['Expedição', ['vendas']], ['Financeiro', ['financas', 'promocoes']]].forEach(([n, m]) => { if (!tem(n)) lista.push({ nome: n, dono: false, acoes: n !== 'Financeiro', modulos: m, senha: '' }); });
        desenha(); avisoAcao('Modelos incluídos: defina as senhas e salve.'); };
      $('#pzps').onclick = async () => { le();
        if (ativo && !await confirmaAcao({ titulo: 'Perfis de uso', texto: 'A partir de agora o sistema pede perfil e senha. Você continua dentro como dono.', perigo: 'Guarde a senha do dono: sem ela, só reiniciando o servidor com SEM_LOGIN=1.', marcar: 'Anotei a senha do dono', botao: 'Salvar perfis' })) return;
        try { await postAcao('api/prefs/perfis', { ativo, lista }); avisoAcao('Perfis salvos.'); setTimeout(() => location.reload(), 700); } catch (e) { avisoAcao(e.message, true); } };
    };
    desenha();
  }
})();
