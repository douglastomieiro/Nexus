// Atualização automática pelo GitHub Releases (electron-updater).
// Ao abrir e a cada 6 h: procura versão nova, baixa em segundo plano (o arquivo é conferido pelo sha512 publicado no latest.yml)
// e pergunta se quer reiniciar. Se a pessoa escolher "Depois", instala ao fechar o app. Os dados (%APPDATA%) não são tocados.
import { app, dialog } from 'electron';
import updater from 'electron-updater';

const { autoUpdater } = updater;
let janelaRef = () => null, manual = false, iniciado = false;

export function iniciarAtualizacoes(janela) {
  janelaRef = janela;
  if (!app.isPackaged || iniciado) return; // rodando pelo código (npm run app): sem atualização
  iniciado = true;
  autoUpdater.logger = { info: m => console.log('[atualização]', m), warn: m => console.warn('[atualização]', m), error: m => console.error('[atualização]', m), debug: () => {} };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = true; // só o instalador completo (não usamos o instalador web)

  autoUpdater.on('update-not-available', () => {
    if (manual) dialog.showMessageBox(janelaRef(), { type: 'info', title: 'Atualizações', message: `Você já está na versão mais recente (${app.getVersion()}).` });
    manual = false;
  });
  autoUpdater.on('error', e => {
    console.error('[atualização] falhou:', e?.message || e);
    if (manual) dialog.showMessageBox(janelaRef(), { type: 'warning', title: 'Atualizações', message: 'Não foi possível verificar atualizações agora.', detail: 'Confira a internet e tente de novo mais tarde.' });
    manual = false;
  });
  autoUpdater.on('update-downloaded', async info => {
    manual = false;
    const { response } = await dialog.showMessageBox(janelaRef(), {
      type: 'info', buttons: ['Reiniciar agora', 'Depois'], defaultId: 0, cancelId: 1, title: 'Atualização pronta',
      message: `A versão ${info.version} do Nexus foi baixada.`,
      detail: 'Reinicie para instalar. Se escolher "Depois", ela será instalada quando você fechar o app. Suas contas e dados continuam.',
    });
    if (response === 0) autoUpdater.quitAndInstall(true, true); // instalação silenciosa e reabre o app
  });

  verificar();
  setInterval(verificar, 6 * 3600e3);
}

export function verificar(pedidoPeloUsuario = false) {
  if (!app.isPackaged) {
    if (pedidoPeloUsuario) dialog.showMessageBox(janelaRef(), { type: 'info', title: 'Atualizações', message: 'Atualização automática só funciona no app instalado.' });
    return;
  }
  manual = pedidoPeloUsuario;
  autoUpdater.checkForUpdates().catch(() => { /* já registrado no evento 'error' */ });
}
