// Puente seguro entre la ventana de Evisual y Windows.
const { contextBridge, ipcRenderer } = require('electron');
const vArg = (process.argv || []).find(a => a.startsWith('--evisual-version='));

contextBridge.exposeInMainWorld('evisualNative', {
  version: vArg ? vArg.split('=')[1] : null,
  ready: () => ipcRenderer.send('ready'),
  onOpenFile: cb => ipcRenderer.on('open-file', (e, f) => cb(f)),
  onUpdate: cb => ipcRenderer.on('update', (e, u) => cb(u)),
  saveDialog: (name, kind) => ipcRenderer.invoke('save-dialog', name, kind),
  writeFile: (p, data) => ipcRenderer.invoke('write-file', p, data),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  installUpdate: () => ipcRenderer.send('install-update')
});
