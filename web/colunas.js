// Colunas arrastáveis em todas as tabelas: arraste o título de uma coluna para outra posição; a ordem fica salva neste navegador
// (por tela e tabela) e volta sempre que a tabela é redesenhada. Botão direito no título: voltar à ordem original.
// Funciona sozinho: observa a página e prepara cada <table> que aparece (cabeçalho de uma linha só, sem colspan).
// Linhas com outra quantidade de células (seções do DRE, "nenhum resultado") ficam como estão.
// Botão direito no título: esconder a coluna, mostrar as escondidas ou voltar à ordem original (também salvos neste navegador).
(() => {
  const PREFIXO = 'colunas:', MARCAS = /[▲▼⇅↑↓ⓘ⚠]|🔒/g;
  const ler = k => { try { return JSON.parse(localStorage.getItem(PREFIXO + k)); } catch { return null; } };
  const gravar = (k, v) => { try { v ? localStorage.setItem(PREFIXO + k, JSON.stringify(v)) : localStorage.removeItem(PREFIXO + k); } catch { /* navegador sem armazenamento */ } };
  const css = document.createElement('style');
  css.textContent = `th.col-arr{cursor:grab}th.col-arr:active{cursor:grabbing}th.col-saindo{opacity:.4}
th.col-antes{box-shadow:inset 3px 0 0 var(--ac,#2563eb)}th.col-depois{box-shadow:inset -3px 0 0 var(--ac,#2563eb)}
#colmenu{position:fixed;z-index:95;background:var(--panel,#fff);border:1px solid var(--bd,#ddd);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:4px;min-width:220px;font-size:13px}
#colmenu button{display:block;width:100%;text-align:left;background:none;border:0;padding:7px 10px;border-radius:7px;color:var(--tx1,#111);cursor:pointer}#colmenu button:hover{background:var(--hov,#f1f5f9)}`;
  document.head.appendChild(css);

  const cabecalho = t => (t.tHead?.rows.length === 1 ? [...t.tHead.rows[0].cells] : null);
  // chave de cada coluna: data-k (tabelas com ordenação) ou o texto do título sem as setas
  const chaves = ths => { const vistos = {}; return ths.map(th => { const k = th.dataset.k || th.textContent.replace(MARCAS, '').replace(/\s+/g, ' ').trim().toLowerCase(); vistos[k] = (vistos[k] || 0) + 1; return vistos[k] > 1 ? `${k}#${vistos[k]}` : k; }); };
  const escopo = t => (t.closest('#view') ? (location.hash.slice(1) || 'lucro').split(':')[0] : t.closest('[id]')?.id || 'pagina');
  const identidade = ord => ord.every((o, i) => o === i);
  // ordem salva (lista de chaves) → índices originais; colunas novas entram logo depois da que vinha antes delas
  function ordemDe(salva, k0) {
    if (!Array.isArray(salva)) return null;
    const res = salva.filter(k => k0.includes(k));
    if (res.length < Math.min(2, k0.length)) return null;
    k0.forEach((k, i) => { if (!res.includes(k)) { const ant = k0.slice(0, i).reverse().find(x => res.includes(x)); res.splice(ant ? res.indexOf(ant) + 1 : 0, 0, k); } });
    return res.map(k => k0.indexOf(k));
  }
  // r._o = ordem em que as células da linha estão agora (sem _o: a original, como a tela desenhou)
  function aplica(t) {
    for (const r of t.rows) {
      if (r._o === t._colOrd || (!r._o && t._colId) || r.cells.length !== t._colK.length || [...r.cells].some(c => c.colSpan > 1)) continue;
      const por = []; [...r.cells].forEach((c, i) => { por[r._o ? r._o[i] : i] = c; });
      r.append(...t._colOrd.map(o => por[o])); r._o = t._colOrd;
    }
  }
  function prepara(t) {
    if (t._colNao) return;
    if (!t._colK) {
      const ths = cabecalho(t);
      if (!ths || ths.length < 2 || ths.some(th => th.colSpan > 1) || t.dataset.colunasFixas != null) { t._colNao = true; return; }
      t._colK = chaves(ths); t._colChave = escopo(t) + ':' + (t.id || t._colK.join('|'));
      t._colFixa = t.id === 'tdre' ? 1 : 0; // DRE: a coluna dos nomes das linhas fica sempre na frente
      const ord = ordemDe(ler(t._colChave), t._colK);
      t._colOrd = ord && (!t._colFixa || ord[0] === 0) ? ord : t._colK.map((_, i) => i); t._colId = identidade(t._colOrd);
      ths.forEach((th, i) => { if (i < t._colFixa) return; th.draggable = true; th.classList.add('col-arr');
        if (!th.title) th.title = 'Arraste para mudar a coluna de lugar · botão direito: esconder ou voltar à ordem original'; });
    }
    if (!t._colOc) t._colOc = lerOc(t);
    aplica(t); // linhas novas (paginação, filtro) entram na ordem escolhida
    esconde(t);
  }
  // colunas escondidas: pela chave da coluna, em todas as linhas com o mesmo número de células
  const OC = 'colunas-ocultas:', lerOc = t => { try { return new Set(JSON.parse(localStorage.getItem(OC + t._colChave)) || []); } catch { return new Set(); } };
  function esconde(t) {
    if (!t._colOc?.size && !t._colTinhaOc) return; t._colTinhaOc = !!t._colOc.size;
    for (const r of t.rows) { if (r.cells.length !== t._colK.length || [...r.cells].some(c => c.colSpan > 1)) continue;
      [...r.cells].forEach((c, i) => { const o = r._o ? r._o[i] : i, fora = t._colOc.has(t._colK[o]); if ((c.style.display === 'none') !== fora) c.style.display = fora ? 'none' : ''; }); }
  }
  function gravaOc(t) { try { t._colOc.size ? localStorage.setItem(OC + t._colChave, JSON.stringify([...t._colOc])) : localStorage.removeItem(OC + t._colChave); } catch { /* sem armazenamento */ } esconde(t); }
  function muda(t, ord) {
    t._colOrd = ord; t._colId = identidade(ord); aplica(t);
    gravar(t._colChave, t._colId ? null : ord.map(o => t._colK[o]));
  }

  // prepara as tabelas que aparecem ou mudam (uma vez por quadro, mesmo com muitas mudanças seguidas)
  let pendente = false;
  const varre = () => { pendente = false; document.querySelectorAll('table').forEach(prepara); };
  new MutationObserver(() => { if (!pendente) { pendente = true; requestAnimationFrame(varre); } }).observe(document.body, { childList: true, subtree: true });
  varre();

  // arrastar: só entre colunas da mesma tabela
  let arr = null;
  const limpa = () => document.querySelectorAll('th.col-antes,th.col-depois,th.col-saindo').forEach(th => th.classList.remove('col-antes', 'col-depois', 'col-saindo'));
  const alvo = e => { const th = e.target.closest?.('th'), t = th?.closest('table'); return arr && th && t === arr.t && th.parentElement === t.tHead.rows[0] && th.cellIndex >= t._colFixa ? th : null; };
  const depois = (e, th) => { const b = th.getBoundingClientRect(); return e.clientX > b.left + b.width / 2; };
  document.addEventListener('dragstart', e => {
    const th = e.target.closest?.('th.col-arr'); if (!th) return;
    arr = { t: th.closest('table'), de: th.cellIndex }; th.classList.add('col-saindo');
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', th.textContent.trim());
  });
  document.addEventListener('dragover', e => {
    const th = alvo(e); if (!th) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('th.col-antes,th.col-depois').forEach(x => x.classList.remove('col-antes', 'col-depois'));
    th.classList.add(depois(e, th) ? 'col-depois' : 'col-antes');
  });
  document.addEventListener('drop', e => {
    const th = alvo(e); if (!th) return; e.preventDefault();
    const t = arr.t, ord = t._colOrd.slice(), [mov] = ord.splice(arr.de, 1);
    let para = th.cellIndex + (depois(e, th) ? 1 : 0); if (para > arr.de) para--;
    ord.splice(Math.max(para, t._colFixa), 0, mov); limpa(); arr = null;
    if (ord.some((o, i) => o !== t._colOrd[i])) muda(t, ord);
  });
  document.addEventListener('dragend', () => { limpa(); arr = null; });
  // botão direito no título: menu com esconder, mostrar e voltar à ordem original
  const fechaMenu = () => document.getElementById('colmenu')?.remove();
  document.addEventListener('contextmenu', e => {
    const th = e.target.closest?.('th.col-arr'), t = th?.closest('table'); fechaMenu(); if (!t) return;
    e.preventDefault();
    const k = t._colK[t._colOrd[th.cellIndex]], visiveis = t._colK.length - t._colOc.size, nome = th.textContent.replace(MARCAS, '').trim() || 'esta coluna';
    const m = document.createElement('div'); m.id = 'colmenu';
    m.innerHTML = `${visiveis > 1 ? `<button data-c="esc">Esconder “${nome.replace(/[<>&"]/g, '')}”</button>` : ''}${t._colOc.size ? `<button data-c="mos">Mostrar as colunas escondidas (${t._colOc.size})</button>` : ''}${t._colId ? '' : '<button data-c="ord">Voltar à ordem original</button>'}`;
    if (!m.children.length) return;
    m.style.left = Math.min(e.clientX, innerWidth - 240) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - 120) + 'px'; document.body.appendChild(m);
    m.onclick = ev => { const c = ev.target.closest('button')?.dataset.c; fechaMenu();
      if (c === 'esc') { t._colOc.add(k); gravaOc(t); } else if (c === 'mos') { t._colOc.clear(); gravaOc(t); } else if (c === 'ord') muda(t, t._colK.map((_, i) => i)); };
  });
  document.addEventListener('click', e => { if (!e.target.closest?.('#colmenu')) fechaMenu(); });
  addEventListener('scroll', fechaMenu, true);
})();
