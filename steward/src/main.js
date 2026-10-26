const { app, BrowserWindow, clipboard, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { PROTOCOL, loadIntegrations, actionFor } = require('./core/integration-registry');
const { invokeLocal } = require('./core/local-rpc');

let mainWindow;

// Keep Electron runtime files on the same local drive as the steward rather
// than creating a separate Windows roaming-profile data directory.
app.setPath('userData', path.join(app.getAppPath(), 'data', 'runtime'));

function dashboardRoot() {
  return path.resolve(app.getAppPath(), '..');
}

function registeredDepartments() {
  return loadIntegrations({
    registryPath: path.join(app.getAppPath(), 'department-registry.json'),
    dashboardRoot: dashboardRoot()
  });
}

function compactDepartment(integration) {
  return {
    id: integration.id,
    name: integration.name,
    description: integration.description,
    actions: integration.actions.map(({ id, title, mode, approval }) => ({ id, title, mode, approval })),
    privacy: integration.privacy
  };
}

function getDepartment(id) {
  const registered = registeredDepartments();
  const integration = registered.integrations.find((item) => item.id === id);
  if (!integration) throw new Error(`未找到已启用部门：${id}`);
  return integration;
}

async function executeDepartment(id, actionId, payload = {}) {
  const integration = getDepartment(id);
  const action = actionFor(integration, actionId);
  if (!action) throw new Error(`部门 ${integration.name} 未获准执行动作：${actionId}`);
  if (action.approval === 'required') {
    return { status: 'needs_approval', summary: `「${action.title}」需要在总管中确认后才能执行。`, requiresApproval: true };
  }
  return invokeLocal(integration.transport.endpoint, {
    protocol: PROTOCOL,
    method: 'execute',
    params: { action: action.id, payload }
  });
}

function launchDepartment(id) {
  const integration = getDepartment(id);
  if (typeof integration.appPath !== 'string' || !integration.appPath) throw new Error(`${integration.name} 没有可启动的应用路径。`);
  const appPath = path.resolve(dashboardRoot(), integration.appPath);
  const relative = path.relative(dashboardRoot(), appPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('部门启动路径不在工作区内。');
  const child = spawn(process.execPath, [appPath], { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
  return { status: 'launching', summary: `正在启动 ${integration.name}；启动后可刷新状态。` };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 650,
    minWidth: 580,
    minHeight: 500,
    backgroundColor: '#101522',
    title: 'Steward 总管',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('bootstrap', () => {
  const registered = registeredDepartments();
  return { departments: registered.integrations.map(compactDepartment), issues: registered.issues };
});
ipcMain.handle('memo-overview', () => executeDepartment('memo', 'list'));
ipcMain.handle('capture-memo', (_event, text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return { status: 'needs_input', summary: '请先输入或粘贴一件要处理的事。', requiresApproval: false };
  if (normalized.length > 4000) return { status: 'needs_input', summary: '内容过长；请控制在 4,000 个字符以内。', requiresApproval: false };
  return executeDepartment('memo', 'capture', { text: normalized });
});
ipcMain.handle('capture-clipboard', () => executeDepartment('memo', 'capture', { text: clipboard.readText() }));
ipcMain.handle('launch-department', (_event, id) => launchDepartment(id));
