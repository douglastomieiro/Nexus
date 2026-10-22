// Tema claro / escuro. Carregado no <head>: aplica o tema salvo antes de desenhar a tela (sem piscar),
// coloca o seletor no menu lateral e troca as cores fixas dos gráficos (Chart.js) quando o tema é escuro.
(() => {
  let tema = 'claro';
  try { if (localStorage.getItem('tema') === 'escuro') tema = 'escuro'; } catch {}
  const aplica = t => { tema = t; document.documentElement.dataset.tema = t; };
  aplica(tema);

  // gráficos: cada cor do tema claro que não funciona no fundo escuro tem a sua equivalente
  const ESCURO = { '#64748b': '#94a3b8', '#475569': '#cbd5e1', '#eef1f6': '#24314a', '#fff': '#131c2e', '#ffffff': '#131c2e', '#e2e8f0': '#334155', '#c7d2fe': '#3b4a7a', '#fed7aa': '#7c4a2a' };
  const cor = c => (typeof c === 'string' && ESCURO[c.toLowerCase()]) || c;
  const troca = o => Array.isArray(o) ? o.map(troca)
    : o && Object.getPrototypeOf(o) === Object.prototype ? Object.fromEntries(Object.entries(o).map(([k, v]) =>
      [k, /color/i.test(k) ? (Array.isArray(v) ? v.map(cor) : cor(v)) : k === 'data' && Array.isArray(v) ? v : troca(v)]))
    : o;
  // usada por mk() ao criar cada gráfico; devolve uma cópia (o objeto de opções compartilhado não muda)
  window.temaGraf = cfg => {
    if (window.Chart) { Chart.defaults.color = tema === 'escuro' ? '#94a3b8' : '#64748b'; Chart.defaults.borderColor = tema === 'escuro' ? '#24314a' : 'rgba(0,0,0,0.1)'; }
    return tema === 'escuro' ? troca(cfg) : cfg;
  };

  // impressão (DRE › Imprimir / PDF) sai sempre no tema claro
  addEventListener('beforeprint', () => { document.documentElement.dataset.tema = 'claro'; });
  addEventListener('afterprint', () => { document.documentElement.dataset.tema = tema; });

  const SOL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const LUA = '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  addEventListener('DOMContentLoaded', () => {
    const pin = document.querySelector('nav .pinsw'); if (!pin) return;
    const d = document.createElement('div'); d.className = 'temasel'; d.title = 'Tema da tela';
    d.innerHTML = `<button type="button" data-t="claro">${SOL}Claro</button><button type="button" data-t="escuro">${LUA}Escuro</button>`;
    const marca = () => d.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tema));
    d.onclick = e => {
      const b = e.target.closest('button'); if (!b || b.dataset.t === tema) return;
      aplica(b.dataset.t); marca(); try { localStorage.setItem('tema', tema); } catch {}
      if (document.querySelector('#view canvas') && typeof window.go === 'function') window.go(); // redesenha os gráficos com as cores do tema
    };
    marca(); pin.after(d);
  });
})();
