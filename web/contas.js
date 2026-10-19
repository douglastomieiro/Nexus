// Configurações > Contas: conectar contas do Mercado Livre pelo login oficial (botão "Conectar" → navegador → "Autorizar").
// Carregado por último: reaproveita $, esc, GRUPOS, SUB, SEM_FILTRO, VIEWS.
(() => {
  const cfg = GRUPOS.find(g => g.n === 'Configurações'); if (cfg) cfg.tabs.unshift(['contas', 'Contas']);
  SUB.contas = 'Conecte suas contas do Mercado Livre — basta autorizar na página oficial';
  SEM_FILTRO.contas = 1;

  const btn = (id, txt, cor = 'var(--ac)', extra = '') => `<button id="${id}" ${extra} style="background:${cor};border:0;border-radius:6px;padding:8px 16px;font-weight:600;cursor:pointer;color:#fff">${txt}</button>`;
  const dataBr = s => (s ? new Date(s).toLocaleDateString('pt-BR') : '');
  let espera = null; // polling enquanto o usuário autoriza no navegador
  const WEB = !!window.NEXUS_WEB; // versão do site (GitHub Pages): o login acontece nesta mesma aba e volta para cá

  async function carregar() { const r = await fetch('api/contas'); return r.json(); }

  VIEWS.contas = async function () {
    clearInterval(espera); espera = null;
    const d = await carregar();
    const linhas = d.contas.map(c => `<tr>
      <td><input id="nm_${c.n}" value="${esc(c.nome)}" style="width:180px"> <a href="#" data-nome="${c.n}" style="font-size:13px">salvar</a></td>
      <td>${esc(c.nickname || '')}</td><td>${dataBr(c.conectada_em)}</td>
      <td>${c.reconectar ? '<span class="tag warn">precisa reconectar</span>' : '<span class="tag ok">conectada</span>'}</td>
      <td style="text-align:right">${c.reconectar ? `<a href="#" data-conectar="1">Reconectar</a> · ` : ''}<a href="#" data-sair="${c.n}" style="color:var(--bad,#dc2626)">Desconectar</a></td></tr>`).join('');
    $('#view').innerHTML = `<div class="box" style="max-width:860px">
      <h3>Contas do Mercado Livre</h3>
      ${d.reiniciar ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin:0 0 14px">
        <b>Contas atualizadas.</b> ${d.app ? 'Reinicie o app para começar a coletar.' : 'Reinicie o servidor (node start.js) para começar a coletar.'}
        ${d.app ? ' ' + btn('rei', 'Reiniciar agora', '#059669') : ''}</div>` : ''}
      ${!d.broker ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 14px">
        O login automático ainda não está configurado nesta versão (falta o endereço do intermediário — veja o README, "Publicar o intermediário").</div>` : ''}
      ${d.contas.length ? `<div class="tw"><table><thead><tr><th>Nome no painel</th><th>Apelido no ML</th><th>Conectada em</th><th>Situação</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>`
        : '<p style="color:var(--mut)">Nenhuma conta conectada ainda.</p>'}
      <p style="margin-top:18px">${btn('lnk', WEB ? '🔗 Conectar conta do Mercado Livre' : '🔗 Copiar link de autorização', 'var(--ac)', d.broker ? '' : 'disabled')}
        ${WEB ? '' : btn('con', 'Abrir no navegador padrão', '#64748b', d.broker ? '' : 'disabled')}</p>
      <div id="lkbox" style="display:none;margin:4px 0 10px"><input id="lk" readonly style="width:100%;font-size:12px;color:var(--mut)" onclick="this.select()"></div>
      <p id="st" style="color:var(--tx);font-weight:600;min-height:1em"></p>
      ${WEB ? `<p style="color:var(--mut);font-size:13px;line-height:1.5"><b>Várias lojas:</b> conecte uma conta de cada vez. Para a segunda loja, saia da primeira no Mercado Livre (ou use outro perfil do navegador) e clique em <b>Conectar</b> de novo — cada navegador/perfil guarda seus próprios dados.<br>
        O acesso e os dados ficam só neste navegador (os tokens, cifrados). <b>Faça backup dos custos</b> em Configurações: limpar os dados do site apaga tudo.</p>` : `<p style="color:var(--mut);font-size:13px;line-height:1.5"><b>Várias lojas:</b> clique em <b>Copiar link de autorização</b>, cole o link no navegador
        (ou perfil) onde a conta desejada já está logada no Mercado Livre e clique em <b>Autorizar</b>. Repita para cada loja — cada link vale uma vez, por 15 minutos.<br>
        O acesso fica guardado só neste computador, cifrado. O app precisa estar aberto enquanto você autoriza.</p>`}
      ${d.arquivo.length ? `<hr style="border-color:var(--bd)"><p style="color:var(--mut);font-size:13px">Também em uso pelo modo avançado (arquivo de token no .env): ${d.arquivo.map(a => esc(a.nome)).join(', ')}.</p>` : ''}
    </div>`;

    // modo 'copiar': mostra/copia o link (para colar no navegador da conta certa); modo 'abrir': abre no navegador padrão
    const iniciar = modo => async e => {
      e?.preventDefault();
      const r = await fetch('api/contas/ml/conectar', { method: 'POST' }), j = await r.json();
      if (!r.ok) { $('#st').textContent = j.erro || 'Não foi possível iniciar.'; return; }
      if (WEB) { $('#st').textContent = 'Abrindo o login do Mercado Livre…'; location.assign(j.url); return; }
      if (modo === 'abrir') { window.open(j.url, '_blank'); $('#st').textContent = 'Aguardando você autorizar no navegador…'; }
      else {
        $('#lkbox').style.display = ''; $('#lk').value = j.url;
        let copiou = false; try { await navigator.clipboard.writeText(j.url); copiou = true; } catch { $('#lk').select(); }
        $('#st').textContent = copiou ? '✓ Link copiado. Cole no navegador da conta que você quer conectar e clique em Autorizar.' : 'Copie o link acima (Ctrl+C) e cole no navegador da conta que você quer conectar.';
      }
      const desde = Date.now(), fim = desde + 15 * 60e3;
      clearInterval(espera);
      espera = setInterval(async () => {
        if (location.hash.slice(1) !== 'contas' || Date.now() > fim) { clearInterval(espera); return; }
        const n = await carregar().catch(() => null), u = n?.ultimo;
        if (!u || u.quando < desde) return;
        clearInterval(espera);
        await VIEWS.contas();
        const msg = u.erro ? `⚠️ ${u.erro}` : u.nova ? `✓ Conta "${u.nome}" conectada.` : `ℹ️ A conta "${u.nickname || u.nome}" já estava conectada (acesso renovado). Para adicionar outra loja, cole o link no navegador em que a OUTRA conta está logada.`;
        $('#st').textContent = msg;
      }, 2000);
    };
    $('#lnk').onclick = iniciar('copiar');
    if ($('#con')) $('#con').onclick = iniciar('abrir');
    document.querySelectorAll('[data-conectar]').forEach(a => (a.onclick = iniciar('copiar')));
    document.querySelectorAll('[data-nome]').forEach(a => (a.onclick = async e => {
      e.preventDefault(); const n = a.dataset.nome;
      const r = await fetch(`api/contas/${n}/nome`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: $('#nm_' + n).value }) });
      if (r.ok) VIEWS.contas();
    }));
    document.querySelectorAll('[data-sair]').forEach(a => (a.onclick = async e => {
      e.preventDefault();
      if (!confirm('Desconectar esta conta? O acesso é apagado deste computador; os dados já coletados continuam no painel.')) return;
      const r = await fetch(`api/contas/${a.dataset.sair}`, { method: 'DELETE' });
      if (r.ok) VIEWS.contas();
    }));
    try { const m = sessionStorage.getItem('nexus_msg'); if (m) { sessionStorage.removeItem('nexus_msg'); $('#st').textContent = m; } } catch { /* sem aviso */ }
    if ($('#rei')) $('#rei').onclick = async () => { $('#rei').disabled = true; $('#rei').textContent = 'Reiniciando…'; await fetch('api/app/reiniciar', { method: 'POST' }); };
  };

  // Primeira vez (nenhuma conta): abre direto a tela Contas.
  fetch('api/contas').then(r => r.json()).then(d => {
    if (!d.contas.length && !d.arquivo.length && ['', 'lucro'].includes(location.hash.slice(1))) location.hash = 'contas';
  }).catch(() => {});
})();
