// Worker do site: roda o MESMO código de server/ (rotas, coleta, margem...) dentro do navegador. A página conversa com ele por postMessage
// (client/boot.js troca os fetch('api/...') por mensagens). Em vez do Express e do SQLite do Node há os shims de ./shims.
import './shims/globals.js';
import express, { despachar } from './shims/express.js';

self.onmessage = async ({ data: m }) => {
  if (m.t !== 'req') return;
  const r = await despachar(m).catch(e => ({ status: 500, corpo: JSON.stringify({ erro: e.message }), tipo: 'application/json' }));
  self.postMessage({ t: 'res', id: m.id, ...r });
};

try {
  await import('../../server/index.js'); // registra as rotas e liga o agendador (shims/cron.js)
  const { persistente } = await import('./shims/sqlite.js');
  const { montar, restaurar, fazerBackup } = await import('./overrides/backup.js');
  const { db } = await import('../../server/db.js');
  const app = express();
  app.get('/api/web/status', (_, res) => res.json({ persistente }));
  // Backup em arquivo (a proteção contra limpar os dados do navegador): baixa e restaura custos + configurações.
  app.get('/api/backup', (_, res) => res.json(montar('exportação')));
  app.post('/api/backup/restaurar', (req, res) => {
    const b = req.body?.arquivo;
    if (!b || !Array.isArray(b.custos)) return res.status(400).json({ erro: 'Arquivo de backup inválido.' });
    for (const c of b.custos) if (!c || typeof c.sku !== 'string' || !(Number(c.custo) >= 0)) return res.status(400).json({ erro: 'Arquivo de backup inválido (custos).' });
    const r = restaurar({ arquivo: b, forcar: true }); fazerBackup('importação'); res.json(r);
  });
  void db;
  self.postMessage({ t: 'pronto', persistente });
} catch (e) {
  console.error('Nexus: falha ao iniciar', e);
  self.postMessage({ t: 'erro', codigo: e.codigo || 'falha', mensagem: e.message });
}
