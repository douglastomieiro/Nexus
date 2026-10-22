// Análise de Pedidos › Atendimento: perguntas, mensagens e reclamações respondidas aqui, sem entrar no Mercado Livre.
// Abas: Perguntas · Mensagens · Reclamações e devoluções · Respostas prontas. Toda ação pede confirmação (acoes.js) e fica no Histórico de ações.
// Endereços: #atendimento:perguntas | #atendimento:mensagens:<conta>:<pack> | #atendimento:reclamacoes:<conta>:<id> | #atendimento:respostas
// Carregado depois de jodda.js, vendas.js e acoes.js (reaproveita $, esc, brl, num, pc, ic, thumb, getJ, mgPill, canalChip, lojaTxt, abreFicha, confirmaAcao, postAcao, avisoAcao, lerArquivos).
(() => {
  document.head.insertAdjacentHTML('beforeend', `<style>
.atq{display:grid;grid-template-columns:260px 1fr;gap:16px;background:var(--panel);border:1px solid var(--bd);border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:var(--sh)}
.atq.velha{border-left:4px solid var(--bad)}
.atq-an{display:flex;gap:10px;align-items:flex-start;min-width:0}.atq-an img,.atq-an .th{width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 1px var(--bd);background:var(--soft)}
.atq-an b{display:block;font-size:12.5px;color:var(--tx1);line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.atq-an small{display:block;color:var(--mut);font-size:11.5px;margin-top:3px}
.atq-c{min-width:0}.atq-c>small{color:var(--mut);font-size:11.5px}.atq-t{margin:4px 0 8px;font-size:14px;color:var(--tx1);white-space:pre-wrap}
.atq textarea,.atm-w textarea,.atr textarea{width:100%;min-height:64px;resize:vertical;font:inherit}
.atq-ro,.atm-ro{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px}.atq-ro select,.atm-ro select{max-width:220px;padding:6px 8px;font-size:12px}
.atq-ro .cnt,.atm-ro .cnt{color:var(--mut);font-size:11.5px;margin-right:auto}.atq-ro .btn2,.atm-ro .btn2{padding:6px 11px;font-size:12px}
.atq-res{background:var(--soft);border-left:3px solid var(--ok);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--tx2);white-space:pre-wrap}
.atq-ant{margin-top:6px;font-size:12px;color:var(--tx3)}.atq-ant div{border-top:1px dashed var(--line);padding:4px 0}
.atm{display:grid;grid-template-columns:340px 1fr;gap:12px;min-height:520px}
.atm-l{background:var(--panel);border:1px solid var(--bd);border-radius:12px;overflow:auto;max-height:72vh}
.atm-i{display:flex;gap:9px;padding:10px 12px;border-bottom:1px solid var(--line);text-decoration:none;color:inherit}.atm-i:hover{background:var(--row)}.atm-i.on{background:var(--ac2)}
.atm-i img,.atm-i .th{width:38px;height:38px;border-radius:7px;object-fit:cover;flex-shrink:0;background:var(--soft)}.atm-i div{min-width:0;flex:1}
.atm-i b{display:flex;justify-content:space-between;gap:6px;font-size:12.5px;color:var(--tx1)}.atm-i b small{font-weight:400;color:var(--mut)}
.atm-i span{display:block;font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.atm-i.nl span.u{color:var(--tx1);font-weight:600}
.atm-i em{font-style:normal;background:var(--bad);color:#fff;border-radius:99px;padding:0 7px;font-size:10.5px;line-height:17px;align-self:center}
.atm-c{background:var(--panel);border:1px solid var(--bd);border-radius:12px;display:flex;flex-direction:column;max-height:72vh;min-width:0}
.atm-h{padding:11px 14px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:center;flex-wrap:wrap}.atm-h small{color:var(--mut)}
.atm-b{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.atm-m{max-width:78%;padding:8px 11px;border-radius:10px;font-size:13px;white-space:pre-wrap;line-height:1.4}.atm-m small{display:block;color:var(--mut);font-size:10.5px;margin-top:3px}
.atm-m.comprador{background:var(--hov);align-self:flex-start}.atm-m.voce{background:var(--ac2);align-self:flex-end}.atm-m.mod{opacity:.6;text-decoration:line-through}
.atm-w{border-top:1px solid var(--line);padding:10px 14px}
.atr{cursor:pointer}.atr td{vertical-align:middle}.atr .tag{margin:1px 2px}
@media(max-width:980px){.atq{grid-template-columns:1fr}.atm{grid-template-columns:1fr}.atm-l{max-height:260px}}
</style>`);

  SUB.atendimento = 'Perguntas, mensagens e reclamações respondidas aqui, sem entrar no Mercado Livre';
  NOTA.atendimento = 'Perguntas e mensagens chegam a cada minuto';
  const ABAS = [['perguntas', 'Perguntas', 'atendimento'], ['mensagens', 'Mensagens', 'pedidos'], ['reclamacoes', 'Reclamações e devoluções', 'devolucoes'], ['respostas', 'Respostas prontas', 'custos']];
  const tempo = m => m == null ? '—' : m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(m < 600 ? 1 : 0).replace('.', ',')} h` : `${Math.round(m / 1440)} dia(s)`;
  const ha = d => { const m = Math.round((Date.now() - Date.parse(d)) / 60e3); return isNaN(m) ? '' : m < 1 ? 'agora' : `há ${tempo(m)}`; };
  const quando = d => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
  const preenche = (t, vars) => t.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
  let RESP = null;
  const respostas = async () => RESP ||= await getJ('api/at/respostas');
  const opcoesResp = (uso) => (RESP || []).filter(r => r.uso === 'ambos' || r.uso === uso).map(r => `<option value="${esc(r.id)}">${esc(r.titulo)}</option>`).join('');
  const contador = (ta, el, max) => { const f = () => { el.textContent = `${ta.value.length}/${max}`; el.style.color = ta.value.length > max ? 'var(--bad)' : ''; }; ta.addEventListener('input', f); f(); };

  VIEWS.atendimento = async function (arg) {
    // o roteador só passa o 2º pedaço do endereço; conta e conversa/reclamação vêm do próprio #atendimento:aba:loja:id
    const [aba0, loja, id] = (location.hash.startsWith('#atendimento:') ? location.hash.slice(13) : String(arg || '')).split(':'), aba = ABAS.some(a => a[0] === aba0) ? aba0 : 'perguntas';
    $('#view').innerHTML = `<div class="chips" id="ata">${ABAS.map(([k, t, i]) => `<span class="chip${k === aba ? ' on' : ''}" data-k="${k}">${ic(i, 13)} ${t}</span>`).join('')}</div><div id="atv"><p style="color:var(--mut)">Carregando…</p></div>`;
    $('#ata').onclick = e => { const c = e.target.closest('.chip'); if (c) location.hash = 'atendimento:' + c.dataset.k; };
    await respostas().catch(() => { RESP = []; });
    await ({ perguntas: telaPerguntas, mensagens: telaMensagens, reclamacoes: telaReclamacoes, respostas: telaRespostas })[aba](loja, id);
  };

  // ───────── Perguntas ─────────
  const FP = { status: 'abertas', loja: '', q: '' };
  async function telaPerguntas() {
    const D = await getJ(`api/at/perguntas?status=${FP.status}`), T = D.tempo;
    $('#atv').innerHTML = `<div class="kgrid">${kpi('A responder', num(D.abertas), D.abertas ? 'responder em até 1 h vende mais' : 'tudo respondido', 'atendimento', D.abertas ? 'red' : 'green')}
        ${kpi('Tempo médio de resposta', tempo(T.geral), `últimos 14 dias · ${num(T.n)} pergunta(s)`, 'cal', 'blue')}${kpi('Seg a sex, 9h às 18h', tempo(T.comercial), 'horário comercial', 'cal', 'teal')}
        ${kpi('Seg a sex, fora do horário', tempo(T.fora), 'antes das 9h e depois das 18h', 'cal', 'purple')}${kpi('Sábado e domingo', tempo(T.fds), T.ateUmaHora == null ? '' : `${pc(T.ateUmaHora, 0)} respondidas em até 1 h`, 'cal', 'amber')}</div>
      <div class="flt" style="margin-top:0"><div class="fgrid"><label>Mostrar<select id="aps"><option value="abertas">A responder</option><option value="respondidas">Respondidas (15 dias)</option></select></label>
        <label>Conta<select id="apl"><option value="">Todas</option>${Object.entries(LOJAS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
        <label style="flex:1;min-width:220px">Buscar<input id="apq" placeholder="Texto da pergunta ou do anúncio"></label></div></div><div id="apb"></div>`;
    $('#aps').value = FP.status; $('#apl').value = FP.loja; $('#apq').value = FP.q;
    $('#aps').onchange = () => { FP.status = $('#aps').value; telaPerguntas(); };
    const desenha = () => {
      const L = D.lista.filter(x => (!FP.loja || x.loja === FP.loja) && (!FP.q || (x.texto + ' ' + x.anuncio.titulo).toLowerCase().includes(FP.q.toLowerCase())));
      $('#apb').innerHTML = L.map(x => { const A = x.anuncio, velha = !x.resposta && Date.now() - Date.parse(x.data) > 3600e3;
        return `<div class="atq${velha ? ' velha' : ''}" data-k="${esc(x.loja)}|${esc(x.id)}">
          <div class="atq-an">${A.thumb ? `<img src="${esc(A.thumb)}" alt="">` : '<span class="th"></span>'}<div style="min-width:0"><b title="${esc(A.titulo)}">${A.link ? `<a class="lk" target="_blank" rel="noopener" href="${esc(A.link)}">${esc(A.titulo)}</a>` : esc(A.titulo)}</b>
            <small>${A.preco != null ? brl(A.preco) : ''}${A.estoque != null ? ` · estoque ${num(A.estoque)}` : ''}${A.lg ? ` · ${esc(A.lg)}` : ''}${A.status && A.status !== 'active' ? ` · <span class="warn">${esc(A.status)}</span>` : ''}</small>
            <small>${A.margem30 != null ? `margem 30 dias ${mgPill(A.margem30, A.semCusto)}` : 'sem vendas em 30 dias'}${A.vendidos30 ? ` · ${num(A.vendidos30)} vendidos` : ''}</small></div></div>
          <div class="atq-c"><small>${esc(x.nomeLoja)} · ${quando(x.data)} (${ha(x.data)})${x.comprador ? ` · comprador ${esc(x.comprador)}` : ''}${x.totalAnteriores ? ` · <a class="lk" href="#" data-a="ant">${x.totalAnteriores} pergunta(s) anterior(es)</a>` : ''}</small>
            <div class="atq-t">${esc(x.texto)}</div>
            ${x.anteriores.length ? `<div class="atq-ant" hidden>${x.anteriores.map(p => `<div><small>${quando(p.data)}</small> ${esc(p.texto)}${p.resposta ? `<br><i>→ ${esc(p.resposta)}</i>` : ''}</div>`).join('')}</div>` : ''}
            ${x.resposta ? `<div class="atq-res">${esc(x.resposta.texto)}<br><small style="color:var(--mut)">respondida em ${tempo(x.resposta.minutos)}</small></div>`
              : `<textarea placeholder="Sua resposta" maxlength="2000"></textarea><div class="atq-ro"><select data-a="pronta"><option value="">Respostas prontas…</option>${opcoesResp('pergunta')}</select><span class="cnt"></span>
                <button data-a="resp">Responder</button><button class="btn2" data-a="apagar">Apagar</button>${x.comprador ? '<button class="btn2" data-a="bloq">Bloquear comprador</button>' : ''}</div>`}</div></div>`; }).join('')
        || `<div class="box empty"><b>${FP.status === 'abertas' ? 'Nenhuma pergunta esperando resposta.' : 'Nenhuma pergunta respondida no período.'}</b>As perguntas novas chegam a cada minuto.</div>`;
      document.querySelectorAll('#apb .atq textarea').forEach(t => contador(t, t.parentElement.querySelector('.cnt'), 2000));
    };
    $('#apl').onchange = () => { FP.loja = $('#apl').value; desenha(); }; $('#apq').oninput = () => { FP.q = $('#apq').value; desenha(); };
    $('#apb').onclick = async e => {
      const el = e.target.closest('[data-a]'), card = e.target.closest('.atq'); if (!el || !card) return;
      const [loja, id] = card.dataset.k.split('|'), x = D.lista.find(p => p.loja === loja && p.id === id), ta = card.querySelector('textarea');
      if (el.dataset.a === 'ant') { e.preventDefault(); const a = card.querySelector('.atq-ant'); if (a) a.hidden = !a.hidden; return; }
      if (el.tagName === 'SELECT') return;
      el.disabled = true;
      try {
        if (el.dataset.a === 'resp') {
          const texto = ta.value.trim(); if (!texto) { avisoAcao('Escreva a resposta.', true); return; }
          if (!await confirmaAcao({ titulo: 'Responder no Mercado Livre', texto: `<b>Pergunta:</b> ${esc(x.texto)}<br><small>${esc(x.anuncio.titulo)} · ${esc(x.nomeLoja)}</small><br><br>A resposta fica pública no anúncio:`, previa: texto, botao: 'Enviar resposta' })) return;
          await postAcao('api/at/perguntas/responder', { loja, id, texto }); avisoAcao('Resposta enviada ao Mercado Livre.'); card.remove(); D.abertas--;
        } else if (el.dataset.a === 'apagar') {
          if (!await confirmaAcao({ titulo: 'Apagar pergunta', previa: x.texto, perigo: 'A pergunta some do anúncio e não dá para desfazer.', botao: 'Apagar pergunta' })) return;
          await postAcao('api/at/perguntas/apagar', { loja, id }); avisoAcao('Pergunta apagada.'); card.remove();
        } else if (el.dataset.a === 'bloq') {
          if (!await confirmaAcao({ titulo: 'Bloquear comprador', texto: `O comprador <b>${esc(x.comprador)}</b> não poderá mais fazer perguntas nos anúncios da conta ${esc(x.nomeLoja)}. Dá para desbloquear depois em Configurações › Histórico de ações.`, botao: 'Bloquear' })) return;
          await postAcao('api/at/perguntas/bloquear', { loja, comprador: x.comprador }); avisoAcao('Comprador bloqueado para perguntas.');
        }
      } catch (er) { avisoAcao(er.message, true); } finally { el.disabled = false; }
    };
    $('#apb').onchange = e => { const s = e.target.closest('select[data-a="pronta"]'); if (!s?.value) return; const card = s.closest('.atq'), [loja, id] = card.dataset.k.split('|'), x = D.lista.find(p => p.loja === loja && p.id === id), r = RESP.find(r => r.id === s.value), ta = card.querySelector('textarea');
      ta.value = preenche(r.texto, { produto: x.anuncio.titulo, saudacao: saudacao() }); ta.dispatchEvent(new Event('input')); ta.focus(); s.value = ''; };
    desenha();
  }

  // ───────── Mensagens ─────────
  async function telaMensagens(loja, pack) {
    const L = await getJ('api/at/mensagens');
    $('#atv').innerHTML = `<div class="atm"><div class="atm-l"><div style="padding:8px"><input id="amq" placeholder="Buscar comprador, produto ou nº" style="width:100%"></div><div id="aml"></div></div>
      <div class="atm-c" id="amc"><div class="empty" style="margin:auto"><b>Escolha uma conversa</b>As não lidas ficam no topo. As mensagens novas chegam a cada minuto.</div></div></div>`;
    const lista = () => { const q = $('#amq').value.toLowerCase();
      $('#aml').innerHTML = L.filter(c => !q || [c.comprador, c.titulo, c.pack, c.pedido].join(' ').toLowerCase().includes(q)).map(c => `<a class="atm-i${c.naoLidas ? ' nl' : ''}${c.loja === loja && c.pack === pack ? ' on' : ''}" href="#atendimento:mensagens:${esc(c.loja)}:${esc(c.pack)}">
        ${c.thumb ? `<img src="${esc(c.thumb)}" alt="">` : '<span class="th"></span>'}<div><b>${esc(c.comprador || 'Comprador')}<small>${c.ultima?.data ? quando(c.ultima.data) : ''}</small></b><span>${esc(c.titulo || 'venda ' + c.pack)}</span>
        <span class="u">${c.ultima ? `${c.ultima.de === 'voce' ? 'Você: ' : ''}${esc(c.ultima.texto || '(anexo)')}` : 'mensagem não lida'}</span><span>${esc(c.nomeLoja)}${c.bloqueada ? ' · <span class="warn">bloqueada</span>' : ''}</span></div>${c.naoLidas ? `<em>${c.naoLidas}</em>` : ''}</a>`).join('')
        || '<div class="empty"><b>Nenhuma conversa nos últimos 60 dias.</b></div>'; };
    $('#amq').oninput = lista; lista();
    if (loja && pack) await abreConversa(loja, pack);
  }
  async function abreConversa(loja, pack) {
    $('#amc').innerHTML = '<p style="color:var(--mut);padding:14px">Abrindo a conversa no Mercado Livre…</p>';
    let C; try { C = await getJ(`api/at/conversa?loja=${encodeURIComponent(loja)}&pack=${encodeURIComponent(pack)}`); } catch (e) { if (e === STALE) throw e; $('#amc').innerHTML = `<div class="note" style="margin:14px">${esc(e.message)}</div>`; return; }
    const P = C.pedido;
    const desenha = () => {
      $('#amc').innerHTML = `<div class="atm-h">${canalChip('ml', C.loja)}<b>${esc(P?.comprador || 'Comprador')}</b><small>${P ? `${esc(P.titulo)}${P.itens > 1 ? ` + ${P.itens - 1}` : ''} · ${brl(P.total)} · ${quando(P.data)}` : `venda ${esc(C.pack)}`}</small>
          ${P ? `<a class="btn2" style="margin-left:auto;text-decoration:none" href="#" data-ficha="${esc(C.loja)}|${esc(P.pedido)}">${ic('pedidos', 13)}Ver venda</a>` : ''}</div>
        ${C.aoVivo ? '' : '<div class="note" style="margin:8px 14px 0">Não consegui ler a conversa ao vivo no Mercado Livre agora; mostrando a última cópia coletada.</div>'}
        <div class="atm-b" id="amb">${C.mensagens.map(m => `<div class="atm-m ${m.de}${m.moderada ? ' mod' : ''}">${esc(m.texto || '')}${m.anexos.length ? `<br>📎 ${m.anexos.map(esc).join(', ')}` : ''}<small>${m.de === 'voce' ? 'Você' : 'Comprador'} · ${quando(m.data)}${m.moderada ? ' · moderada pelo ML' : ''}</small></div>`).join('') || '<div class="empty" style="margin:auto">Sem mensagens nesta conversa.</div>'}</div>
        <div class="atm-w">${C.podeEnviar ? `<textarea id="amt" placeholder="Mensagem para o comprador" maxlength="${C.limite}"></textarea>
          <div class="atm-ro"><select id="amr"><option value="">Respostas prontas…</option>${opcoesResp('mensagem')}</select><label class="btn2" style="cursor:pointer">${ic('down', 13)}Anexar<input type="file" id="amf" multiple accept=".jpg,.jpeg,.png,.pdf,.gif,.heic,.heif" hidden></label><span class="cnt" id="amn"></span><button id="ame">Enviar</button></div><small id="ama" style="color:var(--mut)"></small>`
          : `<div class="note" style="margin:0">O Mercado Livre não deixa enviar mensagem nesta conversa agora (${esc(C.motivo || C.status)}).</div>`}</div>`;
      const b = $('#amb'); b.scrollTop = b.scrollHeight;
      if (!C.podeEnviar) return;
      contador($('#amt'), $('#amn'), C.limite);
      $('#amf').onchange = () => { $('#ama').textContent = [...$('#amf').files].map(f => f.name).join(', '); };
      $('#amr').onchange = () => { const r = RESP.find(r => r.id === $('#amr').value); if (!r) return; $('#amt').value = preenche(r.texto, { produto: P?.titulo || '', saudacao: saudacao() }); $('#amt').dispatchEvent(new Event('input')); $('#amr').value = ''; };
      $('#ame').onclick = async () => {
        const texto = $('#amt').value.trim(), fs = [...$('#amf').files];
        if (!texto && !fs.length) return avisoAcao('Escreva a mensagem.', true);
        if (!await confirmaAcao({ titulo: 'Enviar mensagem ao comprador', texto: `Para <b>${esc(P?.comprador || 'o comprador')}</b> (${esc(C.nomeLoja)})${fs.length ? `, com ${fs.length} anexo(s): ${fs.map(f => esc(f.name)).join(', ')}` : ''}:`, previa: texto, botao: 'Enviar' })) return;
        $('#ame').disabled = true;
        try { const anexos = await lerArquivos(fs, 25); C = await postAcao('api/at/mensagens/enviar', { loja: C.loja, pack: C.pack, texto, anexos }); avisoAcao('Mensagem enviada.'); desenha(); }
        catch (e) { avisoAcao(e.message, true); $('#ame').disabled = false; }
      };
    };
    desenha();
  }

  // ───────── Reclamações e devoluções ─────────
  const FR = { so: 'abertas' };
  async function telaReclamacoes(loja, id) {
    const L = await getJ('api/at/reclamacoes?dias=60'), ab = L.filter(x => x.aberta);
    const urg = ab.filter(x => x.prazo && Date.parse(x.prazo) - Date.now() < 864e5).length;
    $('#atv').innerHTML = `<div class="kgrid">${kpi('Abertas', num(ab.length), 'esperando você ou o comprador', 'devolucoes', ab.length ? 'red' : 'green')}${kpi('Prazo vencendo', num(urg), 'ação do vendedor em menos de 24 h', 'alertas', urg ? 'red' : 'slate')}
        ${kpi('Em mediação', num(ab.filter(x => /Media/.test(x.etapa)).length), 'o Mercado Livre decide', 'reputacao', 'amber')}${kpi('Encerradas (60 dias)', num(L.length - ab.length), '', 'ok', 'slate')}</div>
      <div class="chips" id="arf"><span class="chip${FR.so === 'abertas' ? ' on' : ''}" data-v="abertas">Abertas</span><span class="chip${FR.so === 'todas' ? ' on' : ''}" data-v="todas">Todas (60 dias)</span></div>
      <div class="box"><div class="tw" style="max-height:none"><table class="rt"><thead><tr><th>Aberta em</th><th>Produto</th><th>Tipo / etapa</th><th>Motivo</th><th class="n">Valor</th><th>Prazo</th><th>Ações liberadas</th></tr></thead><tbody id="arb"></tbody></table></div></div>`;
    const desenha = () => { const V = FR.so === 'abertas' ? ab : L;
      $('#arb').innerHTML = V.map(x => `<tr class="atr" data-k="${esc(x.loja)}|${esc(x.id)}"><td>${quando(x.data)}<br><small style="color:var(--mut)">${esc(x.nomeLoja)}</small></td>
        <td><div class="pr">${thumb(x.thumb)}<div><b>${esc(x.produto || 'venda ' + x.pedido)}</b><small>${esc(x.comprador || '')} · venda ${esc(x.pedido)}</small></div></div></td>
        <td>${esc(x.tipo)}<br><small style="color:var(--mut)">${x.aberta ? esc(x.etapa) : 'encerrada'}${x.afetaReputacao ? ' · <span class="bad">afeta reputação</span>' : ''}</small></td><td><small>${esc(x.motivo || '')}</small></td>
        <td class="n">${x.valor != null ? brl(x.valor) : '—'}</td><td>${x.prazo ? `<span class="${Date.parse(x.prazo) - Date.now() < 864e5 ? 'bad' : ''}">${quando(x.prazo)}</span>` : '—'}</td>
        <td>${x.aberta ? x.acoes.map(a => `<span class="tag${a.obrigatoria ? ' warn' : ''}">${esc(a.txt)}</span>`).join('') || '<small style="color:var(--mut)">nenhuma agora</small>' : ''}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty">Nenhuma reclamação aqui.</td></tr>'; };
    $('#arf').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; FR.so = c.dataset.v; document.querySelectorAll('#arf .chip').forEach(x => x.classList.toggle('on', x === c)); desenha(); };
    $('#arb').onclick = e => { const tr = e.target.closest('tr[data-k]'); if (tr && !e.target.closest('a')) { const [l, i] = tr.dataset.k.split('|'); abreReclamacao(l, i); } };
    desenha();
    if (loja && id) abreReclamacao(loja, id);
  }
  async function abreReclamacao(loja, id) {
    $('#dt').textContent = `Reclamação ${id}`; $('#db').innerHTML = '<p style="color:var(--mut)">Lendo a reclamação no Mercado Livre…</p>'; $('#dw').classList.add('on');
    let R; try { R = await getJ(`api/at/reclamacao?loja=${encodeURIComponent(loja)}&id=${encodeURIComponent(id)}`); } catch (e) { if (e === STALE) return; $('#db').innerHTML = `<div class="note">${esc(e.message)}</div>`; return; }
    const desenha = () => {
      const msg = R.acoes.filter(a => a.mensagem), outras = R.acoes.filter(a => !a.mensagem);
      $('#dt').textContent = `${R.tipo} · venda ${R.pedido}`;
      $('#db').innerHTML = `<div class="fc-top">${canalChip('ml', R.loja)}<span class="tag ${R.aberta ? 'bad' : ''}">${R.aberta ? esc(R.etapa) : 'Encerrada'}</span><small style="color:var(--mut)">aberta em ${quando(R.data)}</small>
          <a class="btn2" style="margin-left:auto;text-decoration:none" href="#" data-ficha="${esc(R.loja)}|${esc(R.pedido)}">${ic('pedidos', 13)}Ver venda</a></div>
        ${R.aoVivo ? '' : '<div class="note">Não consegui ler ao vivo no Mercado Livre; mostrando a última cópia coletada. As ações ficam bloqueadas até ler de novo.</div>'}
        <div class="fc-sec"><h5>Motivo</h5>${esc(R.motivo || '—')}</div>
        <div class="fc-sec"><h5>Conversa da reclamação</h5>${R.mensagens.map(m => `<div class="fc-msg ${m.de === 'Você' ? 'voce' : 'comprador'}">${esc(m.texto || '')}${m.anexos.length ? `<br>📎 ${m.anexos.map(esc).join(', ')}` : ''}<small>${esc(m.de)} → ${esc(m.para)} · ${quando(m.data)}</small></div>`).join('') || '<small style="color:var(--mut)">Sem mensagens.</small>'}</div>
        ${R.aberta && R.aoVivo ? `<div class="fc-sec"><h5>O que você pode fazer agora</h5>${R.acoes.length ? '' : '<small style="color:var(--mut)">O Mercado Livre não libera nenhuma ação para o vendedor neste momento.</small>'}
          ${msg.length ? `<select id="rcd" style="margin-bottom:6px">${msg.map(a => `<option value="${a.acao}">${esc(a.txt)}${a.prazo ? ` (até ${quando(a.prazo)})` : ''}</option>`).join('')}</select>
            <textarea id="rct" placeholder="Mensagem" style="width:100%;min-height:70px"></textarea><div class="atm-ro"><label class="btn2" style="cursor:pointer">${ic('down', 13)}Anexar<input type="file" id="rcf" multiple accept=".jpg,.jpeg,.png,.pdf" hidden></label><small id="rca" style="color:var(--mut);margin-right:auto"></small><button id="rce">Enviar mensagem</button></div>` : ''}
          ${outras.map(a => `<div class="fl" style="align-items:center"><span>${esc(a.txt)}${a.prazo ? ` <small>(até ${quando(a.prazo)})</small>` : ''}${a.obrigatoria ? ' <span class="tag warn">obrigatória</span>' : ''}</span>
            ${a.conhecida ? `<span>${a.percentual ? '<input type="number" min="1" max="99" placeholder="%" style="width:70px;margin-right:6px" data-p="' + a.acao + '">' : ''}<button class="btn2" data-acao="${a.acao}">Fazer</button></span>` : `<a class="btn2" target="_blank" rel="noopener" href="${esc(R.link)}" style="text-decoration:none">Fazer no ML</a>`}</div>`).join('')}</div>` : ''}`;
      $('#rcf')?.addEventListener('change', () => { $('#rca').textContent = [...$('#rcf').files].map(f => f.name).join(', '); });
      $('#rce')?.addEventListener('click', async () => {
        const texto = $('#rct').value.trim(), fs = [...$('#rcf').files], a = R.acoes.find(x => x.acao === $('#rcd').value);
        if (!texto) return avisoAcao('Escreva a mensagem.', true);
        if (!await confirmaAcao({ titulo: a.txt, texto: `Reclamação da venda ${esc(R.pedido)}${fs.length ? `, com ${fs.length} anexo(s)` : ''}:`, previa: texto, botao: 'Enviar' })) return;
        try { const anexos = await lerArquivos(fs, 5); R = await postAcao('api/at/reclamacoes/acao', { loja: R.loja, id: R.id, acao: a.acao, mensagem: texto, anexos }); avisoAcao('Mensagem enviada na reclamação.'); desenha(); } catch (e) { avisoAcao(e.message, true); }
      });
      $('#db').querySelectorAll('button[data-acao]').forEach(b => b.onclick = async () => {
        const a = R.acoes.find(x => x.acao === b.dataset.acao), p = a.percentual ? Number($('#db').querySelector(`[data-p="${a.acao}"]`)?.value) : null;
        if (a.percentual && !(p > 0 && p < 100)) return avisoAcao('Informe a porcentagem do reembolso (1 a 99).', true);
        if (!await confirmaAcao({ titulo: a.txt, texto: `Reclamação da venda ${esc(R.pedido)} (${esc(R.nomeLoja)})${p ? `: reembolso de <b>${p}%</b> do valor` : ''}.`, perigo: a.perigo || '', marcar: a.perigo ? 'Entendi o que acontece com esta ação' : '', botao: a.txt })) return;
        b.disabled = true;
        try { R = await postAcao('api/at/reclamacoes/acao', { loja: R.loja, id: R.id, acao: a.acao, percentual: p }); avisoAcao('Feito no Mercado Livre.'); desenha(); } catch (e) { avisoAcao(e.message, true); b.disabled = false; }
      });
    };
    desenha();
  }

  // ───────── Respostas prontas ─────────
  async function telaRespostas() {
    let L = (await getJ('api/at/respostas')).map(r => ({ ...r }));
    const desenha = () => {
      $('#atv').innerHTML = `<div class="box"><div class="boxh"><h3>Respostas prontas</h3><small>Use {saudacao} (bom dia, boa tarde ou boa noite) e {produto} (título do anúncio): o texto é completado na hora de responder.</small></div>
        <div id="arp">${L.map((r, i) => `<div class="atq" style="grid-template-columns:220px 1fr;box-shadow:none" data-i="${i}"><div><input data-f="titulo" value="${esc(r.titulo)}" placeholder="Nome (ex.: Prazo de entrega)" style="width:100%">
          <select data-f="uso" style="width:100%;margin-top:6px"><option value="ambos">Perguntas e mensagens</option><option value="pergunta">Só perguntas</option><option value="mensagem">Só mensagens</option></select></div>
          <div><textarea data-f="texto" placeholder="Texto da resposta">${esc(r.texto)}</textarea><div class="atq-ro"><span class="cnt"></span><button class="btn2" data-a="del">Remover</button></div></div></div>`).join('')}</div>
        <div class="atq-ro"><button class="btn2" id="arn">+ Nova resposta</button><span style="margin-right:auto"></span><button id="ars">Salvar respostas</button></div></div>`;
      document.querySelectorAll('#arp .atq').forEach(c => { c.querySelector('[data-f=uso]').value = L[c.dataset.i].uso || 'ambos'; contador(c.querySelector('textarea'), c.querySelector('.cnt'), 350); });
      $('#arp').oninput = $('#arp').onchange = e => { const c = e.target.closest('.atq'), f = e.target.dataset.f; if (c && f) L[c.dataset.i][f] = e.target.value; };
      $('#arp').onclick = e => { const c = e.target.closest('.atq'); if (e.target.dataset.a === 'del' && c) { L.splice(+c.dataset.i, 1); desenha(); } };
      $('#arn').onclick = () => { L.push({ id: String(Date.now()), titulo: '', texto: '', uso: 'ambos' }); desenha(); };
      $('#ars').onclick = async () => { try { L = await postAcao('api/at/respostas', L); RESP = L.map(r => ({ ...r })); avisoAcao('Respostas prontas salvas.'); desenha(); } catch (e) { avisoAcao(e.message, true); } };
    };
    desenha();
  }
})();
