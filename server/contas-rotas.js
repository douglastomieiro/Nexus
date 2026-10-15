// Rotas da tela Contas: conectar (login oficial do ML), retorno do login, renomear, desconectar e reiniciar o app.
import { LOJAS } from './ml.js';
import { BROKER, listarContas, iniciarConexao, concluirConexao, renomearConta, desconectarConta, temTokenConta } from './contas.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pagina = (titulo, texto, ok) => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><body style="font-family:system-ui,sans-serif;background:#f6f7f9;color:#1f2937;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px 40px;max-width:460px;text-align:center">
<div style="font-size:40px">${ok ? '✅' : '⚠️'}</div><h2 style="margin:8px 0">${esc(titulo)}</h2><p style="color:#4b5563">${esc(texto)}</p>
<p style="color:#6b7280;font-size:14px">Pode fechar esta aba e voltar ao Nexus.</p></div></body></html>`;

// Contas do arquivo de lista que ainda não estão no servidor em execução (ou o contrário) → precisa reiniciar para coletar.
function precisaReiniciar() {
  const lista = listarContas().filter(c => c.tipo === 'ml');
  const carregadas = Object.entries(LOJAS).filter(([, v]) => v.conta);
  return lista.some(c => LOJAS[`loja${c.n}`]?.conta !== c.user_id || LOJAS[`loja${c.n}`]?.nome !== c.nome)
    || carregadas.some(([k, v]) => !lista.some(c => `loja${c.n}` === k && c.user_id === v.conta));
}

export function registrarContas(app) {
  let ultimo = null; // último retorno do login (a tela Contas mostra o resultado: conectada, já conectada ou erro)
  app.get('/api/contas', (_, res) => res.json({
    broker: !!BROKER,
    app: !!process.versions.electron,
    reiniciar: precisaReiniciar(),
    ultimo,
    contas: listarContas().map(c => ({ n: c.n, loja: `loja${c.n}`, tipo: c.tipo, nome: c.nome, nickname: c.nickname, user_id: c.user_id, conectada_em: c.conectada_em, reconectar: !!c.reconectar || !temTokenConta(c.user_id) })),
    arquivo: Object.entries(LOJAS).filter(([, v]) => v.file).map(([k, v]) => ({ loja: k, nome: v.nome })), // modo avançado (.env)
  }));

  app.post('/api/contas/ml/conectar', async (req, res) => {
    try { res.json({ url: await iniciarConexao(req.socket.localPort) }); console.log('[contas] conexão iniciada: link de autorização gerado'); }
    catch (e) { console.error('[contas] falha ao iniciar a conexão:', e.message); res.status(502).json({ erro: e.message }); }
  });

  // Vem do NAVEGADOR do sistema (sem o cookie do app): liberado no index.js só para esta rota; a segurança é o nonce do state (único, expira em 15 min).
  app.get('/oauth/ml/retorno', async (req, res) => {
    res.set({ 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' });
    try {
      console.log('[contas] retorno do login recebido' + (req.query.error ? ` (ML recusou: ${String(req.query.error).slice(0, 80)})` : ''));
      const c = await concluirConexao(req.query);
      console.log(`[contas] conta ${c.nova ? 'conectada' : 'já conectada (acesso renovado)'}: loja${c.n}`);
      ultimo = { quando: Date.now(), nova: c.nova, nome: c.nome, nickname: c.nickname };
      res.send(c.nova
        ? pagina('Conta conectada!', `${c.nome || c.nickname}: o Nexus já pode ler os dados desta conta.`, true)
        : pagina('Esta conta já estava conectada', `"${c.nickname || c.nome}" já está no Nexus (o acesso foi renovado). Para adicionar outra loja, cole o link no navegador em que a OUTRA conta está logada.`, true));
    } catch (e) {
      console.error('[contas] falha ao concluir a conexão:', e.message);
      ultimo = { quando: Date.now(), erro: e.message };
      res.status(400).send(pagina('Não foi possível conectar', e.message, false));
    }
  });

  app.post('/api/contas/:n/nome', (req, res) => {
    try { renomearConta(Number(req.params.n), req.body?.nome); res.json({ ok: true }); }
    catch (e) { res.status(e.status || 500).json({ erro: e.message }); }
  });

  app.delete('/api/contas/:n', (req, res) => {
    try { desconectarConta(Number(req.params.n)); res.json({ ok: true }); }
    catch (e) { res.status(e.status || 500).json({ erro: e.message }); }
  });

  // Recarrega a lista de contas (o servidor monta as lojas ao iniciar). No app: reinicia sozinho. Fora dele: avisa.
  app.post('/api/app/reiniciar', async (_, res) => {
    if (!process.versions.electron) return res.status(409).json({ erro: 'Reinicie o servidor (node start.js) para carregar as contas.' });
    res.json({ ok: true });
    const { app: eapp } = await import('electron');
    setTimeout(() => { eapp.relaunch(); eapp.exit(0); }, 300);
  });
}
