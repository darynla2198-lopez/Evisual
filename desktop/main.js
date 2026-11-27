// Evisual para Windows: ventana de la app, apertura de PDFs con doble clic,
// guardado en disco y actualizaciones automáticas desde GitHub Releases.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let win = null;
let rendererReady = false;
const pending = [];

const pdfArgs = argv => argv.slice(1).filter(a => /\.pdf$/i.test(a) && fs.existsSync(a));

function sendFile(p) {
  try {
    win.webContents.send('open-file', { path: p, name: path.basename(p), data: fs.readFileSync(p) });
  } catch (e) {
    dialog.showErrorBox('Evisual', 'No se pudo abrir ' + p + '\n' + e.message);
  }
}
const queueFile = p => (rendererReady ? sendFile(p) : pending.push(p));
const sendUpdate = u => win && win.webContents.send('update', u);

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#f6f7f9', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, '..', 'icons', 'icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true,
      additionalArguments: ['--evisual-version=' + app.getVersion()]
    }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
  // La página pide confirmación si hay cambios sin guardar.
  win.webContents.on('will-prevent-unload', e => {
    const r = dialog.showMessageBoxSync(win, {
      type: 'question', title: 'Evisual', buttons: ['Salir sin guardar', 'Cancelar'], defaultId: 1, cancelId: 1,
      message: 'Hay documentos con cambios sin guardar.', detail: 'Si sales ahora, esos cambios se perderán.'
    });
    if (r === 0) e.preventDefault();
  });
  win.on('closed', () => { win = null; rendererReady = false; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    pdfArgs(argv).forEach(queueFile);
  });
  app.whenReady().then(() => {
    pending.push(...pdfArgs(process.argv));
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}

ipcMain.on('ready', () => { rendererReady = true; pending.splice(0).forEach(sendFile); });

ipcMain.handle('save-dialog', async (e, name, kind) => {
  const filters = kind === 'png' ? [{ name: 'Imagen PNG', extensions: ['png'] }]
    : kind === 'jpg' ? [{ name: 'Imagen JPG', extensions: ['jpg', 'jpeg'] }]
    : [{ name: 'Documento PDF', extensions: ['pdf'] }];
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('write-file', async (e, p, data) => {
  await fs.promises.writeFile(p, Buffer.from(data));
  return true;
});

// Actualizaciones: se descargan en segundo plano y se instalan al reiniciar.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('update-available', i => sendUpdate({ type: 'available', version: i.version }));
autoUpdater.on('update-not-available', () => sendUpdate({ type: 'none' }));
autoUpdater.on('update-downloaded', i => sendUpdate({ type: 'downloaded', version: i.version }));
autoUpdater.on('error', err => sendUpdate({ type: 'error', message: String(err && err.message || err) }));
ipcMain.handle('check-updates', async () => {
  if (!app.isPackaged) { sendUpdate({ type: 'none' }); return false; }
  try { await autoUpdater.checkForUpdates(); return true; } catch (e) { sendUpdate({ type: 'error', message: e.message }); return false; }
});
ipcMain.on('install-update', () => autoUpdater.quitAndInstall(false, true));
