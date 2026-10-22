// Ações no Mercado Livre pela tela: janela de confirmação (o que vai mudar), envio ao servidor, aviso do resultado
// e Configurações › Histórico de ações. Carregado depois de jodda.js (reaproveita $, esc, ic, GRUPOS, ICO, SUB, NOTA, VIEWS, ln, tbl).
(() => {
  document.head.insertAdjacentHTML('beforeend', `<style>
#acm{position:fixed;inset:0;z-index:70;background:rgba(15,23,42,.45);display:grid;place-items:center;padding:16px}
#acm .cx{background:var(--panel);border:1px solid var(--bd);border-radius:14px;width:min(520px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.3)}
#acm h4{margin:0;padding:16px 18px 6px;font-size:15px}#acm .co{padding:4px 18px 10px;overflow:auto;font-size:13px;color:var(--tx2);line-height:1.5}
#acm .co pre{white-space:pre-wrap;background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0;font:inherit;color:var(--tx1);max-height:240px;overflow:auto}
#acm .co .pg{color:var(--bad);font-weight:600;margin-top:8px}#acm .co label{display:flex;gap:8px;align-items:center;margin-top:10px;color:var(--tx1)}
#acm .ro{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px 16px;border-top:1px solid var(--line)}
#acm .ro .perigo{background:#dc2626}
#act{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:80;display:flex;flex-direction:column;gap:8px;align-items:center}
#act div{padding:10px 16px;border-radius:10px;color:#fff;font-weight:500;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.25);background:#16a34a;max-width:min(560px,92vw)}#act div.bad{background:#dc2626}
</style>`);

  // Confirmação: mostra o que vai ser feito no ML. Resolve true (confirmou) ou false. `marcar` = caixa que precisa ser marcada antes (ações definitivas).
  window.confirmaAcao = ({ titulo, texto = '', previa = '', perigo = '', botao = 'Confirmar', marcar = '' }) => new Promise(fim0 => {
    document.getElementById('acm')?.remove();
    const d = document.createElement('div'); d.id = 'acm';
    d.innerHTML = `<div class="cx" role="dialog" aria-modal="true"><h4>${esc(titulo)}</h4><div class="co">${texto}${previa ? `<pre>${esc(previa)}</pre>` : ''}${perigo ? `<div class="pg">${esc(perigo)}</div>` : ''}
      ${marcar ? `<label><input type="checkbox" id="acmk"> ${esc(marcar)}</label>` : ''}</div>
      <div class="ro"><button class="btn2" data-r="0">Cancelar</button><button data-r="1" class="${perigo ? 'perigo' : ''}"${marcar ? ' disabled' : ''}>${esc(botao)}</button></div></div>`;
    const fim = r => { d.remove(); removeEventListener('keydown', tecla, true); fim0(r); };
    const tecla = e => { if (e.key === 'Escape') fim(false); };
    d.onclick = e => { if (e.target === d) return fim(false); const b = e.target.closest('button[data-r]'); if (b && !b.disabled) fim(b.dataset.r === '1'); };
    d.querySelector('#acmk')?.addEventListener('change', e => { d.querySelector('button[data-r="1"]').disabled = !e.target.checked; });
    addEventListener('keydown', tecla, true); document.body.appendChild(d); d.querySelector(marcar ? '#acmk' : 'button[data-r="1"]').focus();
  });
  window.avisoAcao = (msg, ruim = false) => {
    let b = document.getElementById('act'); if (!b) { b = document.createElement('div'); b.id = 'act'; document.body.appendChild(b); }
    const el = document.createElement('div'); el.className = ruim ? 'bad' : ''; el.textContent = msg; b.appendChild(el); setTimeout(() => el.remove(), ruim ? 9000 : 4500);
  };
  // POST para uma rota de ação; erro do servidor (já em português) vira exceção
  window.postAcao = async (url, corpo) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).catch(() => null);
    if (!r) throw new Error('Sem conexão com o servidor.');
    const j = await r.json().catch(() => ({ erro: `resposta inválida do servidor (HTTP ${r.status})` }));
    if (!r.ok) throw new Error(j.erro || `HTTP ${r.status}`); return j;
  };
  // arquivos escolhidos → [{ nome, mime, base64 }] (para anexos de mensagem)
  window.lerArquivos = (files, maxMB) => Promise.all([...files].map(f => new Promise((ok, falha) => {
    if (f.size > maxMB * 1048576) return falha(new Error(`${f.name}: passa de ${maxMB} MB.`));
    const r = new FileReader(); r.onload = () => ok({ nome: f.name.replace(/[^\w.-]+/g, '_').slice(-100), mime: f.type, base64: String(r.result).split(',')[1] }); r.onerror = () => falha(new Error(`${f.name}: não deu para ler.`)); r.readAsDataURL(f);
  })));

  // ───────── Configurações › Histórico de ações ─────────
  ICO.acoes = '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>';
  const g = GRUPOS.find(x => x.n === 'Configurações'); if (g && !g.tabs.some(t => t[0] === 'acoes')) g.tabs.splice(1, 0, ['acoes', 'Histórico de ações']);
  SUB.acoes = 'Tudo o que o sistema fez no Mercado Livre, com a resposta do ML';
  NOTA.acoes = 'As 300 ações mais recentes';
  const NOMES = { 'pergunta.responder': 'Respondeu pergunta', 'pergunta.apagar': 'Apagou pergunta', 'pergunta.bloquear': 'Bloqueou comprador', 'pergunta.desbloquear': 'Desbloqueou comprador',
    'mensagem.enviar': 'Enviou mensagem', 'mensagem.anexo': 'Enviou anexo', 'reclamacao.anexo': 'Anexo na reclamação' };
  VIEWS.acoes = async function () {
    const [H, C] = await Promise.all([getJ('api/acoes/historico?limite=300'), getJ('api/acoes/contas')]);
    const nome = t => NOMES[t] || (t.startsWith('reclamacao.') ? 'Reclamação: ' + t.slice(11).replace(/_/g, ' ') : t);
    $('#view').innerHTML = `${C.simulado ? '<div class="note">Modo de teste: as ações são registradas, mas nada é enviado ao Mercado Livre.</div>' : ''}
      <div class="box" style="margin-bottom:14px"><b>Contas que podem agir no Mercado Livre:</b> ${C.contas.length ? C.contas.map(c => `${esc(lojaTxt(c.loja))}${c.nickname ? ` (${esc(c.nickname)})` : ''}`).join(' · ') : '<span class="bad">nenhuma</span>'}
      <p class="dica" style="margin-top:6px">As ações usam a mesma autorização de escrita dos Descontos. Conta que não aparece aqui só consulta.</p></div>
      <div class="box" id="ach">${H.length ? tbl([{ t: 'Quando', f: r => dt(r.quando) }, { t: 'Conta', f: r => esc(lojaTxt(r.loja)) }, { t: 'Ação', f: r => esc(nome(r.tipo)) }, { t: 'Alvo', f: r => esc(r.alvo) },
        { t: 'Resultado', f: r => r.ok ? `<span class="tag ok">${r.resposta?.simulado ? 'simulado' : 'ok'}</span>` : `<span class="tag bad" title="${esc(JSON.stringify(r.resposta))}">erro ${r.status || ''}</span>` },
        { t: 'Detalhe', f: r => r.tipo === 'pergunta.bloquear' && r.ok && !desbloqueado(r) ? `<button class="btn2" data-desb="${esc(r.loja)}|${esc(r.alvo)}">Desbloquear</button>`
          : `<small style="color:var(--mut)">${esc(r.pedido?.corpo?.text || r.pedido?.corpo?.message || r.pedido?.arquivo || '').slice(0, 120)}</small>` }], H) : '<div class="empty"><b>Nenhuma ação ainda.</b>As ações feitas pelo sistema no Mercado Livre aparecem aqui.</div>'}</div>`;
    // bloqueio de comprador desfeito por um desbloqueio mais novo (o histórico vem do mais novo para o mais antigo)
    function desbloqueado(r) { return H.some(d => d.id > r.id && d.ok && d.tipo === 'pergunta.desbloquear' && d.loja === r.loja && d.alvo === r.alvo); }
    $('#ach').onclick = async e => {
      const b = e.target.closest('button[data-desb]'); if (!b) return; const [loja, comprador] = b.dataset.desb.split('|');
      if (!await confirmaAcao({ titulo: 'Desbloquear comprador', texto: `O comprador <b>${esc(comprador)}</b> volta a poder fazer perguntas nos anúncios da conta ${esc(lojaTxt(loja))}.`, botao: 'Desbloquear' })) return;
      b.disabled = true;
      try { await postAcao('api/at/perguntas/bloquear', { loja, comprador, desbloquear: true }); avisoAcao('Comprador desbloqueado.'); VIEWS.acoes(); } catch (er) { avisoAcao(er.message, true); b.disabled = false; }
    };
  };
})();
