// Rotas da tela Contas — versão do site web. O login volta ao site com ?code=&state=; client/boot.js entrega esse retorno em POST /api/contas/ml/retorno.
import { BROKER, listarContas, iniciarConexao, concluirConexao, renomearConta, desconectarConta, temTokenConta } from './contas.js';

export function registrarContas(app) {
  let ultimo = null; // último retorno do login (a tela Contas mostra o resultado: conectada, já conectada ou erro)

  app.get('/api/contas', (_, res) => res.json({
    broker: !!BROKER, app: false, web: true, reiniciar: false, ultimo,
    contas: listarContas().map(c => ({ n: c.n, loja: `loja${c.n}`, tipo: c.tipo, nome: c.nome, nickname: c.nickname, user_id: c.user_id, conectada_em: c.conectada_em, reconectar: !!c.reconectar || !temTokenConta(c.user_id) })),
    arquivo: [],
  }));

  app.post('/api/contas/ml/conectar', async (_, res) => {
    try { res.json({ url: await iniciarConexao() }); }
    catch (e) { console.error('[contas] falha ao iniciar a conexão:', e.message); res.status(502).json({ erro: e.message }); }
  });

  // Entregue pela página quando o ML volta ao site. A segurança é o nonce do state (único, expira em 15 min) + PKCE.
  app.post('/api/contas/ml/retorno', async (req, res) => {
    const { code, state, error } = req.body || {};
    try {
      const c = await concluirConexao({ code, state, error });
      ultimo = { quando: Date.now(), nova: c.nova, nome: c.nome, nickname: c.nickname };
      res.json({ ok: true, ...ultimo });
    } catch (e) {
      console.error('[contas] falha ao concluir a conexão:', e.message);
      ultimo = { quando: Date.now(), erro: e.message };
      res.status(400).json({ erro: e.message });
    }
  });

  app.post('/api/contas/:n/nome', async (req, res) => {
    try { await renomearConta(Number(req.params.n), req.body?.nome); res.json({ ok: true }); }
    catch (e) { res.status(e.status || 500).json({ erro: e.message }); }
  });

  app.delete('/api/contas/:n', async (req, res) => {
    try { await desconectarConta(Number(req.params.n)); res.json({ ok: true }); }
    catch (e) { res.status(e.status || 500).json({ erro: e.message }); }
  });

  // No site web as contas passam a valer na próxima abertura: a página recarrega sozinha (boot.js). Rota mantida por compatibilidade.
  app.post('/api/app/reiniciar', (_, res) => res.json({ ok: true }));
}
