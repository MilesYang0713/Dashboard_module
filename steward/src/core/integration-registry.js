const fs = require('node:fs');
const path = require('node:path');

const PROTOCOL = 'steward.department/v1';
const VALID_MODES = new Set(['read', 'write', 'external']);
const VALID_APPROVALS = new Set(['none', 'required']);

function isContainedPath(parent, target) {
  const relative = path.relative(parent, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function validateManifest(manifest) {
  const issues = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['清单必须是 JSON 对象。'];
  if (manifest.protocol !== PROTOCOL) issues.push(`协议必须是 ${PROTOCOL}。`);
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(manifest.id || '')) issues.push('部门 id 必须是小写字母开头的短横线标识。');
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) issues.push('部门必须提供名称。');
  if (!manifest.transport || manifest.transport.type !== 'windows-named-pipe' || typeof manifest.transport.endpoint !== 'string' || !manifest.transport.endpoint.startsWith('\\\\.\\pipe\\')) {
    issues.push('目前仅支持 Windows 本地命名管道 transport.endpoint。');
  }
  if (!Array.isArray(manifest.actions) || !manifest.actions.length) {
    issues.push('部门至少需要声明一个动作。');
  } else {
    const actionIds = new Set();
    for (const action of manifest.actions) {
      if (!action || !/^[a-z][a-z0-9-]{1,62}$/.test(action.id || '')) issues.push('每个动作都需要有效 id。');
      if (actionIds.has(action?.id)) issues.push(`动作重复：${action.id}`);
      actionIds.add(action?.id);
      if (!VALID_MODES.has(action?.mode)) issues.push(`动作 ${action?.id || '未知'} 缺少有效 mode。`);
      if (!VALID_APPROVALS.has(action?.approval)) issues.push(`动作 ${action?.id || '未知'} 缺少有效 approval。`);
      if (!action.input || typeof action.input !== 'object' || Array.isArray(action.input)) issues.push(`动作 ${action?.id || '未知'} 必须声明 input。`);
      if (!action.output || typeof action.output !== 'object' || Array.isArray(action.output)) issues.push(`动作 ${action?.id || '未知'} 必须声明 output。`);
    }
  }
  return issues;
}

function loadIntegrations({ registryPath, dashboardRoot }) {
  const issues = [];
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    return { integrations: [], issues: [`无法读取总管登记册：${error.message}`] };
  }
  if (registry?.version !== 1 || !Array.isArray(registry.integrations)) {
    return { integrations: [], issues: ['总管登记册格式无效。'] };
  }

  const integrations = [];
  const ids = new Set();
  for (const entry of registry.integrations) {
    if (!entry?.enabled) continue;
    if (typeof entry.id !== 'string' || ids.has(entry.id)) {
      issues.push('登记册包含重复或无效的部门 id。');
      continue;
    }
    ids.add(entry.id);
    const manifestPath = path.resolve(path.dirname(registryPath), entry.manifest || '');
    if (!isContainedPath(dashboardRoot, manifestPath)) {
      issues.push(`部门 ${entry.id} 的清单路径超出工作区，已拒绝。`);
      continue;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const manifestIssues = validateManifest(manifest);
      if (manifestIssues.length) {
        issues.push(`部门 ${entry.id} 清单无效：${manifestIssues.join(' ')}`);
        continue;
      }
      if (manifest.id !== entry.id) {
        issues.push(`登记 id ${entry.id} 与清单 id ${manifest.id} 不一致。`);
        continue;
      }
      const allowed = new Set(entry.approvedActions || []);
      const actions = manifest.actions.filter((action) => allowed.has(action.id));
      if (!actions.length) {
        issues.push(`部门 ${entry.id} 没有获批动作。`);
        continue;
      }
      integrations.push({ ...manifest, actions, manifestPath });
    } catch (error) {
      issues.push(`无法加载部门 ${entry.id}：${error.message}`);
    }
  }
  return { integrations, issues };
}

function actionFor(integration, actionId) {
  return integration?.actions.find((action) => action.id === actionId) || null;
}

module.exports = { PROTOCOL, validateManifest, loadIntegrations, actionFor };
