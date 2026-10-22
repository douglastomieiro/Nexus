// Sino de atendimento no topo da tela: perguntas, mensagens e reclamações do Mercado Livre e devoluções e chat da Shopee esperando resposta.
// Consulta o servidor a cada minuto e avisa só do que é novo: cartão no canto da tela, som, número no título da aba
// e notificação do Windows (quando o navegador permite: endereço https ou localhost). Os já vistos ficam guardados neste navegador.
// Venda nova também gera aviso (cartão verde e som de caixa), sem entrar no contador do sino; dá para desligar no rodapé do sino.
(() => {
  const ler = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const grava = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let vistos = null; try { const v = JSON.parse(ler('notifVistos', 'null')); if (Array.isArray(v)) vistos = new Set(v); } catch {}
  const salvaVistos = () => grava('notifVistos', JSON.stringify([...vistos].slice(-800)));
  const avisados = new Set(); // já avisados nesta aba (cartão e som), mesmo sem abrir o sino
  let D = { itens: [], avisos: [] }, painel = null, timer = null;
  const somLigado = () => ler('notifSom', '1') === '1', vendasLigado = () => ler('notifVendas', '1') === '1';
  let vVistas = null; try { const v = JSON.parse(ler('notifVendasVistas', 'null')); if (Array.isArray(v)) vVistas = new Set(v); } catch {}
  const brl = n => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const SVG = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
  const ICO = {
    sino: SVG('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    pergunta: SVG('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
    mensagem: SVG('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>'),
    chat: SVG('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>'),
    reclamacao: SVG('<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>'),
    devolucao: SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    venda: SVG('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'),
  };
  const NOME = { pergunta: 'Pergunta', mensagem: 'Mensagem', reclamacao: 'Reclamação', devolucao: 'Devolução', chat: 'Chat', venda: 'Venda' };
  const COR = { pergunta: '#2563eb', mensagem: '#0d9488', reclamacao: '#dc2626', devolucao: '#ea580c', chat: '#ee4d2d', venda: '#16a34a' };
  const quando = d => { const m = d ? Math.round((Date.now() - new Date(d)) / 60e3) : null; return m == null || isNaN(m) ? '' : m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dia(s)`; };
  const canal = i => `${i.canal === 'shopee' ? 'Shopee' : 'Mercado Livre'} · ${esc((i.nomeLoja || i.loja).replace(' (Shopee)', ''))}`;

  document.head.insertAdjacentHTML('beforeend', `<style>
#nsino{position:relative;width:34px;height:34px;border-radius:10px;border:1px solid var(--bd);background:var(--panel);color:var(--tx3);display:grid;place-items:center;padding:0;flex-shrink:0}
#nsino:hover{filter:none;color:var(--ac);border-color:var(--ac)}
#nsino svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#nsino b{position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--mut2);color:#fff;font-size:10.5px;line-height:18px;text-align:center}
#nsino.novo{color:#dc2626;border-color:#fca5a5}#nsino.novo b{background:#dc2626}
#nsino.balanca svg{animation:nbal .9s ease-in-out 3;transform-origin:50% 10%}
@keyframes nbal{0%,100%{transform:rotate(0)}20%{transform:rotate(16deg)}40%{transform:rotate(-14deg)}60%{transform:rotate(8deg)}80%{transform:rotate(-6deg)}}
#npainel{position:fixed;z-index:40;width:min(430px,calc(100vw - 24px));max-height:min(72vh,640px);display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--bd);border-radius:12px;box-shadow:0 14px 36px rgba(15,23,42,.24);font-size:12.5px}
#npainel header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--bd)}
#npainel header b{font-size:13.5px}#npainel header a{font-size:12px}
#npainel .nl{overflow:auto;flex:1}
#npainel .nv{padding:22px 14px;text-align:center;color:var(--mut)}
#npainel .na{padding:8px 14px;background:var(--soft);color:var(--warn);border-bottom:1px solid var(--line);font-size:11.5px}
.ni{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);text-decoration:none;color:inherit}
a.ni:hover{background:var(--row)}
.ni.novo{background:color-mix(in srgb,var(--ac) 8%,var(--panel))}
.ni>i{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;color:var(--c);background:color-mix(in srgb,var(--c) 14%,var(--panel))}
.ni>i svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ni>div{min-width:0;flex:1}.ni small{display:flex;justify-content:space-between;gap:8px;color:var(--mut);font-size:11px}
.ni b{display:block;font-size:12.5px;color:var(--tx1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.ni p{margin:2px 0 0;color:var(--tx3);font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#npainel footer{padding:9px 14px;border-top:1px solid var(--bd);display:flex;gap:6px 14px;flex-wrap:wrap;align-items:center;font-size:11.5px;color:var(--mut)}
#npainel footer button{background:none;color:var(--ac);padding:0;font:600 11.5px Inter,system-ui,sans-serif}#npainel footer button:hover{filter:none;text-decoration:underline}
#ntoast{position:fixed;right:16px;bottom:16px;z-index:60;display:flex;flex-direction:column;gap:8px;width:min(380px,calc(100vw - 32px))}
#ntoast .ni{background:var(--panel);border:1px solid var(--bd);border-left:4px solid var(--c);border-radius:10px;box-shadow:0 10px 28px rgba(15,23,42,.22);animation:nent .2s ease-out;cursor:pointer}
@keyframes nent{from{transform:translateY(12px);opacity:0}}
</style>`);

  // som: o navegador só libera áudio depois do primeiro clique na página
  let ac = null;
  addEventListener('pointerdown', () => { try { ac ||= new AudioContext(); ac.resume(); } catch {} }, { passive: true });
  const toca = (notas = [[880, 0], [1320, 0.13]]) => {
    if (!somLigado() || !ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    for (const [f, d] of notas) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4);
      o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + 0.45);
    }
  };

  const linha = (i, novo, tag = 'a') => `<${tag} class="ni${novo ? ' novo' : ''}" style="--c:${COR[i.tipo] || '#64748b'}"${tag === 'a' ? ` href="${esc(i.link)}"${/^https?:/.test(i.link) ? ' target="_blank" rel="noopener"' : ''}` : ''} data-id="${esc(i.id)}">
    <i>${ICO[i.tipo] || ICO.sino}</i><div><small><span>${NOME[i.tipo] || ''} · ${canal(i)}</span><span>${quando(i.data)}</span></small><b>${esc(i.titulo)}</b>${i.texto ? `<p>${esc(i.texto)}</p>` : ''}</div></${tag}>`;

  const winTxt = () => !('Notification' in window) ? 'Windows: navegador sem suporte'
    : !window.isSecureContext ? '<span title="O navegador só mostra notificação do Windows em endereço https ou localhost. Neste endereço o aviso aparece na própria tela, com som.">Windows: indisponível neste endereço ⓘ</span>'
    : Notification.permission === 'granted' ? 'Windows: ativado' : Notification.permission === 'denied' ? 'Windows: bloqueado no navegador' : '<button data-a="win">Ativar no Windows</button>';

  function desenhaPainel(novos) {
    if (!painel) return;
    painel.innerHTML = `<header><b>Atendimento · ${D.itens.length} esperando resposta</b><a class="lk" href="#atendimento">abrir Atendimento</a></header>
      ${D.avisos.map(a => `<div class="na">${esc(a)}</div>`).join('')}
      <div class="nl">${D.itens.length ? D.itens.map(i => linha(i, novos.has(i.id))).join('') : '<div class="nv">Nada esperando resposta agora.</div>'}</div>
      <footer><button data-a="som">Som: ${somLigado() ? 'ligado' : 'desligado'}</button><button data-a="vendas">Aviso de venda: ${vendasLigado() ? 'ligado' : 'desligado'}</button>${winTxt()}<span style="margin-left:auto">atualiza a cada 30 s</span></footer>`;
  }
  function abre() {
    const b = document.getElementById('nsino'); if (!b) return;
    if (painel) return fecha();
    vistos ||= new Set(); document.getElementById('ntoast')?.replaceChildren(); // os cartões de aviso já estão na lista
    const novos = new Set(D.itens.filter(i => !vistos?.has(i.id)).map(i => i.id));
    painel = document.createElement('div'); painel.id = 'npainel'; document.body.appendChild(painel);
    const r = b.getBoundingClientRect(); painel.style.top = `${r.bottom + 8}px`; painel.style.right = `${Math.max(12, innerWidth - r.right)}px`;
    desenhaPainel(novos);
    painel.onclick = async e => {
      const a = e.target.closest('[data-a]'); if (a?.dataset.a === 'som') { grava('notifSom', somLigado() ? '0' : '1'); desenhaPainel(novos); }
      if (a?.dataset.a === 'vendas') { grava('notifVendas', vendasLigado() ? '0' : '1'); desenhaPainel(novos); }
      if (a?.dataset.a === 'win') { try { await Notification.requestPermission(); } catch {} desenhaPainel(novos); }
      if (e.target.closest('a[href^="#"]')) fecha(); // item ou atalho que abre uma tela do sistema
    };
    // abrir o sino = ver tudo o que está na lista
    D.itens.forEach(i => vistos.add(i.id)); salvaVistos(); marca();
  }
  function fecha() { painel?.remove(); painel = null; }
  addEventListener('pointerdown', e => { if (painel && !painel.contains(e.target) && !e.target.closest('#nsino')) fecha(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') fecha(); });

  function marca() {
    const b = document.getElementById('nsino'); if (!b) return;
    const novos = D.itens.filter(i => !vistos.has(i.id)).length;
    b.classList.toggle('novo', novos > 0);
    b.querySelector('b')?.remove(); if (D.itens.length) b.insertAdjacentHTML('beforeend', `<b>${D.itens.length > 99 ? '99+' : D.itens.length}</b>`);
    b.title = D.itens.length ? `${D.itens.length} esperando resposta${novos ? ` · ${novos} novo(s)` : ''}` : 'Atendimento: nada esperando resposta';
    document.title = (novos ? `(${novos}) ` : '') + document.title.replace(/^\(\d+\) /, '');
  }

  function avisa(lista) {
    let box = document.getElementById('ntoast'); if (!box) { box = document.createElement('div'); box.id = 'ntoast'; document.body.appendChild(box); }
    for (const i of lista.slice(0, 3)) {
      box.insertAdjacentHTML('beforeend', linha(i, false, 'div'));
      const el = box.lastElementChild; el.onclick = () => { el.remove(); abre(); };
      setTimeout(() => el.remove(), 12000);
    }
    if (lista.length > 3) { box.insertAdjacentHTML('beforeend', `<div class="ni" style="--c:var(--ac)"><div><b>+ ${lista.length - 3} outro(s)</b><p>Clique no sino para ver todos.</p></div></div>`); const el = box.lastElementChild; el.onclick = () => { el.remove(); abre(); }; setTimeout(() => el.remove(), 12000); }
    toca();
    const sino = document.getElementById('nsino'); sino?.classList.remove('balanca'); void sino?.offsetWidth; sino?.classList.add('balanca');
    if ('Notification' in window && window.isSecureContext && Notification.permission === 'granted') {
      try {
        const i = lista[0], n = new Notification(lista.length > 1 ? `${lista.length} novos no atendimento` : `${NOME[i.tipo]} · ${(i.nomeLoja || '').replace(' (Shopee)', '')}`,
          { body: lista.length > 1 ? lista.slice(0, 4).map(x => `${NOME[x.tipo]}: ${x.titulo}`).join('\n') : `${i.titulo}${i.texto ? '\n' + i.texto : ''}`, tag: 'atendimento', icon: 'logo.svg' });
        n.onclick = () => { focus(); n.close(); abre(); };
      } catch {}
    }
  }

  // venda nova: cartão verde (clique abre a ficha do pedido), som de caixa e notificação do Windows
  function avisaVenda(lista) {
    let box = document.getElementById('ntoast'); if (!box) { box = document.createElement('div'); box.id = 'ntoast'; document.body.appendChild(box); }
    for (const v of lista.slice(0, 3)) {
      box.insertAdjacentHTML('beforeend', linha({ tipo: 'venda', canal: v.canal, loja: v.loja, nomeLoja: v.nomeLoja, data: v.data, titulo: `Nova venda · ${brl(v.valor)}`, texto: `${v.qtd}× ${v.titulo}${v.outros ? ` + ${v.outros} item(ns)` : ''}` }, false, 'div'));
      const el = box.lastElementChild; el.onclick = () => { el.remove(); window.abreFicha ? window.abreFicha(v.loja, v.pedido) : (location.hash = 'aovivo'); };
      setTimeout(() => el.remove(), 15000);
    }
    if (lista.length > 3) { box.insertAdjacentHTML('beforeend', `<div class="ni" style="--c:#16a34a"><div><b>+ ${lista.length - 3} venda(s)</b><p>Veja todas em Análise de Pedidos › Ao vivo.</p></div></div>`); const el = box.lastElementChild; el.onclick = () => { el.remove(); location.hash = 'aovivo'; }; setTimeout(() => el.remove(), 15000); }
    toca([[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]]);
    if ('Notification' in window && window.isSecureContext && Notification.permission === 'granted') {
      try {
        const v = lista[0], tot = lista.reduce((t, x) => t + (x.valor || 0), 0);
        const n = new Notification(lista.length > 1 ? `${lista.length} vendas novas · ${brl(tot)}` : `Nova venda · ${brl(v.valor)}`, { body: lista.slice(0, 4).map(x => `${x.qtd}× ${x.titulo} (${(x.nomeLoja || '').replace(' (Shopee)', ' · Shopee')})`).join('\n'), tag: 'venda', icon: 'logo.svg' });
        n.onclick = () => { focus(); n.close(); location.hash = 'aovivo'; };
      } catch {}
    }
  }

  async function busca() {
    clearTimeout(timer); timer = setTimeout(busca, 30e3);
    const r = await fetch('api/notificacoes', { cache: 'no-store' }).catch(() => null);
    const b = document.getElementById('nsino');
    if (!r || !r.ok) { if (r?.status === 404 && b) { b.style.display = 'none'; clearTimeout(timer); timer = setTimeout(busca, 5 * 60e3); } return; } // servidor antigo: some até ser reiniciado
    D = await r.json(); if (b) b.style.display = '';
    if (!vistos) { vistos = new Set(D.itens.map(i => i.id)); salvaVistos(); } // primeira vez neste navegador: o que já existe não vira aviso
    const novos = D.itens.filter(i => !vistos.has(i.id) && !avisados.has(i.id));
    novos.forEach(i => avisados.add(i.id));
    marca();
    // cartão e som só dos tipos escolhidos em Personalizar (todos continuam no sino)
    const avisar = novos.filter(i => ler('notifTipo:' + i.tipo, 'true') !== 'false');
    if (avisar.length) avisa(avisar);
    // vendas: a primeira consulta neste navegador só registra as de hoje, sem aviso
    const vs = D.vendas || [];
    if (!vVistas) vVistas = new Set(vs.map(v => v.id));
    const novasV = vs.filter(v => !vVistas.has(v.id)); novasV.forEach(v => vVistas.add(v.id)); grava('notifVendasVistas', JSON.stringify([...vVistas].slice(-400)));
    if (novasV.length && vendasLigado()) avisaVenda(novasV);
    if (painel) desenhaPainel(new Set());
  }

  addEventListener('DOMContentLoaded', () => {
    const ph = document.querySelector('.ph'); if (!ph) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'nsino'; b.innerHTML = ICO.sino; b.onclick = abre;
    ph.insertBefore(b, document.getElementById('coleta'));
    busca();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') busca(); });
})();
