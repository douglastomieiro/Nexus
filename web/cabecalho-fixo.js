// Cabeçalho que acompanha a rolagem, em todas as tabelas: quando os títulos de uma tabela sobem para fora da tela e a tabela
// ainda está à vista, uma cópia do cabeçalho fica presa no topo, com as mesmas larguras, e acompanha a rolagem lateral da tabela.
// (O position:sticky do próprio <th> não serve aqui: as tabelas ficam dentro de caixas com rolagem própria.)
// Clicar num título da cópia é o mesmo que clicar no original (ordenar). Funciona sozinho: observa a página.
(() => {
  const box = document.createElement('div');
  box.id = 'cabfixo';
  box.style.cssText = 'position:fixed;top:0;left:0;z-index:15;overflow:hidden;display:none;background:var(--panel);box-shadow:0 3px 8px rgba(15,23,42,.12)';
  document.body.appendChild(box);
  const css = document.createElement('style');
  css.textContent = '@media print{#cabfixo{display:none!important}}';
  document.head.appendChild(css);
  // estilos do <th> original copiados para a cópia (a cópia fica fora da tabela, então os seletores do CSS não pegam nela)
  const ESTILO = ['backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'textAlign', 'lineHeight', 'whiteSpace', 'verticalAlign',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor', 'borderRightWidth', 'borderRightStyle', 'borderRightColor'];
  let atual = null, assinatura = '';
  const ths = t => [...t.tHead.querySelectorAll('th')];
  const assina = t => t.offsetWidth + '|' + ths(t).map(th => th.offsetWidth + ':' + th.offsetHeight + ':' + th.textContent).join('|');

  function monta(t) {
    const orig = ths(t), cab = t.tHead.cloneNode(true), tab = document.createElement('table');
    tab.dataset.colunasFixas = ''; // a cópia não entra no "arrastar colunas" (colunas.js)
    tab.style.cssText = `border-collapse:${getComputedStyle(t).borderCollapse};border-spacing:0;table-layout:fixed;width:${t.offsetWidth}px;margin:0`;
    [...cab.querySelectorAll('th')].forEach((c, i) => {
      const o = orig[i], cs = getComputedStyle(o), w = o.getBoundingClientRect().width;
      for (const k of ESTILO) c.style[k] = cs[k];
      Object.assign(c.style, { position: 'static', boxSizing: 'border-box', width: w + 'px', minWidth: w + 'px', maxWidth: w + 'px', height: o.getBoundingClientRect().height + 'px' });
      c.removeAttribute('draggable'); c.removeAttribute('id');
    });
    tab.appendChild(cab);
    box.replaceChildren(tab);
  }

  let pendente = false;
  function atualiza() {
    pendente = false;
    let alvo = null;
    for (const t of document.querySelectorAll('#view table')) {
      const th = t.tHead?.rows[0]?.cells[0];
      if (!th || t.offsetParent === null) continue;
      const h = th.getBoundingClientRect(), r = t.getBoundingClientRect();
      if (h.top < 0 && r.bottom > h.height * 2 + 30) { alvo = t; break; }
    }
    if (!alvo) { box.style.display = 'none'; atual = null; return; }
    const sig = assina(alvo);
    if (alvo !== atual || sig !== assinatura) { monta(alvo); atual = alvo; assinatura = sig; }
    const cr = (alvo.closest('.tw') || alvo.parentElement).getBoundingClientRect(), tr = alvo.getBoundingClientRect();
    const esq = Math.max(cr.left, 0), larg = Math.max(Math.min(cr.right, innerWidth) - esq, 0);
    Object.assign(box.style, { display: '', left: esq + 'px', width: larg + 'px' });
    box.firstChild.style.marginLeft = (tr.left - esq) + 'px';
  }
  const agenda = () => { if (!pendente) { pendente = true; requestAnimationFrame(atualiza); } };
  addEventListener('scroll', agenda, { capture: true, passive: true }); // capture: pega também a rolagem lateral das caixas
  addEventListener('resize', () => { assinatura = ''; agenda(); });
  new MutationObserver(agenda).observe(document.getElementById('view') || document.body, { childList: true, subtree: true });
  // clique num título da cópia = clique no título original (ordenar)
  box.addEventListener('click', e => {
    const c = e.target.closest('th'); if (!c || !atual) return;
    const linha = [...c.closest('thead').rows].indexOf(c.parentElement), col = [...c.parentElement.cells].indexOf(c);
    atual.tHead.rows[linha]?.cells[col]?.click();
  });
})();
