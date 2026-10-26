const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stewardHub', {
  bootstrap: () => ipcRenderer.invoke('bootstrap'),
  overview: () => ipcRenderer.invoke('memo-overview'),
  captureMemo: (text) => ipcRenderer.invoke('capture-memo', text),
  captureClipboard: () => ipcRenderer.invoke('capture-clipboard'),
  launch: (id) => ipcRenderer.invoke('launch-department', id)
});
