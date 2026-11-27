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
    : kind === 'zip' ? [{ name: 'Archivo ZIP', extensions: ['zip'] }]
    : [{ name: 'Documento PDF', extensions: ['pdf'] }];
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('read-asset', async (e, rel) => {
  if (!/^fonts\/[\w-]+\.ttf$/.test(rel)) throw new Error('Archivo no permitido');
  return fs.promises.readFile(path.join(__dirname, '..', rel));
});
ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Elegir carpeta para guardar las imágenes', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
});
ipcMain.handle('write-file', async (e, p, data) => {
  await fs.promises.writeFile(p, Buffer.from(data));
  return true;
});

// Actualizaciones automáticas, sin asistente:
// - busca al abrir y cada 3 horas (si el usuario no lo desactivó en Novedades),
// - descarga en segundo plano solo la parte que cambió (blockmap),
// - se instala en silencio al cerrar Evisual, o al pulsar "Reiniciar ahora".
let autoCheck = true, lastUpdate = null, checking = false;

// Preferencias de la app de escritorio (por ahora, solo el canal de actualizaciones).
const settingsFile = () => path.join(app.getPath('userData'), 'evisual-settings.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) || {}; } catch (e) { return {}; }
}
function writeSettings(s) {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2)); } catch (e) { /* sin permisos: se usa el valor en memoria */ }
}
// Canal Beta: con la opción activa también se reciben las versiones marcadas como
// "pre-release" en GitHub (por ejemplo 1.0.7-beta.1). Sin ella, solo las estables.
// Se aplica aquí, antes de cualquier checkNow().
let beta = readSettings().beta === true;
autoUpdater.allowPrerelease = beta;
autoUpdater.allowDowngrade = false;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('update-available', i => sendUpdate(lastUpdate = { type: 'available', version: i.version }));
autoUpdater.on('update-not-available', () => sendUpdate({ type: 'none' }));
autoUpdater.on('update-downloaded', i => sendUpdate(lastUpdate = { type: 'downloaded', version: i.version }));
autoUpdater.on('error', err => sendUpdate({ type: 'error', message: String(err && err.message || err) }));
// Versión portable: no hay instalación que actualizar, así que Evisual
// descarga el .exe portable nuevo en segundo plano y, al cerrar, un pequeño
// script espera a que el .exe actual se libere, lo reemplaza y (si se pidió) lo abre.
const PORTABLE = !!process.env.PORTABLE_EXECUTABLE_DIR;
const PORT_FILE = process.env.PORTABLE_EXECUTABLE_FILE || '';
let portNew = null;
const vnum = v => String(v || '0').replace(/^v/, '').split('.').map(Number).reduce((a, n) => a * 1000 + (n || 0), 0);
async function checkPortable() {
  const { net } = require('electron');
  const r = await net.fetch('https://api.github.com/repos/darynla2198-lopez/Evisual/releases/latest', { headers: { 'User-Agent': 'Evisual', Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const j = await r.json(), v = String(j.tag_name || '').replace(/^v/, '');
  if (vnum(v) <= vnum(app.getVersion())) { sendUpdate({ type: 'none' }); return; }
  const a = (j.assets || []).find(x => /Portable.*\.exe$/i.test(x.name));
  const link = a ? a.browser_download_url : j.html_url;
  let canWrite = !!PORT_FILE;
  try { fs.accessSync(path.dirname(PORT_FILE), fs.constants.W_OK); fs.accessSync(PORT_FILE, fs.constants.W_OK); } catch (e) { canWrite = false; }
  if (!a || !canWrite) { sendUpdate(lastUpdate = { type: 'portable', version: v, url: link }); return; }
  sendUpdate({ type: 'available', version: v });
  try {
    const d = await net.fetch(a.browser_download_url, { headers: { 'User-Agent': 'Evisual' } });
    if (!d.ok) throw new Error('descarga ' + d.status);
    const buf = Buffer.from(await d.arrayBuffer());
    if (a.size && buf.length !== a.size) throw new Error('descarga incompleta');
    if (a.digest && /^sha256:/.test(a.digest)) {
      const h = require('crypto').createHash('sha256').update(buf).digest('hex');
      if ('sha256:' + h !== a.digest) throw new Error('el archivo descargado no coincide');
    }
    const out = path.join(app.getPath('temp'), 'Evisual-Portable-' + v + '.exe');
    fs.writeFileSync(out, buf);
    portNew = { file: out, version: v };
    sendUpdate(lastUpdate = { type: 'downloaded', version: v });
  } catch (e) { sendUpdate(lastUpdate = { type: 'portable', version: v, url: link }); }
}
function applyPortable(relaunch) {
  if (!portNew || !PORT_FILE) return false;
  const bat = path.join(app.getPath('temp'), 'evisual-actualizar.cmd');
  fs.writeFileSync(bat, [
    '@echo off', 'set n=0', ':loop',
    `move /y "${portNew.file}" "${PORT_FILE}" >nul 2>&1 && goto ok`,
    'set /a n+=1', 'if %n% geq 90 goto end', 'ping -n 2 127.0.0.1 >nul', 'goto loop',
    ':ok', relaunch ? `start "" "${PORT_FILE}"` : 'rem', ':end', '(goto) 2>nul & del "%~f0"'
  ].join('\r\n'));
  require('child_process').spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  portNew = null;
  return true;
}
app.on('will-quit', () => { if (PORTABLE) applyPortable(false); });
async function checkNow() {
  if (!app.isPackaged) { sendUpdate({ type: 'none' }); return false; }
  if (PORTABLE) {
    try { await checkPortable(); return true; }
    catch (e) { sendUpdate({ type: 'error', message: e.message }); return false; }
  }
  if (lastUpdate && lastUpdate.type === 'downloaded') { sendUpdate(lastUpdate); return true; }
  if (checking) return true;
  checking = true;
  try { await autoUpdater.checkForUpdates(); return true; }
  catch (e) { sendUpdate({ type: 'error', message: e.message }); return false; }
  finally { checking = false; }
}
ipcMain.handle('check-updates', () => checkNow());
// La versión portable solo recibe estables (consulta releases/latest), así que ahí no se ofrece Beta.
ipcMain.handle('get-beta', () => (PORTABLE ? null : beta));
ipcMain.handle('set-beta', (e, on) => {
  beta = on === true;
  autoUpdater.allowPrerelease = beta;
  writeSettings({ ...readSettings(), beta });
  return beta;
});
ipcMain.on('set-auto-update', (e, on) => { autoCheck = !!on; });
ipcMain.on('ready', () => {
  if (lastUpdate) sendUpdate(lastUpdate);
  setTimeout(() => { if (autoCheck) checkNow(); }, 8000);
});
setInterval(() => { if (autoCheck) checkNow(); }, 3 * 60 * 60 * 1000);
ipcMain.on('install-update', () => {
  if (PORTABLE) { if (applyPortable(true)) app.exit(0); return; }
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
});
