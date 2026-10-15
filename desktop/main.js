// App desktop (Electron): ao abrir, sobe o servidor DENTRO do app e mostra o painel numa janela própria.
//  - servidor só em 127.0.0.1, numa porta sorteada a cada abertura;
//  - chave secreta por sessão (cookie da janela): sem ela a API responde 403 (outros programas e sites não acessam);
//  - dados do usuário (.env, banco, backups) na pasta do usuário no sistema, fora da pasta do programa.
import { app, BrowserWindow, Menu, dialog, session, shell } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { iniciarAtualizacoes, verificar } from './atualizacao.js';

if (!app.requestSingleInstanceLock()) app.quit(); // uma janela só: o banco não pode ter dois servidores

const DADOS = app.getPath('userData'); // Windows: %APPDATA%\Nexus
// O app se chamava "ML Dashboard": quem já tinha dados nessa pasta continua com eles (a pasta é renomeada uma única vez).
try { // (o Electron já pode ter criado a pasta nova, então move item a item o que ainda não existe nela)
  const antiga = path.join(app.getPath('appData'), 'ML Dashboard');
  if (fs.existsSync(antiga)) {
    fs.mkdirSync(DADOS, { recursive: true });
    for (const n of fs.readdirSync(antiga)) if (!fs.existsSync(path.join(DADOS, n))) fs.renameSync(path.join(antiga, n), path.join(DADOS, n));
    try { fs.rmdirSync(antiga); } catch { /* sobrou algo (ex.: cache): deixa */ }
  }
} catch { /* sem permissão: segue com a pasta nova */ }

// Registro em %APPDATA%\Nexus\app.log (o app não tem console visível). Tokens e códigos são mascarados.
const LOG = path.join(DADOS, 'app.log');
try { fs.mkdirSync(DADOS, { recursive: true }); if (fs.statSync(LOG).size > 2e6) fs.renameSync(LOG, LOG + '.1'); } catch { /* ainda não existe */ }
const mascara = s => s.replace(/\b(APP_USR|TG)-[\w-]+/g, '$1-***').replace(/("?(?:access_token|refresh_token|code|code_verifier|client_secret)"?\s*[:=]\s*"?)[^"&\s,}]+/gi, '$1***');
for (const nivel of ['log', 'warn', 'error']) {
  const orig = console[nivel].bind(console);
  console[nivel] = (...a) => {
    orig(...a);
    const txt = a.map(x => (x instanceof Error ? x.stack : typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    try { fs.appendFileSync(LOG, `${new Date().toISOString()} [${nivel}] ${mascara(txt)}\n`); } catch { /* disco cheio etc. */ }
  };
}
process.on('uncaughtException', e => console.error('[app] erro não tratado:', e));
process.on('unhandledRejection', e => console.error('[app] promessa rejeitada:', e));
console.log(`[app] iniciando versão ${app.getVersion()} (Electron ${process.versions.electron})`);

Object.assign(process.env, {
  ML_DASH_DATA: DADOS,
  ML_DASH_CHAVE: crypto.randomBytes(32).toString('hex'),
  HOST: '127.0.0.1',
  PORT: '0',
});

let janela = null;
app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
app.on('window-all-closed', () => app.quit());

function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Arquivo', submenu: [
      { label: 'Abrir pasta de dados (.env, banco, backups)', click: () => shell.openPath(DADOS) },
      { label: 'Abrir registro de erros (app.log)', click: () => shell.openPath(LOG) },
      { type: 'separator' },
      { label: `Verificar atualizações (versão ${app.getVersion()})`, click: () => verificar(true) },
      { type: 'separator' },
      { role: 'quit', label: 'Sair' },
    ] },
    { label: 'Exibir', submenu: [
      { role: 'reload', label: 'Recarregar' },
      { role: 'zoomIn', label: 'Aumentar' }, { role: 'zoomOut', label: 'Diminuir' }, { role: 'resetZoom', label: 'Tamanho normal' },
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' },
    ] },
  ]));
}

app.whenReady().then(async () => {
  try {
    // Contas: conectadas pela tela Contas (login oficial). O .env na pasta de dados é opcional (modo avançado).
    const { pronto } = await import('../server/index.js');
    const porta = await pronto;
    const url = `http://127.0.0.1:${porta}/`;
    await session.defaultSession.cookies.set({ url, name: 'mldash', value: process.env.ML_DASH_CHAVE, httpOnly: true, sameSite: 'strict' });

    menu();
    janela = new BrowserWindow({
      width: 1440, height: 900, show: false, title: 'Nexus', icon: path.join(import.meta.dirname, '..', 'build', 'icon.png'), autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    // Links externos (página do pedido no ML etc.) abrem no navegador padrão; a janela nunca sai do painel.
    const externo = u => { if (/^https:\/\//i.test(u)) shell.openExternal(u); };
    janela.webContents.setWindowOpenHandler(({ url: u }) => { externo(u); return { action: 'deny' }; });
    janela.webContents.on('will-navigate', (e, u) => { if (!u.startsWith(url)) { e.preventDefault(); externo(u); } });
    janela.once('ready-to-show', () => janela.show());
    await janela.loadURL(url);
    iniciarAtualizacoes(() => janela);
  } catch (e) {
    dialog.showErrorBox('Nexus não iniciou', String(e?.stack || e));
    app.quit();
  }
});
