const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('steward', {
  bootstrap: () => ipcRenderer.invoke('bootstrap'),
  captureEvent: (payload) => ipcRenderer.invoke('capture-event', payload),
  updateEvent: (id, patch) => ipcRenderer.invoke('update-event', id, patch),
  deleteEvent: (id) => ipcRenderer.invoke('delete-event', id),
  restoreEvent: (id) => ipcRenderer.invoke('restore-event', id),
  purgeEvent: (id) => ipcRenderer.invoke('purge-event', id),
  setContentOpacity: (value) => ipcRenderer.invoke('set-content-opacity', value),
  setBackgroundOpacity: (value) => ipcRenderer.invoke('set-background-opacity', value),
  setThemeColor: (color) => ipcRenderer.invoke('set-theme-color', color),
  setCategories: (categories) => ipcRenderer.invoke('set-categories', categories),
  setAdaptiveContrast: (enabled) => ipcRenderer.invoke('set-adaptive-contrast', enabled),
  setCompletedVisibility: (visibility) => ipcRenderer.invoke('set-completed-visibility', visibility),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('set-launch-at-login', enabled),
  createDesktopShortcut: () => ipcRenderer.invoke('create-desktop-shortcut'),
  chooseStorageDirectory: () => ipcRenderer.invoke('choose-storage-directory'),
  toggleTopmost: () => ipcRenderer.invoke('toggle-topmost'),
  toggleWindowLock: () => ipcRenderer.invoke('toggle-window-lock'),
  toggleClickThrough: (keepHotspotInteractive = false) => ipcRenderer.invoke('toggle-click-through', keepHotspotInteractive),
  setClickThroughHotspot: (active) => ipcRenderer.invoke('set-click-through-hotspot', active),
  onClickThroughChanged: (callback) => ipcRenderer.on('click-through-changed', (_event, enabled) => callback(enabled)),
  minimizeToOrb: () => ipcRenderer.invoke('minimize-to-orb'),
  restoreFromOrb: () => ipcRenderer.invoke('restore-from-orb'),
  beginOrbDrag: () => ipcRenderer.invoke('begin-orb-drag'),
  moveOrb: () => ipcRenderer.invoke('move-orb'),
  endOrbDrag: () => ipcRenderer.invoke('end-orb-drag'),
  onOrbModeChanged: (callback) => ipcRenderer.on('orb-mode-changed', (_event, enabled) => callback(enabled)),
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('steward-state-changed', listener);
    return () => ipcRenderer.removeListener('steward-state-changed', listener);
  },
  hide: () => ipcRenderer.invoke('hide-window'),
  quit: () => ipcRenderer.invoke('quit-app'),
  exportEvents: (format) => ipcRenderer.invoke('export-events', format),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  resizeWindow: (payload) => ipcRenderer.invoke('resize-window', payload)
});
