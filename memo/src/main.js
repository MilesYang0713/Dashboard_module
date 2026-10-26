const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { DepartmentRegistry } = require('./core/contracts');
const memoEvents = require('./departments/memo-events');
const { createLocalBridge } = require('./transport/local-bridge');
const stewardManifest = require('../steward.department.json');

// Keep Memo's private data and Electron profile beside the official component,
// rather than in the Windows roaming profile.
const memoDataDirectory = path.join(app.getAppPath(), 'data');
app.setPath('userData', path.join(memoDataDirectory, 'runtime'));

const registry = new DepartmentRegistry();
registry.register(memoEvents);

let mainWindow;
let statePath;
let storageConfigPath;
let clickThroughEnabled = false;
let clickThroughPassthrough = false;
let stateWriteQueue = Promise.resolve();
let stewardBridge;
const defaultState = { events: [], deletedEvents: [], settings: { contentOpacity: 0.92, backgroundOpacity: 0.94, themeColor: '#8f82ff', adaptiveContrast: true, completedVisibility: 'immediate', alwaysOnTop: true, windowLocked: true } };

// Keep one Memo window for this user-data profile. Starting the desktop or
// startup shortcut again simply returns focus to the existing Memo window,
// avoiding competing in-memory views of the same event file.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

async function configureStoragePath() {
  const defaultPath = path.join(memoDataDirectory, 'steward-memo.json');
  storageConfigPath = path.join(memoDataDirectory, 'memo-storage.json');
  try {
    const config = JSON.parse(await fs.readFile(storageConfigPath, 'utf8'));
    statePath = typeof config.statePath === 'string' && path.isAbsolute(config.statePath) ? config.statePath : defaultPath;
  } catch {
    statePath = defaultPath;
  }
}

async function saveStorageConfig() {
  await fs.mkdir(path.dirname(storageConfigPath), { recursive: true });
  await fs.writeFile(storageConfigPath, JSON.stringify({ statePath }, null, 2), 'utf8');
}

function startupShortcutPath() {
  return path.join(app.getPath('startup'), 'Memo.lnk');
}

function memoShortcutDetails() {
  return {
    target: process.execPath,
    args: app.isPackaged ? '' : `"${app.getAppPath()}"`,
    workingDirectory: app.getAppPath(),
    description: 'Memo 桌面备忘录'
  };
}

async function launchAtLoginEnabled() {
  try {
    await fs.access(startupShortcutPath());
    return true;
  } catch {
    return false;
  }
}

