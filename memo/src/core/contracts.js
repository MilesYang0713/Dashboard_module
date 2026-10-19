/**
 * Department contract shared by the steward and every future department.
 * A department exposes a manifest and actions. It receives only the task
 * payload the steward has approved and returns a structured result.
 */
function assertDepartment(adapter) {
  const { manifest, execute } = adapter || {};
  if (!manifest || typeof manifest.id !== 'string' || !Array.isArray(manifest.actions)) {
    throw new Error('部门必须提供含 id 和 actions 的 manifest。');
  }
  if (typeof execute !== 'function') {
    throw new Error(`部门 ${manifest.id} 缺少 execute(action, payload) 方法。`);
  }
}

class DepartmentRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    assertDepartment(adapter);
    if (this.adapters.has(adapter.manifest.id)) {
      throw new Error(`重复的部门标识：${adapter.manifest.id}`);
    }
    this.adapters.set(adapter.manifest.id, adapter);
  }

  list() {
    return [...this.adapters.values()].map(({ manifest }) => manifest);
  }

  async execute(departmentId, action, payload) {
    const adapter = this.adapters.get(departmentId);
    if (!adapter) throw new Error(`未找到部门：${departmentId}`);
    if (!adapter.manifest.actions.includes(action)) {
      throw new Error(`部门 ${departmentId} 不支持动作：${action}`);
    }
    const result = await adapter.execute(action, payload);
    if (!result || typeof result.status !== 'string') {
      throw new Error(`部门 ${departmentId} 返回了无效结果。`);
    }
    return result;
  }
}

module.exports = { DepartmentRegistry };
