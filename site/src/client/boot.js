// Boot do site: sobe o Worker (que roda o código de server/ no navegador) e faz os fetch('api/...') da interface irem para ele.
// Também recebe a volta do login do Mercado Livre (?code=&state=) e mostra avisos de carregamento/erro.
(() => {
  window.NEXUS_WEB = true;
  const base = new URL('.', document.baseURI).pathname; // ex.: /NEXUS_/
  const fetchOriginal = window.fetch.bind(window);

  // ── aviso por cima da página (carregando / erro) ──
  const tela = document.createElement('div');
  tela.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#0f172a;color:#e5e7eb;font:16px system-ui,sans-serif;text-align:center;padding:24px';
  const aviso = (titulo, texto, erro) => {
    tela.innerHTML = `<div style="max-width:480px"><div style="font-size:40px">${erro ? '⚠️' : '⏳'}</div><h2 style="margin:8px 0">${titulo}</h2><p style="color:#94a3b8;line-height:1.5">${texto}</p></div>`;
    if (!tela.isConnected) document.documentElement.appendChild(tela);
  };
  aviso('Abrindo o Nexus…', 'Preparando o banco de dados no seu navegador.');

  // ── Worker ──
  let seq = 0;
  const pendentes = new Map();
  let liberar, falhar;
  const pronto = new Promise((ok, no) => { liberar = ok; falhar = no; });
  pronto.catch(() => {}); // o erro já aparece na tela
  const worker = new Worker('worker.js', { type: 'module' });
  worker.onerror = e => { aviso('Não foi possível abrir o Nexus', 'Este navegador não conseguiu iniciar o painel (' + (e.message || 'erro desconhecido') + '). Tente o Chrome, Edge ou Firefox atualizados.', true); falhar(new Error('worker')); };
  worker.onmessage = ({ data: m }) => {
    if (m.t === 'pronto') { liberar(m); return; }
    if (m.t === 'erro') {
      if (m.codigo === 'ocupado') aviso('O Nexus já está aberto em outra aba', 'Os dados ficam guardados neste navegador e só uma aba pode usá-los por vez. Feche a outra aba e <a href="" style="color:#7dd3fc">recarregue esta</a>.', true);
      else aviso('Não foi possível abrir o Nexus', m.mensagem || 'Erro desconhecido.', true);
      falhar(new Error(m.mensagem)); return;
    }
    if (m.t === 'res') { const p = pendentes.get(m.id); pendentes.delete(m.id); p?.({ status: m.status, corpo: m.corpo, tipo: m.tipo }); }
  };
  const chamar = (metodo, caminho, query, corpo) => pronto.then(() => new Promise(ok => {
    const id = ++seq; pendentes.set(id, ok); worker.postMessage({ t: 'req', id, metodo, caminho, query, corpo });
  }));

  // ── fetch('api/...') → Worker ──
  window.fetch = (entrada, init = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada.url, document.baseURI);
    if (u.origin !== location.origin || !u.pathname.startsWith(base + 'api/')) return fetchOriginal(entrada, init);
    let corpo; try { corpo = typeof init.body === 'string' ? JSON.parse(init.body) : undefined; } catch { corpo = undefined; }
    return chamar((init.method || 'GET').toUpperCase(), '/' + u.pathname.slice(base.length), Object.fromEntries(u.searchParams), corpo)
      .then(r => new Response(r.corpo, { status: r.status, headers: { 'content-type': r.tipo } }));
  };

  // ── volta do login (o ML → intermediário → esta página com ?code=&state=w.<nonce>) ──
  const q = new URLSearchParams(location.search);
  const voltaLogin = (q.has('code') || q.has('error')) && (q.get('state') || '').startsWith('w.');
  pronto.then(async m => {
    try { navigator.storage?.persist?.(); } catch { /* opcional */ }
    if (voltaLogin) {
      aviso('Conectando a conta…', 'Concluindo o login com o Mercado Livre.');
      const r = await fetch('api/contas/ml/retorno', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: q.get('code'), state: q.get('state'), error: q.get('error') }) });
      const j = await r.json().catch(() => ({}));
      try { sessionStorage.setItem('nexus_msg', j.erro ? '⚠️ ' + j.erro : j.nova ? `✓ Conta "${j.nome}" conectada.` : `ℹ️ A conta "${j.nickname || j.nome}" já estava conectada (acesso renovado).`); } catch { /* sem aviso */ }
      // limpa o ?code= da barra de endereço e recarrega: as contas valem a partir da próxima abertura do painel
      history.replaceState(null, '', base + '#contas');
      location.reload();
      return;
    }
    tela.remove();
    if (!m.persistente) {
      const b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#7c2d12;color:#fff;padding:8px 16px;font:14px system-ui,sans-serif;text-align:center';
      b.textContent = 'Este navegador não guarda dados entre visitas (janela privada?). O que for coletado some ao fechar a aba.';
      document.body.appendChild(b);
    }
  }).catch(() => {});
})();
