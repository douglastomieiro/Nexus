// Gestão Mercado Livre > Descontos: aplicar/remover desconto (individual, selecionados, todos, falhas), categorias e campanhas do ML.
// Portado do sistema DESCONTOS; mostra também a margem do dashboard no preço do desconto. Carregado depois de jodda.js
// (reaproveita $, esc, brl, num, pc, kpi, sect, mgPill, thS, ordena, parseNum, num2, GRUPOS, ICO, SUB, NOTA, VIEWS).
(() => {
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="descontos.css">');
  ICO.descontos = '<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z"/><path d="M7 7h.01"/>';
  SUB.descontos = 'Aplique, ajuste e desative descontos nos anúncios, em lote ou um a um, com a margem de cada preço';
  NOTA.descontos = 'Anúncios ao vivo do Mercado Livre · aplicar ou desativar grava direto no ML';
  const gml = GRUPOS.find(g => g.n === 'Gestão Mercado Livre');
  if (gml && !gml.tabs.some(t => t[0] === 'descontos')) gml.tabs.splice(gml.tabs.findIndex(t => t[0] === 'promocoes') + 1, 0, ['descontos', 'Descontos']);

  // ───────── estado ─────────
  const D = { contas: [], alvo: [], rows: [], filtered: [], cats: [], catAtiva: null, falhas: false, tipos: new Set(), sel: new Set(), busca: '', sort: { k: null, d: -1 },
    batch: { ativo: false, conta: null, cancelado: false, dias: null, lastLen: 0, errs: 0 }, mg: {}, carregando: false, camp: null, campSel: new Set() };
  const geral = () => D.alvo.length > 1;
  const nomeConta = id => D.contas.find(c => c.id === id)?.nickname || id;
  const fmt = n => num2(Number(n || 0));
  const ref = (rows, mlb) => rows.find(r => r.id === mlb);
  const rowDe = mlb => ref(D.rows, mlb);
  const trunc = (s, n = 60) => { const t = String(s ?? ''); return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…'; };

  // ───────── toast / modal ─────────
  function toast(msg, tipo = 'info', ms = 4000) {
    let c = $('#dt'); if (!c) { document.body.insertAdjacentHTML('beforeend', '<div class="dt" id="dt"></div>'); c = $('#dt'); }
    const el = document.createElement('div'); el.className = tipo; el.textContent = msg; c.appendChild(el); setTimeout(() => el.remove(), ms);
  }
  // botões: [{ t, v, cls }] ; devolve Promise<v do botão | null (Esc / fora)>
  function dModal(titulo, corpo, botoes, { wide = false, onOpen } = {}) {
    return new Promise(res => {
      const el = document.createElement('div'); el.className = 'dm';
      el.innerHTML = `<div class="md${wide ? ' w' : ''}"><div class="mh">${esc(titulo)}</div><div class="mb">${corpo}</div><div class="mf">${botoes.map((b, i) => `<button class="btn3 ${b.cls || ''}" data-i="${i}">${esc(b.t)}</button>`).join('')}</div></div>`;
      const fecha = v => { el.remove(); document.removeEventListener('keydown', esc2); res(v); };
      const esc2 = e => { if (e.key === 'Escape') fecha(null); };
      el.addEventListener('mousedown', e => { if (e.target === el) fecha(null); });
      el.querySelectorAll('.mf button').forEach(b => b.onclick = () => fecha(botoes[+b.dataset.i].v));
      document.addEventListener('keydown', esc2); document.body.appendChild(el);
      el.close = fecha; onOpen?.(el); el.querySelector('input')?.focus();
    });
  }
  const confirmar = (msg, { titulo = 'Confirmar', ok = 'Confirmar', perigo = false } = {}) =>
    dModal(titulo, esc(msg), [{ t: 'Cancelar', v: false }, { t: ok, v: true, cls: 'p' }], { onOpen: el => { if (perigo) el.querySelector('.mf .p').style.background = '#dc2626'; } }).then(v => v === true);
  async function pedirDias(ctx) {
    let val = null;
    const r = await dModal('Duração do desconto', `Por quantos dias o desconto deve durar? (1 a 30)${ctx ? '\n\n' + esc(ctx) : ''}<input type="number" min="1" max="30" value="30" id="ddias">`,
      [{ t: 'Cancelar', v: false }, { t: 'Continuar', v: true, cls: 'p' }], { onOpen: el => { const i = el.querySelector('#ddias'); i.onkeydown = e => { if (e.key === 'Enter') el.querySelector('.p').click(); }; el.querySelector('.p').addEventListener('mousedown', () => { val = i.value; }); el.querySelector('.p').addEventListener('click', () => { val = i.value; }, true); } });
    if (r !== true) return null;
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 1 || n > 30) { toast('Duração inválida. Informe um número entre 1 e 30.', 'warning'); return null; }
    return n;
  }

  // ───────── API ─────────
  async function dapi(metodo, conta, p, corpo) {
    const r = await fetch(`api/descontos/contas/${conta}${p}`, { method: metodo, headers: corpo ? { 'Content-Type': 'application/json' } : undefined, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || j.erro || `HTTP ${r.status}`); e.data = j; throw e; }
    return j;
  }

  // ───────── busca inteligente (medidas escritas de formas diferentes: 8x500 = 500 x 8 = 0,8cm x 50cm) ─────────
  const normBusca = s => {
    let t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/(\d),(\d)/g, '$1.$2').replace(/[×*]/g, 'x');
    t = t.replace(/(\d+(?:\.\d+)?)\s*cm(?![a-wyz])/g, (_, n) => String(Math.round(parseFloat(n) * 10 * 1000) / 1000)).replace(/(\d)\s*mm(?![a-wyz])/g, '$1').replace(/(\d)\s*(?:x|por)\s*(?=\d)/g, '$1x');
    return t;
  };
  const dimsDe = t => (t.match(/\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)+/g) || []).map(g => g.split('x').map(n => String(parseFloat(n))));
  const dimsContem = (big, small) => { const pool = big.slice(); for (const s of small) { const k = pool.indexOf(s); if (k < 0) return false; pool.splice(k, 1); } return true; };
  const parseBusca = q => { const t = normBusca(q); return { dims: dimsDe(t), words: t.replace(/\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)+/g, ' ').split(/\s+/).filter(Boolean) }; };
  function casa(r, q, sq) {
    if (r.id && r.id.toLowerCase().includes(q)) return true;
    if ((r.skus || []).some(s => s && s.toLowerCase().includes(q))) return true;
    if (!sq.dims.length && !sq.words.length) return false;
    const src = `${r.title || ''} ${r.id || ''} ${(r.skus || []).join(' ')}`;
    if (r._src !== src) { r._src = src; r._txt = normBusca(src); r._dims = dimsDe(r._txt); }
    for (const w of sq.words) {
      if (/^\d+(?:\.\d+)?$/.test(w)) { if (!new RegExp('(^|[^\\d.])' + w.replace('.', '\\.') + '(?!\\d|\\.\\d)').test(r._txt)) return false; }
      else if (!r._txt.includes(w)) return false;
    }
    return sq.dims.every(d => r._dims.some(g => dimsContem(g, d)));
  }

  // ───────── tipo de anúncio ─────────
  const flags = r => ({ premium: r.listingType === 'gold_pro' || r.listingType === 'gold_premium', classico: r.listingType === 'gold_special', full: r.logisticType === 'fulfillment' });
  const badgesTipo = r => { const t = flags(r); return (t.classico ? '<span class="tp c">Clássico</span>' : '') + (t.premium ? '<span class="tp p">Premium</span>' : '') + (t.full ? '<span class="tp f">Full</span>' : ''); };
  const passaTipo = r => { const t = flags(r); return !(D.tipos.has('classico') && !t.classico) && !(D.tipos.has('premium') && !t.premium) && !(D.tipos.has('full') && !t.full); };

  // ───────── dados ─────────
  const rowDe2 = (c, ad, d) => ({ id: ad.id, conta: c.id, contaNome: c.nickname, title: ad.title, skus: ad.skus || [], skuPairs: ad.skuPairs, price: ad.price, originalPrice: ad.originalPrice, basePrice: ad.basePrice,
    available: ad.available, sold: ad.sold, thumbnail: ad.thumbnail, status: ad.status, permalink: ad.permalink, listingType: ad.listingType, logisticType: ad.logisticType,
    discountPrice: d ? d.price : null, processing: !!d?.processing, lastAttemptFailed: !!d?.lastAttemptFailed, lastErrorMessage: d?.lastErrorMessage || null, lastRawError: d?.lastRawError || null,
    lastSuccessAt: d?.lastSuccessAt || null, promotionFinishAt: d?.promotionFinishAt || null });
  const base = r => r.basePrice != null ? r.basePrice : r.price;

  async function carregarMargens() {
    await Promise.all(D.alvo.map(async c => {
      const pares = D.rows.filter(r => r.conta === c.id && r.discountPrice != null).map(r => ({ mlb: r.id, preco: r.discountPrice, skus: r.skus }));
      if (!pares.length) return;
      try { const m = (await dapi('POST', c.id, '/margem', { pares })).data; for (const [k, v] of Object.entries(m)) D.mg[c.id + ':' + k] = v; } catch { /* sem margem: segue */ }
    }));
  }
  function aplicaMargem(r) {
    const m = r.discountPrice != null ? D.mg[r.conta + ':' + r.id] : null;
    if (m && Math.abs(m.preco - r.discountPrice) > 0.005) { r.mg = r.mgPct = null; r.mgEst = false; r.mgDet = null; return; }
    r.mg = m ? m.margem : null; r.mgPct = m ? m.margemPct : null; r.mgEst = !!m?.estimado; r.mgDet = m || null;
  }

  async function carregar(fresh) {
    const gen = D.gen; D.carregando = true; mostraCarregando(fresh ? 'Atualizando dados do Mercado Livre…' : 'Carregando anúncios da loja…');
    const res = await Promise.all(D.alvo.map(c => Promise.all([dapi('GET', c.id, '/items' + (fresh ? '?fresh=1' : '')), dapi('GET', c.id, '/discounts'), dapi('GET', c.id, '/categories')])
      .then(([a, d, k]) => ({ c, ads: a.data || [], discs: d.data || [], cats: k.data || [] })).catch(erro => ({ c, erro }))));
    D.rows = []; D.cats = []; D.mg = {};
    for (const x of res) {
      if (x.erro) continue;
      const byMlb = Object.fromEntries(x.discs.map(d => [d.mlb, d]));
      for (const ad of x.ads) D.rows.push(rowDe2(x.c, ad, byMlb[ad.id]));
      if (!geral()) D.cats = x.cats;
    }
    if (gen !== D.gen || !$('#dsc')) return;
    const falhas = res.filter(x => x.erro);
    if (falhas.length) toast(`Falha ao carregar ${falhas.map(x => x.c.nickname + ': ' + x.erro.message).join(' | ')}`, 'warning', 8000);
    await carregarMargens();
    if (gen !== D.gen || !$('#dsc')) return;
    D.rows.forEach(aplicaMargem);
    D.carregando = false; D.catAtiva = null; D.falhas = false; D.sel.clear();
    desenhaTudo();
  }

  // ───────── filtro / ordem ─────────
  function filtra() {
    let b = D.rows;
    const q = D.busca;
    D.mapaCat = null;
    if (q) {
      D.mapaCat = {}; D.cats.forEach(c => (c.mlbs || []).forEach(m => { D.mapaCat[m] = c.name; }));
      const sq = parseBusca(q);
      D.filtered = b.filter(passaTipo).filter(r => casa(r, q, sq));
    } else {
      if (D.falhas) b = b.filter(r => r.lastAttemptFailed);
      else if (D.catAtiva) { const c = D.cats.find(x => x.id === D.catAtiva); if (c) { const s = new Set(c.mlbs); b = b.filter(r => s.has(r.id)); } }
      else { const todas = new Set(); D.cats.forEach(c => (c.mlbs || []).forEach(m => todas.add(m))); if (todas.size) b = b.filter(r => !todas.has(r.id)); }
      D.filtered = b.filter(passaTipo);
    }
    if (D.sort.k) D.filtered = ordena(D.filtered, D.sort);
  }

  // ───────── desenho ─────────
  function tempo(iso) {
    if (!iso) return '<span style="color:var(--mut)">—</span>';
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return '<span class="sg r">Expirado</span>';
    const min = Math.floor(diff / 6e4), d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    const t = d >= 1 ? `${d}d${h ? ' ' + h + 'h' : ''}` : h >= 1 ? `${h}h${m ? ' ' + m + 'min' : ''}` : `${m}min`;
    return `<span class="${diff <= 3 * 864e5 ? 'sg a' : ''}" style="${diff <= 3 * 864e5 ? '' : 'color:var(--mut);font-size:12px'}">${t}</span>`;
  }
  function celulaMargem(r) {
    if (r.discountPrice == null) return '<span style="color:var(--mut)">—</span>';
    if (r.mgPct == null && r.mgDet == null) return `<span class="mg x" title="Sem custo cadastrado ou ainda calculando">s/ custo</span>`;
    const d = r.mgDet, tip = d ? `Preço ${brl(d.preco)} − comissão ${brl(d.comissao)} − frete ${brl(d.frete)} − imposto ${brl(d.imposto)}${d.custo != null ? ' − custo ' + brl(d.custo) : ''}${r.mgEst ? ' (estimativa: faltou tarifa exata ou histórico)' : ''}` : '';
    return r.mg == null ? `<span class="mg x" title="${esc(tip)}">s/ custo</span>`
      : `<span title="${esc(tip)}">${mgPill(r.mgPct)}${r.mgEst ? '<small style="color:var(--mut)"> ~</small>' : ''}<br><small class="${r.mg < 0 ? 'bad' : ''}" style="${r.mg < 0 ? '' : 'color:var(--mut)'}">${brl(r.mg)}/un</small></span>`;
  }
  function linhaHtml(r) {
    const hasPromo = r.originalPrice != null && r.originalPrice > r.price, b = base(r);
    const pv = r.discountPrice != null ? fmt(r.discountPrice) : '';
    let pq = ''; if (r.discountPrice != null && b > 0) { const p = (1 - r.discountPrice / b) * 100; if (p > 0) pq = p.toFixed(1).replace('.', ','); }
    const dis = D.batch.ativo ? 'disabled' : '';
    const pares = r.skuPairs?.length ? r.skuPairs : (r.skus || []).map(s => ({ label: null, sku: s }));
    const sub = `<span class="cp2" data-a="copy" data-v="${esc(r.id)}" title="Clique para copiar">${esc(r.id)}</span>` + pares.map(p => `<span class="cp2" data-a="copy" data-v="${esc(p.sku)}" title="Clique para copiar">${esc(p.label || 'SKU')}: ${esc(p.sku)}</span>`).join('')
      + (D.mapaCat ? `<span class="tp l">📂 ${esc(D.mapaCat[r.id] || 'Sem categoria')}</span>` : '') + (geral() ? `<span class="tp c">${esc(r.contaNome)}</span>` : '');
    const erro = r.lastAttemptFailed && r.lastErrorMessage ? `<div class="err" title="${esc(r.lastRawError && r.lastRawError !== r.lastErrorMessage ? r.lastRawError : r.lastErrorMessage)}">${esc(r.lastErrorMessage)}</div>` : '';
    const titulo = r.permalink ? `<a href="${esc(r.permalink)}" target="_blank" rel="noopener" title="${esc(r.title)}">${esc(trunc(r.title))}</a>` : `<span class="ti" title="${esc(r.title)}">${esc(trunc(r.title))}</span>`;
    return `<tr id="r-${esc(r.id)}" class="${r.lastAttemptFailed ? 'fail' : ''} ${r.processing ? 'proc' : ''} ${D.sel.has(r.id) ? 'sel' : ''}" data-m="${esc(r.id)}">
      <td><input type="checkbox" class="rc" ${D.sel.has(r.id) ? 'checked' : ''}></td>
      <td><div class="pt">${r.thumbnail ? `<img loading="lazy" src="${esc(r.thumbnail)}" alt="">` : '<span class="ph"></span>'}<div class="tt"><div>${titulo}${r.processing ? ' ⏳' : ''}</div>${badgesTipo(r) ? `<div class="bd">${badgesTipo(r)}</div>` : ''}<div class="bd">${sub}</div>${erro}</div></div></td>
      <td class="old n">${brl(b)}</td>
      <td class="n nw ${hasPromo ? 'ok' : ''}"><b>${brl(r.price)}</b>${hasPromo ? `<span class="dc">-${Math.round((1 - r.price / b) * 100)}%</span>` : ''}</td>
      <td class="n">${num(r.available || 0)}</td><td class="n">${r.sold != null ? num(r.sold) : '—'}</td>
      <td><div class="pp"><input class="di pp-p" data-m="${esc(r.id)}" placeholder="R$ 0,00" value="${pv}"><input class="di q pp-q" data-m="${esc(r.id)}" placeholder="%" value="${pq}"></div></td>
      <td class="n" id="mg-${esc(r.id)}">${celulaMargem(r)}</td>
      <td class="nw" title="${esc(r.promotionFinishAt || '')}">${tempo(r.promotionFinishAt)}</td>
      <td class="nw"><button class="btn3 mini" data-a="aplicar" ${dis}>Aplicar</button> <button class="btn3 mini d" data-a="desativar" ${dis}>Desativar</button></td></tr>`;
  }
  function desenhaTabela() {
    const tb = $('#dtb'); if (!tb) return;
    tb.innerHTML = D.filtered.length ? D.filtered.map(linhaHtml).join('') : `<tr><td colspan="10" class="empty">${D.carregando ? 'Carregando…' : 'Nenhum anúncio encontrado.'}</td></tr>`;
    const th = $('#dth'); if (th) th.innerHTML = cab();
    const comDesc = D.rows.filter(r => r.discountPrice != null).length;
    $('#dcount').textContent = D.filtered.length === D.rows.length ? `${D.rows.length} anúncios (${comDesc} com desconto cadastrado)` : `${D.filtered.length} de ${D.rows.length} (${comDesc} com desconto cadastrado)`;
    sincronizaTodos(); atualizaBotoes(); atualizaKpis(); atualizaChipsFalha();
  }
  const cab = () => `<tr><th><input type="checkbox" id="dpall" title="Selecionar todos os filtrados"></th>${thS('Produto', 'title', D.sort)}${thS('Sem desconto', 'basePrice', D.sort, 'n')}${thS('Atual', 'price', D.sort, 'n')}${thS('Estoque', 'available', D.sort, 'n')}${thS('Vendidos', 'sold', D.sort, 'n')}${thS('Preço promo', 'discountPrice', D.sort)}${thS('Margem no preço promo', 'mgPct', D.sort, 'n')}${thS('Tempo', 'promotionFinishAt', D.sort)}<th>Ações</th></tr>`;
  function atualizaLinha(mlb) { const r = rowDe(mlb), el = $('#r-' + CSS.escape(mlb)); if (r && el) { const t = document.createElement('tbody'); t.innerHTML = linhaHtml(r); el.replaceWith(t.firstElementChild); } }
  function flash(mlb, cls) { const el = $('#r-' + CSS.escape(mlb)); if (!el) return; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 2000); }
  function mostraCarregando(msg) { const tb = $('#dtb'); if (tb) tb.innerHTML = `<tr><td colspan="10" class="empty">${esc(msg)}</td></tr>`; }

  function atualizaKpis() {
    if (!$('#dk')) return;
    const r = D.rows, ativos = r.filter(x => x.originalPrice != null && x.originalPrice > x.price).length, preju = r.filter(x => x.discountPrice != null && x.mg != null && x.mg < 0).length;
    $('#dk').innerHTML = kpi('Anúncios ativos', num(r.length), D.alvo.map(c => c.nickname).join(' · '), 'itens', 'blue')
      + kpi('Com desconto cadastrado', num(r.filter(x => x.discountPrice != null).length), 'preço promo definido', 'descontos', 'amber')
      + kpi('Em promoção no ML', num(ativos), 'preço atual abaixo do preço normal', 'promocoes', 'green')
      + kpi('Com falha', num(r.filter(x => x.lastAttemptFailed).length), 'última tentativa deu erro', 'alertas', 'red')
      + kpi('Prejuízo no preço promo', num(preju), 'margem negativa no preço cadastrado', 'dre', preju ? 'red' : 'purple');
  }
  function desenhaCats() {
    const el = $('#dcats'); if (!el) return;
    if (geral()) { el.innerHTML = '<span style="color:var(--mut);font-size:12px">Selecione uma loja no filtro acima para usar as categorias.</span><span id="dfail"></span>'; atualizaChipsFalha(); return; }
    const todas = new Set(); D.cats.forEach(c => (c.mlbs || []).forEach(m => todas.add(m)));
    el.innerHTML = `<span class="chip ${!D.catAtiva && !D.falhas ? 'on' : ''}" data-a="cat" data-v="">Sem categoria <em>${D.rows.filter(r => !todas.has(r.id)).length}</em></span>`
      + D.cats.map(c => `<span class="chip ${D.catAtiva === c.id && !D.falhas ? 'on' : ''}" data-a="cat" data-v="${esc(c.id)}">${esc(c.name)} <em>${(c.mlbs || []).length}</em><span class="x" data-a="catdel" data-v="${esc(c.id)}" title="Excluir categoria">×</span></span>`).join('')
      + '<span id="dfail"></span>';
    atualizaChipsFalha();
  }
  function atualizaChipsFalha() {
    const el = $('#dfail'); if (!el) return;
    const n = D.rows.filter(r => r.lastAttemptFailed).length;
    el.innerHTML = n ? `<span class="chip bad ${D.falhas ? 'on' : ''}" data-a="falhas">Falhas <em>${n}</em></span>` : '';
    if (!n && D.falhas) { D.falhas = false; filtra(); desenhaTabela(); }
  }
  // contexto do botão "Aplicar…" conforme o filtro atual
  function ctxAplicar() {
    const mlbs = D.filtered.filter(r => r.discountPrice != null).map(r => r.id), n = mlbs.length;
    let label;
    if (D.falhas) label = `Aplicar nas falhas (${n})`;
    else if (geral()) label = D.tipos.size || D.busca ? `Aplicar nos filtrados (${n})` : `Aplicar em todas as lojas (${n})`;
    else if (D.catAtiva) { const c = D.cats.find(x => x.id === D.catAtiva); label = `Aplicar em ${c ? '"' + c.name + '"' : 'categoria'} (${n})`; }
    else label = D.tipos.size || D.busca ? `Aplicar nos filtrados (${n})` : `Aplicar nos não categorizados (${n})`;
    return { label, n, mlbs };
  }
  function atualizaBotoes() {
    const b = $('#dapply'); if (!b) return;
    const c = ctxAplicar(); b.textContent = c.label; b.disabled = !c.n || D.batch.ativo;
    const t = D.rows.filter(r => r.discountPrice != null).length, a = $('#dall'); if (a) { a.textContent = `Aplicar tudo (${t})`; a.disabled = !t || D.batch.ativo; }
  }
  function sincronizaTodos() {
    const cb = $('#dpall'); if (!cb) return;
    const n = D.filtered.filter(r => D.sel.has(r.id)).length;
    cb.checked = !!D.filtered.length && n === D.filtered.length; cb.indeterminate = n > 0 && n < D.filtered.length;
  }
  function desenhaSel() {
    const b = $('#dsel'); if (!b) return;
    b.classList.toggle('on', D.sel.size > 0); $('#dselc').textContent = D.sel.size;
    $('#dadd').style.display = D.sel.size ? '' : 'none'; $('#drm').style.display = D.sel.size && D.catAtiva && !geral() ? '' : 'none'; $('#dcrt').style.display = geral() ? 'none' : '';
    $('#dsc').style.paddingBottom = D.sel.size ? '84px' : '';
  }
  function desenhaTudo() { if (!$('#dsc')) return; filtra(); desenhaCats(); desenhaTabela(); desenhaSel(); }

  // ───────── salvar preço promo (no blur) ─────────
  const getPct = (r) => { const b = base(r); if (r.discountPrice == null || !(b > 0)) return ''; const p = (1 - r.discountPrice / b) * 100; return p > 0 ? p.toFixed(1).replace('.', ',') : ''; };
  const syncPct = mlb => { const r = rowDe(mlb), el = $(`.pp-q[data-m="${CSS.escape(mlb)}"]`); if (r && el) el.value = getPct(r); };
  async function salvarPreco(el) {
    const mlb = el.dataset.m, r = rowDe(mlb); if (!r) return;
    const raw = el.value.trim(), novo = raw === '' ? null : parseNum(raw);
    if (novo === r.discountPrice) { el.classList.remove('dirty'); return; }
    if (novo != null && (isNaN(novo) || novo <= 0)) { toast('Preço inválido', 'error'); el.value = r.discountPrice != null ? fmt(r.discountPrice) : ''; syncPct(mlb); el.classList.remove('dirty'); return; }
    el.classList.add('dirty');
    try {
      if (novo == null) { if (r.discountPrice != null) await dapi('DELETE', r.conta, '/discounts/' + mlb); r.discountPrice = null; delete D.mg[r.conta + ':' + mlb]; }
      else { await dapi('POST', r.conta, '/discounts', { mlb, name: r.title, price: novo }); r.discountPrice = novo; }
      el.classList.remove('dirty'); el.classList.add('saved'); setTimeout(() => el.classList.remove('saved'), 1200);
      syncPct(mlb);
      if (novo != null) { try { const m = (await dapi('POST', r.conta, '/margem', { pares: [{ mlb, preco: novo, skus: r.skus }] })).data; if (m[mlb]) D.mg[r.conta + ':' + mlb] = m[mlb]; } catch { /* sem margem */ } }
      aplicaMargem(r); const c = $('#mg-' + CSS.escape(mlb)); if (c) c.innerHTML = celulaMargem(r);
      atualizaBotoes(); atualizaKpis();
    } catch (e) { el.classList.remove('dirty'); toast('Erro ao salvar: ' + e.message, 'error'); el.value = r.discountPrice != null ? fmt(r.discountPrice) : ''; syncPct(mlb); }
  }
  function pctDigitado(el) {
    const mlb = el.dataset.m, r = rowDe(mlb), pe = $(`.pp-p[data-m="${CSS.escape(mlb)}"]`); if (!r || !pe) return;
    const raw = el.value.trim().replace(',', '.').replace('%', '');
    if (raw === '') { pe.value = ''; return; }
    const p = parseFloat(raw), b = base(r); if (isNaN(p) || p < 0 || p >= 100 || !(b > 0)) return;
    pe.value = fmt(Math.round(b * (1 - p / 100) * 100) / 100); pe.classList.add('dirty');
  }
  async function pctSalvar(el) {
    const mlb = el.dataset.m, pe = $(`.pp-p[data-m="${CSS.escape(mlb)}"]`); if (!pe) return;
    const raw = el.value.trim().replace(',', '.').replace('%', '');
    if (raw !== '') { const p = parseFloat(raw); if (isNaN(p) || p < 0 || p >= 100) { toast('% inválido. Use um número entre 0 e 99.', 'error'); syncPct(mlb); return; } }
    await salvarPreco(pe); syncPct(mlb);
  }

  // ───────── aplicar / desativar ─────────
  function marcaAplicado(r) { if (r.discountPrice == null) return; r.originalPrice = r.basePrice != null && r.discountPrice < r.basePrice ? r.basePrice : null; r.price = r.discountPrice; }
  async function aplicar(mlb) {
    const r = rowDe(mlb); if (!r) return;
    const inp = $(`.pp-p[data-m="${CSS.escape(mlb)}"]`); if (inp) await salvarPreco(inp);
    if (r.discountPrice == null) return toast('Defina um preço promocional antes de aplicar.', 'warning');
    const dias = await pedirDias('Anúncio: ' + r.title); if (dias === null) return;
    r.processing = true; atualizaLinha(mlb);
    try {
      await dapi('POST', r.conta, '/apply-discount/' + mlb, { durationDays: dias });
      Object.assign(r, { processing: false, lastAttemptFailed: false, lastErrorMessage: null, lastSuccessAt: new Date().toISOString(), promotionFinishAt: new Date(Date.now() + dias * 864e5).toISOString() });
      marcaAplicado(r); atualizaLinha(mlb); flash(mlb, 'okf'); atualizaKpis(); toast(`${r.title} — desconto aplicado!`, 'success');
    } catch (e) {
      Object.assign(r, { processing: false, lastAttemptFailed: true, lastErrorMessage: e.data?.friendlyMessage || e.message, lastRawError: e.data?.details?.error || e.message });
      atualizaLinha(mlb); toast(`Falha em ${r.title}: ${r.lastErrorMessage}`, 'error', 6000);
    }
    atualizaChipsFalha();
  }
  function desativado(r) { Object.assign(r, { processing: false, promotionFinishAt: null, lastAttemptFailed: false, lastErrorMessage: null, lastRawError: null }); if (r.basePrice != null) { r.price = r.basePrice; r.originalPrice = null; } }
  async function desativar(mlb) {
    const r = rowDe(mlb); if (!r) return;
    if (!await confirmar('Desativar a promoção deste anúncio no Mercado Livre?', { titulo: 'Desativar promoção', ok: 'Desativar', perigo: true })) return;
    r.processing = true; atualizaLinha(mlb);
    try { await dapi('POST', r.conta, '/remove-promotion/' + mlb); desativado(r); atualizaLinha(mlb); flash(mlb, 'okf'); atualizaKpis(); toast(`${r.title} — promoção desativada no ML`, 'success'); }
    catch (e) { Object.assign(r, { processing: false, lastAttemptFailed: true, lastErrorMessage: e.data?.friendlyMessage || e.message, lastRawError: e.data?.details?.error || e.message }); atualizaLinha(mlb); toast(`Falha em ${r.title}: ${r.lastErrorMessage}`, 'error', 6000); }
    atualizaChipsFalha();
  }

  // ───────── lote ─────────
  const gruposPorConta = mlbs => { const m = {}; mlbs.forEach(id => { const r = rowDe(id); if (r) (m[r.conta] ||= []).push(id); }); return Object.entries(m).map(([conta, mlbs]) => ({ conta, mlbs })); };
  async function aplicarContexto() {
    const c = ctxAplicar(); if (!c.n) return toast('Nenhum anúncio com preço promocional definido nesta visualização.', 'warning');
    const g = gruposPorConta(c.mlbs);
    if (!await confirmar(`${c.label}?\n\n${c.n} anúncio(s) com preço promo${g.length > 1 ? ' em ' + g.length + ' lojas' : ''}. Pode levar alguns minutos.`, { titulo: 'Aplicar em massa', ok: 'Aplicar' })) return;
    const dias = await pedirDias(`${c.n} anúncio(s) na visualização atual.`); if (dias === null) return;
    rodarGrupos(g, c.label, dias);
  }
  async function aplicarTudo() {
    const mlbs = D.rows.filter(r => r.discountPrice != null).map(r => r.id); if (!mlbs.length) return toast('Nenhum anúncio com preço promocional definido.', 'warning');
    if (!await confirmar(`Aplicar a promoção em TODOS os ${mlbs.length} anúncio(s) com preço promo definido, em TODAS as categorias?`, { titulo: 'Aplicar em todas as categorias', ok: 'Aplicar em todas' })) return;
    const dias = await pedirDias(`${mlbs.length} anúncio(s) em todas as categorias.`); if (dias === null) return;
    rodarGrupos(gruposPorConta(mlbs), `Aplicar em todas as categorias (${mlbs.length})`, dias);
  }
  async function rodarGrupos(grupos, titulo, dias) {
    D.batch = { ativo: true, conta: null, cancelado: false, dias, lastLen: 0, errs: 0 }; atualizaBotoes(); desenhaTabela();
    for (let i = 0; i < grupos.length; i++) {
      if (D.batch.cancelado || !$('#dsc')) break;
      const g = grupos[i];
      try {
        const resp = await dapi('POST', g.conta, '/apply-selected-discounts', { mlbs: g.mlbs, durationDays: dias });
        D.batch.conta = g.conta; D.batch.lastLen = 0; D.batch.errs = 0;
        mostraPainel(grupos.length > 1 ? `${titulo} — ${nomeConta(g.conta)} (${i + 1}/${grupos.length})` : titulo); toast(resp.message, 'info');
        await acompanhar(g.conta);
      } catch (e) { toast(`Erro ao iniciar (${nomeConta(g.conta)}): ${e.message}`, 'error'); }
    }
    fimLote();
  }
  function fimLote() { D.batch = { ativo: false, conta: null, cancelado: false, dias: null, lastLen: 0, errs: 0 }; if ($('#dsc')) { atualizaBotoes(); desenhaTabela(); } }
  function mostraPainel(titulo) {
    const p = $('#dbatch'); if (!p) return; p.style.display = '';
    $('#dbt').textContent = titulo; $('#dbb').className = 'sg b'; $('#dbb').textContent = 'Em progresso'; $('#dprog').className = 'prog'; $('#dprog i').style.width = '0%'; $('#dpct').textContent = '0%';
    ['bt', 'bp', 'bs', 'bf', 'bw'].forEach(k => { $('#' + k).textContent = '0'; }); $('#dbcur').textContent = 'Iniciando…';
    const c = $('#dbcancel'); c.style.display = ''; c.disabled = false; c.textContent = 'Cancelar lote';
  }
  function atualizaPainel(d) {
    if (!$('#dbatch')) return;
    let pct; if (!d.isRunning) pct = 100; else if (d.phase === 1) pct = d.phase1.total ? Math.round(d.phase1.processed / d.phase1.total * 50) : 0; else pct = 50 + (d.phase2.total ? Math.round(d.phase2.processed / d.phase2.total * 50) : 50);
    $('#dprog i').style.width = pct + '%'; $('#dpct').textContent = pct + '%';
    $('#bt').textContent = d.total; $('#bp').textContent = d.processed; $('#bs').textContent = d.successCount; $('#bf').textContent = d.failureCount; $('#bw').textContent = d.pendingCount;
    if (d.currentItem) $('#dbcur').textContent = `Item atual: ${d.currentItem.name} (${d.currentItem.mlb})`;
    if (d.results && d.results.length > D.batch.lastLen) {
      const novos = d.results.slice(D.batch.lastLen); D.batch.lastLen = d.results.length;
      for (const x of novos) {
        const r = rowDe(x.mlb); if (!r) continue; r.processing = false;
        if (x.success) { Object.assign(r, { lastAttemptFailed: false, lastErrorMessage: null, lastSuccessAt: new Date().toISOString() }); if (D.batch.dias) r.promotionFinishAt = new Date(Date.now() + D.batch.dias * 864e5).toISOString(); marcaAplicado(r); atualizaLinha(x.mlb); flash(x.mlb, 'okf'); }
        else { Object.assign(r, { lastAttemptFailed: true, lastErrorMessage: x.error || 'Erro', lastRawError: x.rawError || x.error || '' }); atualizaLinha(x.mlb); }
      }
      atualizaKpis();
    }
    if (d.currentItem) { const cur = rowDe(d.currentItem.mlb); if (cur && !cur.processing) { cur.processing = true; atualizaLinha(d.currentItem.mlb); } }
    if (!d.isRunning) {
      $('#dbcancel').style.display = 'none';
      const seg = Math.round((new Date(d.finishedAt) - new Date(d.startedAt)) / 1000);
      if (d.cancelRequested) { $('#dbb').className = 'sg a'; $('#dbb').textContent = 'Cancelado'; $('#dprog').className = 'prog canc'; $('#dbcur').textContent = `Cancelado em ${seg}s`; }
      else { $('#dbb').className = 'sg g'; $('#dbb').textContent = 'Concluído'; $('#dprog').className = 'prog done'; $('#dbcur').textContent = `Finalizado em ${seg}s`; }
    }
  }
  function acompanhar(conta) {
    return new Promise(resolve => {
      const tick = () => {
        if (!$('#dsc')) return resolve(); // saiu da aba: o lote continua no servidor
        dapi('GET', conta, '/discounts-batch-status').then(({ data: d }) => {
          D.batch.errs = 0; atualizaPainel(d);
          if (!d.isRunning) {
            if (d.cancelRequested) { D.batch.cancelado = true; toast(`Lote cancelado: ${d.successCount} aplicado(s), ${d.total - d.successCount} não processado(s).`, 'warning', 6000); }
            else if (d.failureCount > 0) { toast(`Lote concluído: ${d.successCount} OK, ${d.failureCount} falha(s)`, 'warning', 6000); abrirFalhas(); }
            else toast(`Lote concluído: todos os ${d.successCount} itens aplicados!`, 'success', 5000);
            return resolve();
          }
          setTimeout(tick, 2000);
        }).catch(() => { if (++D.batch.errs > 10) { toast('Acompanhamento perdeu a conexão.', 'error', 8000); return resolve(); } setTimeout(tick, 2000); });
      };
      tick();
    });
  }
  async function cancelarLote() {
    const conta = D.batch.conta; if (!conta) return toast('Nenhum lote ativo para cancelar.', 'warning');
    if (!await confirmar('Cancelar o lote? Os itens já aplicados serão mantidos; os pendentes não serão processados.', { titulo: 'Cancelar lote', ok: 'Cancelar lote', perigo: true })) return;
    const b = $('#dbcancel'); b.disabled = true; b.textContent = 'Cancelando…'; $('#dbcur').textContent = 'Cancelando…';
    try { await dapi('POST', conta, '/discounts-batch-cancel'); } catch (e) { toast('Erro ao cancelar: ' + e.message, 'error'); b.disabled = false; b.textContent = 'Cancelar lote'; }
  }
  // F5 ou volta à aba com lote rodando no servidor: retoma o acompanhamento
  async function retomarLote() {
    for (const c of D.alvo) {
      try {
        const { data: d } = await dapi('GET', c.id, '/discounts-batch-status');
        if (d?.isRunning) {
          D.batch = { ativo: true, conta: c.id, cancelado: false, dias: null, lastLen: d.results?.length || 0, errs: 0 }; atualizaBotoes(); desenhaTabela();
          mostraPainel('Lote em andamento — ' + c.nickname); atualizaPainel(d); toast('Retomando acompanhamento do lote de ' + c.nickname + '.', 'info');
          acompanhar(c.id).then(fimLote); return;
        }
      } catch { /* sem status para essa conta */ }
    }
  }
  function abrirFalhas() {
    const f = D.rows.filter(r => r.lastAttemptFailed); if (!f.length) return;
    dModal('Anúncios com falha', `<p style="color:var(--mut);white-space:normal">Estes anúncios não foram aplicados mesmo após a segunda tentativa. Geralmente o anúncio foi excluído no Mercado Livre ou o desconto foi recusado.</p>`
      + f.map(r => `<div class="li rw" style="cursor:default"><div style="min-width:0"><b>${esc(r.title)}</b><small>${esc(r.id)}${geral() ? ' · ' + esc(r.contaNome) : ''}</small><div class="err">${esc(r.lastErrorMessage || 'Erro desconhecido')}</div>${r.lastRawError && r.lastRawError !== r.lastErrorMessage ? `<details><summary style="color:var(--mut);font-size:12px">Detalhes técnicos</summary><pre style="white-space:pre-wrap;font-size:11px">${esc(r.lastRawError)}</pre></details>` : ''}</div></div>`).join(''),
      [{ t: 'Fechar', v: true, cls: 'p' }], { wide: true });
  }

  // ───────── seleção e ações em massa ─────────
  const selecionadas = () => D.rows.filter(r => D.sel.has(r.id));
  function limpaSel() { D.sel.clear(); document.querySelectorAll('#dtb tr.sel').forEach(tr => { tr.classList.remove('sel'); const c = tr.querySelector('.rc'); if (c) c.checked = false; }); sincronizaTodos(); desenhaSel(); }
  async function salvarVarios(pares) {
    const ok = [], falhou = [];
    for (let i = 0; i < pares.length; i += 10) await Promise.all(pares.slice(i, i + 10).map(p => dapi('POST', p.conta, '/discounts', { mlb: p.mlb, name: p.name, price: p.price })
      .then(() => { ok.push(p.mlb); const r = rowDe(p.mlb); if (r) r.discountPrice = p.price; }).catch(() => falhou.push(p.mlb))));
    await carregarMargens(); D.rows.forEach(aplicaMargem);
    return { ok, falhou };
  }
  async function defPreco() {
    if (!D.sel.size) return toast('Nenhum anúncio selecionado.', 'warning');
    const preco = parseNum($('#dbp').value); if (isNaN(preco) || preco <= 0) return toast('Informe um preço válido.', 'warning');
    const pares = []; let ign = 0;
    selecionadas().forEach(r => { const b = base(r); if (b && preco >= b) { ign++; return; } pares.push({ mlb: r.id, name: r.title, price: preco, conta: r.conta }); });
    if (!pares.length) return toast('Preço maior ou igual ao preço base de todos os selecionados.', 'warning');
    if (!await confirmar(`Definir preço promo R$ ${fmt(preco)} em ${pares.length} anúncio(s)${ign ? ` (${ign} ignorado(s) por preço >= base)` : ''}?`, { titulo: 'Definir preço promocional', ok: 'Definir' })) return;
    await fimMassa(await salvarVarios(pares));
  }
  async function defPct() {
    if (!D.sel.size) return toast('Nenhum anúncio selecionado.', 'warning');
    const p = parseNum($('#dbq').value); if (isNaN(p) || p <= 0 || p >= 100) return toast('Informe % entre 1 e 99.', 'warning');
    const pares = []; let ign = 0;
    selecionadas().forEach(r => { const b = base(r); if (!b || b <= 0) { ign++; return; } const preco = Math.round(b * (1 - p / 100) * 100) / 100; if (preco <= 0) { ign++; return; } pares.push({ mlb: r.id, name: r.title, price: preco, conta: r.conta }); });
    if (!pares.length) return toast('Nenhum anúncio elegível.', 'warning');
    if (!await confirmar(`Aplicar ${p}% de desconto em ${pares.length} anúncio(s)${ign ? ` (${ign} sem preço base válido)` : ''}?`, { titulo: 'Aplicar % de desconto', ok: 'Aplicar' })) return;
    await fimMassa(await salvarVarios(pares));
  }
  async function fimMassa(res) {
    if (res.falhou.length) toast(`Falha em ${res.falhou.length} item(ns).`, 'error');
    if (res.ok.length) toast(`${res.ok.length} anúncio(s) atualizados.`, 'success');
    $('#dbp').value = ''; $('#dbq').value = ''; res.ok.forEach(atualizaLinha); atualizaBotoes(); atualizaKpis(); limpaSel();
  }
  async function desativarVarios() {
    const alvos = selecionadas(); if (!alvos.length) return toast('Nenhum anúncio selecionado.', 'warning');
    if (!await confirmar(`Desativar a promoção no Mercado Livre em ${alvos.length} anúncio(s)?`, { titulo: 'Desativar descontos em massa', ok: 'Desativar', perigo: true })) return;
    alvos.forEach(r => { r.processing = true; atualizaLinha(r.id); }); toast('Desativando promoções…', 'info', 2000);
    const ok = [], falhou = []; let cur = 0;
    const worker = async () => { while (cur < alvos.length) { const r = alvos[cur++]; try { await dapi('POST', r.conta, '/remove-promotion/' + r.id); desativado(r); ok.push(r.id); } catch (e) { Object.assign(r, { processing: false, lastAttemptFailed: true, lastErrorMessage: e.data?.friendlyMessage || e.message, lastRawError: e.data?.details?.error || e.message }); falhou.push(r.id); } atualizaLinha(r.id); } };
    await Promise.all(Array.from({ length: Math.min(5, alvos.length) }, worker));
    if (falhou.length) toast(`Falha em ${falhou.length} item(ns).`, 'error'); if (ok.length) toast(`${ok.length} promoção(ões) desativada(s) no ML.`, 'success');
    atualizaKpis(); atualizaChipsFalha(); limpaSel();
  }

  // ───────── categorias ─────────
  async function criarCategoria() {
    if (!D.sel.size) return toast('Selecione anúncios antes de criar categoria.', 'warning');
    let nome = '';
    const ok = await dModal('Criar nova categoria', `A categoria vai conter os ${D.sel.size} anúncio(s) selecionado(s).<input id="dcn" maxlength="60" placeholder="Nome da categoria">`, [{ t: 'Cancelar', v: false }, { t: 'Criar', v: true, cls: 'p' }],
      { onOpen: el => { const i = el.querySelector('#dcn'); i.onkeydown = e => { if (e.key === 'Enter') el.querySelector('.p').click(); }; el.querySelector('.p').addEventListener('click', () => { nome = i.value.trim(); }, true); } });
    if (ok !== true) return;
    if (!nome) return toast('Informe um nome.', 'warning');
    try { const r = await dapi('POST', D.alvo[0].id, '/categories', { name: nome, mlbs: [...D.sel] }); D.cats.push(r.data); toast(`Categoria "${nome}" criada com ${r.data.mlbs.length} anúncio(s).`, 'success'); limpaSel(); desenhaTudo(); }
    catch (e) { toast('Erro ao criar: ' + e.message, 'error'); }
  }
  async function addCategoria() {
    if (!D.sel.size) return toast('Selecione pelo menos um anúncio.', 'warning');
    const corpo = D.cats.length ? D.cats.map(c => { const j = (c.mlbs || []).filter(m => D.sel.has(m)).length; return `<div class="li" data-cat="${esc(c.id)}"><b>${esc(c.name)}</b><small>${(c.mlbs || []).length} anúncio(s)${j ? ` · ${j} já nesta categoria` : ''}</small></div>`; }).join('') : '<p style="color:var(--mut)">Nenhuma categoria criada ainda.</p>';
    const esc2 = await dModal(`Adicionar ${D.sel.size} anúncio(s) a uma categoria`, corpo, [{ t: 'Cancelar', v: false }, { t: '+ Criar nova categoria', v: 'nova' }],
      { onOpen: el => el.querySelectorAll('.li').forEach(li => li.onclick = () => el.close(li.dataset.cat)) });
    if (esc2 === 'nova') return criarCategoria();
    if (!esc2) return;
    try { const n = D.sel.size, r = await dapi('PATCH', D.alvo[0].id, '/categories/' + esc2, { addMlbs: [...D.sel] }); const i = D.cats.findIndex(c => c.id === esc2); if (i >= 0) D.cats[i] = r.data; toast(`${n} anúncio(s) adicionados a "${r.data.name}".`, 'success'); limpaSel(); desenhaTudo(); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }
  async function removerDaCategoria() {
    if (!D.catAtiva || !D.sel.size) return;
    try { const r = await dapi('PATCH', D.alvo[0].id, '/categories/' + D.catAtiva, { removeMlbs: [...D.sel] }); const i = D.cats.findIndex(c => c.id === D.catAtiva); if (i >= 0) D.cats[i] = r.data; toast('Removido da categoria.', 'info'); limpaSel(); desenhaTudo(); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }
  async function excluirCategoria(id) {
    const c = D.cats.find(x => x.id === id); if (!c) return;
    if (!await confirmar(`Excluir categoria "${c.name}"? Os anúncios não serão afetados.`, { titulo: 'Excluir categoria', ok: 'Excluir', perigo: true })) return;
    try { await dapi('DELETE', D.alvo[0].id, '/categories/' + id); D.cats = D.cats.filter(x => x.id !== id); if (D.catAtiva === id) D.catAtiva = null; toast('Categoria removida.', 'info'); desenhaTudo(); }
    catch (e) { toast('Erro ao remover: ' + e.message, 'error'); }
  }

  // ───────── campanhas do ML ─────────
  const SO_ACEITA = ['MARKETPLACE_CAMPAIGN', 'VOLUME', 'PRE_NEGOTIATED', 'SMART', 'PRICE_MATCHING', 'UNHEALTHY_STOCK', 'SELLER_COUPON_CAMPAIGN'];
  async function abrirCampanhas() {
    if (geral()) return toast('Escolha uma loja no filtro acima para ver as promoções do Mercado Livre.', 'warning');
    const c = D.alvo[0]; let lista = [];
    const p = dModal('Promoções do Mercado Livre', '<div id="dcl" style="color:var(--mut)">Buscando promoções…</div>', [{ t: 'Fechar', v: null }], { wide: true });
    try {
      lista = (await dapi('GET', c.id, '/promotions')).data || [];
      const el = $('#dcl'); if (!el) return;
      el.style.color = ''; el.innerHTML = lista.length ? lista.map((x, i) => `<div class="li" data-i="${i}"><div><b>${esc(x.name)}</b><small><span class="sg b">${esc(x.type)}</span> ${esc(x.status || '')}${x.startDate || x.finishDate ? ' · ' + (x.startDate ? new Date(x.startDate).toLocaleDateString('pt-BR') : '?') + ' a ' + (x.finishDate ? new Date(x.finishDate).toLocaleDateString('pt-BR') : '?') : ''}</small></div><button class="btn3 p mini">Abrir</button></div>`).join('') : 'Nenhuma promoção disponível para esta conta.';
      el.querySelectorAll('.li').forEach(li => li.onclick = () => { document.querySelector('.dm')?.close(+li.dataset.i); });
    } catch (e) { const el = $('#dcl'); if (el) el.innerHTML = `<span class="err">Erro: ${esc(e.message)}</span>`; }
    const i = await p; if (i == null || !lista[i]) return;
    abrirCampanha(c, lista[i]);
  }
  async function abrirCampanha(c, promo) {
    D.campSel.clear(); $('#dmain').style.display = 'none'; $('#dcamp').style.display = '';
    $('#dch').textContent = promo.name; $('#dchs').textContent = 'Carregando anúncios elegíveis…'; $('#dctb').innerHTML = '<tr><td colspan="7" class="empty">Carregando…</td></tr>';
    try {
      const items = (await dapi('GET', c.id, `/promotions/${encodeURIComponent(promo.id)}/items?type=${encodeURIComponent(promo.type)}`)).data || [];
      const so = SO_ACEITA.includes(promo.type);
      D.camp = { conta: c.id, id: promo.id, type: promo.type, name: promo.name, items, soAceita: so, mg: {} };
      $('#dchs').textContent = `${items.length} anúncio(s) elegível(eis) · Tipo: ${promo.type}${so ? ' · Preço definido pelo ML (você só aceita)' : ''}`;
      const pares = items.map(it => ({ mlb: it.id, preco: it.suggestedPrice ?? it.price, skus: rowDe(it.id)?.skus })).filter(p => p.preco > 0);
      if (pares.length) { try { D.camp.mg = (await dapi('POST', c.id, '/margem', { pares })).data; } catch { /* sem margem */ } }
      desenhaCampanha();
    } catch (e) { $('#dctb').innerHTML = `<tr><td colspan="7" class="err" style="text-align:center">Erro: ${esc(e.message)}</td></tr>`; }
  }
  function sairCampanha() { D.camp = null; D.campSel.clear(); $('#dcamp').style.display = 'none'; $('#dmain').style.display = ''; }
  function desenhaCampanha() {
    const C = D.camp; if (!C) return;
    const q = $('#dcq').value.trim().toLowerCase(), sq = q ? parseBusca(q) : null;
    const items = q ? C.items.filter(it => casa(rowDe(it.id) || { id: it.id, title: '', skus: [] }, q, sq)) : C.items;
    $('#dctb').innerHTML = items.length ? items.map(it => {
      const r = rowDe(it.id), titulo = r?.title || '(sem título — anúncio fora da lista ativa)', atual = it.originalPrice ?? it.price, promo = it.suggestedPrice ?? it.price;
      const pct = atual && promo && promo < atual ? Math.round((1 - promo / atual) * 100) : null, m = C.mg[it.id];
      const mgc = m && m.margem != null ? `<span title="${esc(`Preço ${brl(m.preco)} − comissão ${brl(m.comissao)} − frete ${brl(m.frete)} − imposto ${brl(m.imposto)} − custo ${brl(m.custo)}`)}">${mgPill(m.margemPct)}${m.estimado ? '<small style="color:var(--mut)"> ~</small>' : ''}</span>` : '<span class="mg x">s/ custo</span>';
      return `<tr id="c-${esc(it.id)}" data-m="${esc(it.id)}"><td><input type="checkbox" class="cc" ${D.campSel.has(it.id) ? 'checked' : ''}></td>
        <td><div class="pt">${r?.thumbnail ? `<img loading="lazy" src="${esc(r.thumbnail)}" alt="">` : '<span class="ph"></span>'}<div class="tt">${r?.permalink ? `<a href="${esc(r.permalink)}" target="_blank" rel="noopener">${esc(trunc(titulo))}</a>` : `<span class="ti">${esc(trunc(titulo))}</span>`}<div class="bd"><span class="cp2" data-a="copy" data-v="${esc(it.id)}">${esc(it.id)}</span></div></div></div></td>
        <td class="old n">${atual != null ? brl(atual) : '—'}</td><td class="n ok"><b>${promo != null ? brl(promo) : '—'}</b></td><td class="n">${pct != null ? `<span class="dc">-${pct}%</span>` : '—'}</td><td class="n">${mgc}</td>
        <td><button class="btn3 mini ok2" data-a="campaplicar">${C.soAceita ? 'Aceitar' : 'Aplicar'}</button></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="empty">Nenhum anúncio.</td></tr>';
  }
  async function aplicarCampanha(mlbs) {
    const C = D.camp; if (!C || !mlbs.length) return;
    const items = mlbs.map(m => { const it = C.items.find(x => x.id === m); return it ? { mlb: m, dealPrice: it.suggestedPrice } : null; }).filter(Boolean);
    if (!items.length) return; toast(`Aplicando ${items.length} anúncio(s)…`, 'info', 3000);
    try {
      const { data } = await dapi('POST', C.conta, `/promotions/${encodeURIComponent(C.id)}/apply`, { type: C.type, items });
      if (data.failed.length) toast(`Concluído: ${data.success.length} OK, ${data.failed.length} falha(s)`, 'warning', 6000); else toast(`Todos os ${data.success.length} aplicados!`, 'success', 5000);
      data.success.forEach(s => { const b = $(`#c-${CSS.escape(s.mlb)} button`); if (b) { b.disabled = true; b.textContent = '✓ Aplicado'; } });
      data.failed.forEach(f => { const b = $(`#c-${CSS.escape(f.mlb)} button`); if (b) { b.title = f.error; b.textContent = 'Falhou'; b.style.color = '#b91c1c'; } });
      if (data.failed[0]) toast('Falha: ' + data.failed[0].error, 'error', 7000);
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
  }

  // ───────── tela ─────────
  const esqueleto = () => `<div id="dsc">
    <div class="kgrid" id="dk"></div>
    <div id="dcamp" style="display:none">
      <div class="box"><div class="boxh"><div><h3 id="dch" style="margin:0"></h3><small id="dchs"></small></div><input id="dcq" type="text" placeholder="Buscar MLB, SKU ou título…" style="min-width:220px"></div>
        <div class="sbar"><button class="btn3 p" data-a="camptodos">Aplicar em todos</button><button class="btn3" data-a="campsel">Aplicar selecionados</button><button class="btn3" data-a="campsair" style="margin-left:auto">← Voltar aos descontos</button></div></div>
      <div class="box"><div class="tw"><table><thead><tr><th><input type="checkbox" id="dcall"></th><th>Anúncio</th><th class="n">Preço atual</th><th class="n">Preço sugerido</th><th class="n">Desconto</th><th class="n">Margem</th><th>Ação</th></tr></thead><tbody id="dctb"></tbody></table></div></div>
    </div>
    <div id="dmain">
      <div class="chips" id="dcats"></div>
      <div class="box"><div class="sbar"><input id="dsearch" type="text" placeholder="Buscar por título, MLB ou SKU…">
        <button class="btn3" data-a="atualizar" title="Buscar dados atualizados do ML">↻ Atualizar</button><button class="btn3 p" id="dapply" data-a="aplicarctx" disabled>Aplicar…</button><button class="btn3 p" id="dall" data-a="aplicartudo" disabled>Aplicar tudo</button><button class="btn3" data-a="campanhas">Promoções ML</button></div></div>
      <div class="chips" id="dtipos"><span class="chip" data-a="tipo" data-v="classico">Clássico</span><span class="chip" data-a="tipo" data-v="premium">Premium</span><span class="chip" data-a="tipo" data-v="full">Full</span></div>
      <div class="box" id="dbatch" style="display:none"><div class="boxh"><h3 id="dbt" style="margin:0">Processando descontos…</h3><span class="sg b" id="dbb">Em progresso</span></div>
        <div class="sbar"><div class="prog" id="dprog"><i></i></div><b id="dpct">0%</b></div>
        <div class="bst"><div><b id="bt">0</b><small>Total</small></div><div><b id="bp">0</b><small>Processados</small></div><div><b id="bs" class="ok">0</b><small>Sucesso</small></div><div><b id="bf" class="bad">0</b><small>Falhas</small></div><div><b id="bw">0</b><small>Pendentes</small></div></div>
        <div style="color:var(--mut);font-size:12px" id="dbcur">Item atual: —</div><div style="margin-top:10px"><button class="btn3 mini d" id="dbcancel" data-a="cancelarlote" style="display:none">Cancelar lote</button></div></div>
      <div class="box"><div class="tw"><table><thead id="dth"></thead><tbody id="dtb"></tbody></table></div><div class="ctr" id="dcount"></div></div>
    </div>
    <div class="dsel" id="dsel"><div class="in"><span class="cnt"><span id="dselc">0</span> selecionado(s)</span>
      <input id="dbp" placeholder="R$ 0,00"><button class="btn3 p mini" data-a="defpreco">Definir preço</button><input id="dbq" class="q" placeholder="%"><button class="btn3 p mini" data-a="defpct">Definir %</button>
      <button class="btn3 mini d" data-a="desativarvarios">Desativar desconto</button><button class="btn3 mini" id="dcrt" data-a="criarcat">Criar categoria</button><button class="btn3 mini" id="dadd" data-a="addcat">+ Adicionar à categoria</button><button class="btn3 mini" id="drm" data-a="rmcat">− Remover da categoria</button></div></div>
  </div>`;

  function copiar(el, txt) {
    const ok = () => { toast('Copiado: ' + txt, 'success', 1500); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 500); };
    (navigator.clipboard?.writeText(txt) || Promise.reject()).then(ok, () => { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch { toast('Não foi possível copiar', 'error'); } t.remove(); });
  }

  function ligaEventos(root) {
    root.addEventListener('click', e => {
      const th = e.target.closest('th.s');
      if (th) { const k = th.dataset.k; D.sort.d = D.sort.k === k ? -D.sort.d : -1; D.sort.k = k; filtra(); desenhaTabela(); return; }
      const el = e.target.closest('[data-a]'); if (!el) return;
      const a = el.dataset.a, v = el.dataset.v, mlb = el.closest('tr')?.dataset.m;
      switch (a) {
        case 'copy': return copiar(el, v);
        case 'aplicar': return aplicar(mlb);
        case 'desativar': return desativar(mlb);
        case 'atualizar': { const b = el; b.disabled = true; b.textContent = 'Atualizando…'; return carregar(true).then(() => toast('Dados atualizados do Mercado Livre.', 'success', 1800)).finally(() => { b.disabled = false; b.textContent = '↻ Atualizar'; }); }
        case 'aplicarctx': return aplicarContexto();
        case 'aplicartudo': return aplicarTudo();
        case 'campanhas': return abrirCampanhas();
        case 'cancelarlote': return cancelarLote();
        case 'tipo': { if (D.tipos.has(v)) D.tipos.delete(v); else { if (v === 'classico') D.tipos.delete('premium'); if (v === 'premium') D.tipos.delete('classico'); D.tipos.add(v); }
          root.querySelectorAll('#dtipos .chip').forEach(c => c.classList.toggle('on', D.tipos.has(c.dataset.v))); filtra(); return desenhaTabela(); }
        case 'cat': D.catAtiva = v || null; D.falhas = false; D.sel.clear(); return desenhaTudo();
        case 'catdel': e.stopPropagation(); return excluirCategoria(v);
        case 'falhas': D.falhas = !D.falhas; if (D.falhas) D.catAtiva = null; return desenhaTudo();
        case 'defpreco': return defPreco(); case 'defpct': return defPct(); case 'desativarvarios': return desativarVarios();
        case 'criarcat': return criarCategoria(); case 'addcat': return addCategoria(); case 'rmcat': return removerDaCategoria();
        case 'camptodos': return D.camp && confirmar(`Aplicar a promoção em TODOS os ${D.camp.items.length} anúncio(s) elegíveis?`, { titulo: 'Aplicar a todos', ok: 'Aplicar a todos' }).then(ok => ok && aplicarCampanha(D.camp.items.map(i => i.id)));
        case 'campsel': return D.campSel.size ? confirmar(`Aplicar a promoção em ${D.campSel.size} anúncio(s)?`, { titulo: 'Aplicar promoção', ok: 'Aplicar' }).then(ok => ok && aplicarCampanha([...D.campSel])) : toast('Nenhum selecionado.', 'warning');
        case 'campaplicar': { const b = el; b.disabled = true; b.textContent = '…'; return aplicarCampanha([mlb]).finally(() => { if (b.textContent === '…') { b.disabled = false; b.textContent = D.camp?.soAceita ? 'Aceitar' : 'Aplicar'; } }); }
        case 'campsair': return sairCampanha();
      }
    });
    root.addEventListener('change', e => {
      const t = e.target;
      if (t.classList.contains('rc')) { const m = t.closest('tr').dataset.m; t.checked ? D.sel.add(m) : D.sel.delete(m); t.closest('tr').classList.toggle('sel', t.checked); sincronizaTodos(); desenhaSel(); }
      else if (t.id === 'dpall') { D.filtered.forEach(r => t.checked ? D.sel.add(r.id) : D.sel.delete(r.id)); desenhaTabela(); desenhaSel(); }
      else if (t.classList.contains('cc')) { const m = t.closest('tr').dataset.m; t.checked ? D.campSel.add(m) : D.campSel.delete(m); }
      else if (t.id === 'dcall') { D.campSel.clear(); if (t.checked) D.camp?.items.forEach(i => D.campSel.add(i.id)); desenhaCampanha(); }
    });
    root.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'dsearch') { clearTimeout(D.tb); D.tb = setTimeout(() => { D.busca = t.value.trim().toLowerCase(); filtra(); desenhaTabela(); }, 200); }
      else if (t.id === 'dcq') desenhaCampanha();
      else if (t.classList.contains('pp-q')) pctDigitado(t);
    });
    root.addEventListener('focusout', e => { if (e.target.classList.contains('pp-p')) salvarPreco(e.target); else if (e.target.classList.contains('pp-q')) pctSalvar(e.target); });
    root.addEventListener('keydown', e => {
      const t = e.target; if (!t.classList?.contains('di')) return;
      if (e.key === 'Enter') { e.preventDefault(); t.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); const r = rowDe(t.dataset.m); if (r) { if (t.classList.contains('pp-p')) t.value = r.discountPrice != null ? fmt(r.discountPrice) : ''; else t.value = getPct(r); } t.classList.remove('dirty'); t.blur(); }
    });
  }

  VIEWS.descontos = async function () {
    D.contas = (await (await fetch('api/descontos/contas')).json()).data || [];
    const sel = $('#loja').value, f1 = D.contas.filter(c => c.loja === sel), doFiltro = f1.length ? f1 : D.contas;
    const comToken = doFiltro.filter(c => c.temToken);
    if (!D.contas.length || !comToken.length) {
      $('#view').innerHTML = `<div class="box"><div class="empty"><b>Descontos ainda não está ligado</b>${!D.contas.length ? 'Nenhuma conta do Mercado Livre conectada para escrita.' : 'Faltam os tokens de escrita do Mercado Livre.'}<br>Veja a seção Descontos do README.</div></div>`;
      return;
    }
    Object.assign(D, { gen: (D.gen || 0) + 1, alvo: comToken, rows: [], filtered: [], cats: [], catAtiva: null, falhas: false, tipos: new Set(), sel: new Set(), busca: '', sort: { k: null, d: -1 }, mg: {}, camp: null, campSel: new Set() });
    D.batch = { ativo: false, conta: null, cancelado: false, dias: null, lastLen: 0, errs: 0 };
    $('#view').innerHTML = esqueleto();
    ligaEventos($('#dsc'));
    desenhaCats(); atualizaKpis(); $('#dth').innerHTML = cab();
    if (doFiltro.length !== comToken.length) toast(`Sem token de escrita: ${doFiltro.filter(c => !c.temToken).map(c => c.nickname).join(', ')}`, 'warning', 6000);
    await carregar(false);
    retomarLote();
  };
})();
