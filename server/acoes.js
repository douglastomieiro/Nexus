// Ações no Mercado Livre (escrita): a porta única que todas as telas usam para mudar algo no ML.
// Usa os mesmos tokens com permissão de escrita dos Descontos (descontos/ml.js) e grava cada ação em acoes_log:
// quando, conta, o que foi pedido e o que o ML respondeu (deu certo ou não). A confirmação fica na tela, antes de chamar estas rotas.
// Com ML_ACOES_SIMULADAS=1 no ambiente (só para teste), nada vai ao ML: a ação é registrada como simulada e devolve sucesso.
import { db } from './db.js';
import { contas, tokenDe, req, API } from './descontos/ml.js';

db.exec(`CREATE TABLE IF NOT EXISTS acoes_log (id INTEGER PRIMARY KEY AUTOINCREMENT, quando INTEGER NOT NULL, loja TEXT, tipo TEXT, alvo TEXT,
  pedido TEXT, status INTEGER, ok INTEGER, resposta TEXT)`);

export const SIMULADO = !!process.env.ML_ACOES_SIMULADAS;
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
// conta com token de escrita (a mesma dos Descontos) para a loja do sistema (loja1, loja2…)
export const contaDaLoja = loja => contas().find(c => c.loja === loja) || null;
export const vendedorDe = loja => { const c = contaDaLoja(loja); if (!c) throw erro('Esta conta não tem permissão de escrita configurada (a mesma usada pelos Descontos).'); return String(c.id); };

const registra = (loja, tipo, alvo, pedido, status, ok, resposta) => db.prepare('INSERT INTO acoes_log (quando,loja,tipo,alvo,pedido,status,ok,resposta) VALUES (?,?,?,?,?,?,?,?)')
  .run(Date.now(), loja, tipo, String(alvo ?? ''), JSON.stringify(pedido).slice(0, 4000), status, ok ? 1 : 0, JSON.stringify(resposta ?? null).slice(0, 4000));

// mensagens do ML que o vendedor entende melhor em português
const TRADUZ = [[/max characters allowed are (\d+)/i, m => `A mensagem passa do limite de ${m[1]} caracteres do Mercado Livre.`],
  [/mediation is in process/i, () => 'Há uma mediação em andamento: o ML não deixa enviar mensagem por aqui.'],
  [/Fulfillment|not been yet delivered/i, () => 'Venda Full ainda não entregue: o ML só libera mensagem depois da entrega.'],
  [/blocked_conversation/i, () => 'A conversa está bloqueada pelo Mercado Livre.'],
  [/not supported/i, () => 'O texto tem caracteres que o Mercado Livre não aceita.'],
  [/invalid_token|expired_token|unauthorized/i, () => 'Token sem permissão ou vencido: reconecte a conta em Configurações.']];
const traduz = (status, r) => { const t = [r?.message, r?.error, r?.cause?.[0]?.message].filter(Boolean).join(' · ') || `HTTP ${status}`; for (const [re, f] of TRADUZ) { const m = t.match(re); if (m) return f(m); } return `O Mercado Livre recusou (HTTP ${status}): ${t}`; };

// Uma ação: chama o ML com o token de escrita, registra e devolve a resposta (ou lança o erro já em português)
export async function acaoML(loja, tipo, alvo, metodo, caminho, corpo) {
  const id = vendedorDe(loja), pedido = { metodo, caminho, corpo };
  if (SIMULADO) { const r = { simulado: true }; registra(loja, tipo, alvo, pedido, 200, true, r); return r; }
  let status = 0, resposta = null, ok = false;
  try { const r = await req(() => tokenDe(id), metodo, caminho, { data: corpo }); status = r.status; resposta = r.data; ok = true; }
  catch (e) { status = e.response?.status || 0; resposta = e.response?.data || { message: e.message }; }
  registra(loja, tipo, alvo, pedido, status, ok, resposta);
  if (!ok) throw Object.assign(erro(traduz(status, resposta), 502), { ml: resposta });
  return resposta;
}

// Anexo (multipart): o arquivo chega da tela em base64. Devolve a resposta do ML (com o id/nome do anexo).
export async function enviaArquivo(loja, tipo, alvo, caminho, { nome, mime, base64 }) {
  const id = vendedorDe(loja), pedido = { metodo: 'POST', caminho, arquivo: nome, bytes: Math.round((base64 || '').length * 0.75) };
  if (SIMULADO) { const r = { id: `simulado_${Date.now()}_${nome}`, filename: `simulado_${nome}` }; registra(loja, tipo, alvo, pedido, 200, true, r); return r; }
  let status = 0, resposta = null, ok = false;
  try {
    const fd = new FormData(); fd.append('file', new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: mime || 'application/octet-stream' }), nome);
    const res = await fetch(API + caminho, { method: 'POST', headers: { Authorization: `Bearer ${await tokenDe(id)}` }, body: fd, signal: AbortSignal.timeout(60000) });
    status = res.status; const tx = await res.text(); try { resposta = JSON.parse(tx); } catch { resposta = { message: tx }; } ok = res.ok;
  } catch (e) { resposta = { message: e.message }; }
  registra(loja, tipo, alvo, pedido, status, ok, resposta);
  if (!ok) throw Object.assign(erro(status ? traduz(status, resposta) : `Não foi possível enviar o anexo: ${resposta.message}`, 502), { ml: resposta });
  return resposta;
}

// rotas assíncronas (o H do index.js é síncrono)
export const HA = fn => async (req, res) => { try { res.json(await fn(req.query, req)); } catch (e) { if (!e.status) console.error(e); res.status(e.status || 500).json({ erro: e.message }); } };

export function registrarAcoes(app) {
  // contas que podem agir (as que têm token de escrita) e se está em modo simulado
  app.get('/api/acoes/contas', HA(() => ({ simulado: SIMULADO, contas: contas().map(c => ({ loja: c.loja, nickname: c.nickname || null })) })));
  // histórico das ações feitas pelo sistema, mais recentes primeiro
  app.get('/api/acoes/historico', HA(q => db.prepare('SELECT id, quando, loja, tipo, alvo, pedido, status, ok, resposta FROM acoes_log ORDER BY id DESC LIMIT ?')
    .all(Math.min(Math.max(parseInt(q.limite) || 200, 1), 2000)).map(r => ({ ...r, ok: !!r.ok, pedido: JSON.parse(r.pedido || 'null'), resposta: (() => { try { return JSON.parse(r.resposta); } catch { return r.resposta; } })() }))));
}
