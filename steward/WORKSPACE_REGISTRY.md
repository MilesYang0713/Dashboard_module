# Workspace Registry / 工作区登记册

| Department / 部门 | Purpose / 用途 | Available capabilities / 可用能力 | Implementation / 实现 | Status / 状态 | Known limits / 已知限制 |
| --- | --- | --- | --- | --- | --- |
| Steward / 总管 | Single local entry point that routes an approved request to the correct department. / 本地统一入口，把已批准的请求路由到合适部门。 | Typed or clipboard capture; department discovery from the approved registry; local status display. / 输入或剪贴板收集、从已批准登记册发现部门、显示本地状态。 | `steward/` Electron app | Active / 已启用 | It does not send messages, make purchases, or grant a new integration access by itself. / 不会自行发送消息、消费或授予新集成权限。 |
| Memo & Events / 备忘与事件 | Store and sort personal memo events locally. / 本地保存、排序个人事件。 | `capture`, `list` | `memo/` local named-pipe adapter | Active / 已启用 | The Memo app must be running; its private event data is never exposed to another department. / 需要 Memo 正在运行；私有事件数据不会提供给其他部门。 |

## Registration rule / 登记规则

New software is not automatically trusted just because its folder is present. Register its manifest in `department-registry.json`, choose its allowed actions, then review and enable it. Every integration must declare its actions, input/output, required permissions, and whether an action needs confirmation.

新软件即使位于此仓库中，也不会自动获得信任。必须先在 `department-registry.json` 登记清单、选择允许的动作，再审核并启用。每个集成都必须声明动作、输入/输出、所需权限，以及是否需要确认。