async function setLaunchAtLogin(enabled) {
  const shortcut = startupShortcutPath();
  if (enabled) {
    await fs.mkdir(path.dirname(shortcut), { recursive: true });
    if (!shell.writeShortcutLink(shortcut, 'create', memoShortcutDetails())) throw new Error('无法创建开机启动快捷方式');
  } else {
    try { await fs.unlink(shortcut); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return launchAtLoginEnabled();
}

async function storageDetails() {
  return { path: statePath, launchAtLogin: await launchAtLoginEnabled() };
}

async function loadState() {
  try {
    const saved = JSON.parse(await fs.readFile(statePath, 'utf8'));
    const state = { ...defaultState, ...saved, settings: { ...defaultState.settings, ...saved.settings } };
    // Preserve the opacity setting saved by earlier versions as content opacity.
    if (saved.settings?.opacity != null && saved.settings?.contentOpacity == null) state.settings.contentOpacity = saved.settings.opacity;
    // Earlier versions used one setting for both topmost and window lock.
    if (saved.settings?.windowLocked == null) state.settings.windowLocked = saved.settings?.alwaysOnTop ?? true;
    state.deletedEvents = state.deletedEvents || [];
    state.events = (state.events || []).map((item) => ({
      ...item,
      category: item.category || 'task',
      completedAt: item.completedAt || null,
      updatedAt: item.updatedAt || item.completedAt || item.createdAt || new Date().toISOString(),
      history: item.history || [{ type: 'created', at: item.createdAt || new Date().toISOString() }]
    }));
    return state;
  } catch {
    return structuredClone(defaultState);
  }
}

async function saveState(state) {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
}

function mutateState(mutator) {
  const operation = stateWriteQueue.then(async () => {
    const state = await loadState();
    const result = await mutator(state);
    await saveState(state);
    mainWindow?.webContents.send('steward-state-changed', state);
    return result;
  });
  // Keep later writes available even if one write fails.
  stateWriteQueue = operation.catch(() => undefined);
  return operation;
}

async function captureMemoEvent(payload) {
  const result = await registry.execute('memo-events', 'capture', { ...payload, nowISO: new Date().toISOString() });
  if (result.status !== 'completed') return result;
  return mutateState((state) => {
    state.events = sortEvents([result.event, ...state.events]);
    return { ...result, state };
  });
}

async function stewardOverview() {
  const state = await loadState();
  return {
    status: 'completed',
    events: sortEvents(state.events).slice(0, 12).map(({ id, title, dueAt, dueDate, startAt, startDate, category, priority, completed }) => ({ id, title, dueAt, dueDate, startAt, startDate, category, priority, completed }))
  };
}

async function handleStewardRequest(request) {
  if (!request || request.protocol !== 'steward.department/v1') throw new Error('不支持的总管协议版本。');
  if (request.method === 'manifest') return { manifest: stewardManifest };
  if (request.method !== 'execute') throw new Error('不支持的本地桥接方法。');
  const action = request.params?.action;
  if (action === 'capture') return captureMemoEvent(request.params?.payload || {});
  if (action === 'list') return stewardOverview();
  throw new Error(`Memo 不支持动作：${action || '未指定'}`);
}

function sortEvents(events) {
  const now = Date.now();
  const priority = { high: 0, medium: 1, normal: 2 };
  return [...events].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const eventTime = (item) => item.dueAt ? new Date(item.dueAt).getTime() : item.dueDate ? new Date(`${item.dueDate}T23:59:59.999`).getTime() : item.startAt ? new Date(item.startAt).getTime() : item.startDate ? new Date(`${item.startDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
    const aDue = eventTime(a);
    const bDue = eventTime(b);
    const aBucket = aDue < now ? 0 : aDue === Number.POSITIVE_INFINITY ? 2 : 1;
    const bBucket = bDue < now ? 0 : bDue === Number.POSITIVE_INFINITY ? 2 : 1;
    return aBucket - bBucket || aDue - bDue || priority[a.priority] - priority[b.priority];
  });
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: 400,
    height: 510,
    x: workArea.x + workArea.width - 424,
    y: workArea.y + 24,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 220,
    minHeight: 160,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setMovable(false);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', (event) => { if (!app.isQuiting) { event.preventDefault(); mainWindow.hide(); } });
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else { mainWindow.show(); mainWindow.focus(); }
}

function applyClickThrough() {
  mainWindow?.setIgnoreMouseEvents(clickThroughEnabled && clickThroughPassthrough, { forward: true });
}

function setClickThrough(enabled, keepHotspotInteractive = false) {
  clickThroughEnabled = Boolean(enabled);
  clickThroughPassthrough = clickThroughEnabled && !keepHotspotInteractive;
  applyClickThrough();
  mainWindow?.webContents.send('click-through-changed', clickThroughEnabled);
  return clickThroughEnabled;
}

function toggleClickThrough() {
  return setClickThrough(!clickThroughEnabled);
}

async function applySavedWindowSettings() {
  const state = await loadState();
  mainWindow?.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
  mainWindow?.setMovable(!state.settings.windowLocked);
  mainWindow?.setResizable(!state.settings.windowLocked);
}

app.whenReady().then(async () => {
  await configureStoragePath();
  stewardBridge = createLocalBridge({ pipeName: stewardManifest.transport.endpoint, handleRequest: handleStewardRequest });
  await stewardBridge.start();
  createWindow();
  await applySavedWindowSettings();
  globalShortcut.register('CommandOrControl+Alt+M', toggleWindow);
  globalShortcut.register('CommandOrControl+Alt+L', toggleClickThrough);
  app.on('activate', () => { if (!mainWindow) createWindow(); else mainWindow.show(); });
});

app.on('window-all-closed', (event) => event.preventDefault());
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stewardBridge?.stop().catch(() => undefined);
});

ipcMain.handle('bootstrap', async () => ({ state: await loadState(), departments: registry.list(), storage: await storageDetails() }));
ipcMain.handle('set-launch-at-login', async (_event, enabled) => ({ launchAtLogin: await setLaunchAtLogin(Boolean(enabled)) }));
ipcMain.handle('create-desktop-shortcut', async () => {
  const shortcut = path.join(app.getPath('desktop'), 'Memo.lnk');
  if (!shell.writeShortcutLink(shortcut, 'create', memoShortcutDetails())) throw new Error('无法创建桌面快捷方式');
  return { path: shortcut };
});
ipcMain.handle('choose-storage-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: '选择备忘录数据保存位置', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const targetPath = path.join(result.filePaths[0], 'steward-memo.json');
  if (path.resolve(targetPath) === path.resolve(statePath)) return { canceled: false, unchanged: true, state: await loadState(), storage: await storageDetails() };
  try {
    await fs.access(targetPath);
    return { canceled: true, error: '所选文件夹已含有 steward-memo.json；为防止覆盖，未更改保存位置。' };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await stateWriteQueue;
  const currentState = await loadState();
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(currentState, null, 2), 'utf8');
  statePath = targetPath;
  await saveStorageConfig();
  return { canceled: false, state: currentState, storage: await storageDetails() };
});
ipcMain.handle('capture-event', async (_event, payload) => {
  return captureMemoEvent(payload);
});
ipcMain.handle('update-event', async (_event, id, patch) => {
  return mutateState((state) => {
    const now = new Date().toISOString();
    state.events = sortEvents(state.events.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, ...patch, updatedAt: now };
      if (typeof patch.completed === 'boolean' && patch.completed !== item.completed) {
        updated.completedAt = patch.completed ? now : null;
        updated.history = [...(item.history || []), { type: patch.completed ? 'completed' : 'reopened', at: now }];
      }
      return updated;
    }));
    return state;
  });
});
ipcMain.handle('delete-event', async (_event, id) => {
  return mutateState((state) => {
    const event = state.events.find((item) => item.id === id);
    if (!event) return state;
    const deletedAt = new Date().toISOString();
    state.deletedEvents = [{ ...event, deletedAt, updatedAt: deletedAt, history: [...(event.history || []), { type: 'deleted', at: deletedAt }] }, ...state.deletedEvents];
    state.events = state.events.filter((item) => item.id !== id);
    return state;
  });
});
ipcMain.handle('restore-event', async (_event, id) => {
  return mutateState((state) => {
    const event = state.deletedEvents.find((item) => item.id === id);
    if (!event) return state;
    const restoredAt = new Date().toISOString();
    const { deletedAt, ...restored } = event;
    state.events = sortEvents([{ ...restored, updatedAt: restoredAt, history: [...(restored.history || []), { type: 'restored', at: restoredAt }] }, ...state.events]);
    state.deletedEvents = state.deletedEvents.filter((item) => item.id !== id);
    return state;
  });
});
ipcMain.handle('purge-event', async (_event, id) => {
  return mutateState((state) => {
    state.deletedEvents = state.deletedEvents.filter((item) => item.id !== id);
    return state;
  });
});
ipcMain.handle('set-content-opacity', async (_event, opacity) => {
  const safeOpacity = Math.min(1, Math.max(0.45, Number(opacity) || 0.92));
  return mutateState((state) => {
    state.settings.contentOpacity = safeOpacity;
    return state;
  });
});
ipcMain.handle('set-background-opacity', async (_event, opacity) => {
  const safeOpacity = Math.min(0.98, Math.max(0, Number(opacity) || 0));
  return mutateState((state) => {
    state.settings.backgroundOpacity = safeOpacity;
    return state;
  });
});
ipcMain.handle('set-theme-color', async (_event, color) => {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : defaultState.settings.themeColor;
  return mutateState((state) => {
    state.settings.themeColor = safeColor;
    return state;
  });
});
ipcMain.handle('set-adaptive-contrast', async (_event, enabled) => mutateState((state) => {
  state.settings.adaptiveContrast = Boolean(enabled);
  return state;
}));
ipcMain.handle('set-completed-visibility', async (_event, visibility) => {
  const safeVisibility = ['immediate', 'today', '24h'].includes(visibility) ? visibility : 'immediate';
  return mutateState((state) => {
    state.settings.completedVisibility = safeVisibility;
    return state;
  });
});
ipcMain.handle('toggle-topmost', async () => {
  const state = await mutateState((current) => {
    current.settings.alwaysOnTop = !current.settings.alwaysOnTop;
    return current;
  });
  mainWindow?.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
  return state;
});
ipcMain.handle('toggle-window-lock', async () => {
  const state = await mutateState((current) => {
    current.settings.windowLocked = !current.settings.windowLocked;
    return current;
  });
  mainWindow?.setMovable(!state.settings.windowLocked);
  mainWindow?.setResizable(!state.settings.windowLocked);
  return state;
});
ipcMain.handle('toggle-click-through', (_event, keepHotspotInteractive = false) => setClickThrough(!clickThroughEnabled, keepHotspotInteractive));
ipcMain.handle('set-click-through-hotspot', (_event, active) => {
  if (!clickThroughEnabled) return false;
  clickThroughPassthrough = !Boolean(active);
  applyClickThrough();
  return true;
});
ipcMain.handle('hide-window', () => mainWindow?.hide());
ipcMain.handle('quit-app', () => { app.isQuiting = true; app.quit(); });
ipcMain.handle('export-events', async (_event, format) => {
  const safeFormat = format === 'csv' ? 'csv' : 'json';
  const state = await loadState();
  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出备忘录数据',
    defaultPath: `memo-events-${stamp}.${safeFormat}`,
    filters: safeFormat === 'csv' ? [{ name: 'CSV', extensions: ['csv'] }] : [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  if (safeFormat === 'json') {
    await fs.writeFile(result.filePath, JSON.stringify({ exportedAt: new Date().toISOString(), events: state.events, deletedEvents: state.deletedEvents }, null, 2), 'utf8');
  } else {
    const headers = ['工作', '类别', '优先级', '状态', '解决方案', '已创建', '已更新', '截止日期', '已删除'];
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const categoryNames = { task: '事情', learning: '学习', shopping: '购物', life: '生活', other: '其他' };
    const priorityNames = { high: '最高', medium: '高', normal: '普通' };
    const formatDate = (value) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '无';
    const rows = [...state.events, ...state.deletedEvents].map((item) => [
      item.title,
      categoryNames[item.category] || '事情',
      priorityNames[item.priority] || '普通',
      item.deletedAt ? '已删除' : item.completed ? '完成' : '待办',
      item.deletedAt ? '已移至回收站' : item.completed ? '完成' : '未解决',
      formatDate(item.createdAt),
      formatDate(item.updatedAt || item.completedAt || item.createdAt),
      formatDate(item.dueAt),
      formatDate(item.deletedAt)
    ].map(quote).join(','));
    await fs.writeFile(result.filePath, [headers.join(','), ...rows].join('\r\n'), 'utf8');
  }
  return { canceled: false, filePath: result.filePath };
});
ipcMain.handle('get-window-bounds', () => ({ ...mainWindow?.getBounds(), locked: mainWindow?.isMovable() === false }));
ipcMain.handle('resize-window', (_event, { edge, startBounds, deltaX, deltaY }) => {
  if (!mainWindow || mainWindow.isMovable() === false) return null;
  const minimum = { width: 220, height: 160 };
  const next = { ...startBounds };
  const left = edge.includes('left');
  const right = edge.includes('right');
  const top = edge.includes('top');
  const bottom = edge.includes('bottom');

  if (left) { next.x = startBounds.x + deltaX; next.width = startBounds.width - deltaX; }
  if (right) next.width = startBounds.width + deltaX;
  if (top) { next.y = startBounds.y + deltaY; next.height = startBounds.height - deltaY; }
  if (bottom) next.height = startBounds.height + deltaY;
  if (next.width < minimum.width) { if (left) next.x = startBounds.x + startBounds.width - minimum.width; next.width = minimum.width; }
  if (next.height < minimum.height) { if (top) next.y = startBounds.y + startBounds.height - minimum.height; next.height = minimum.height; }
  mainWindow.setBounds(next);
  return next;
});
