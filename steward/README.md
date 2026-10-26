# Steward / 总管

**English:** Steward is the local-first front door for this Dashboard workspace. You type a request or hand it your clipboard, and it routes only to a department that you have explicitly registered and authorized. The first department is Memo: it records a natural-language request as a local event and shows a small event overview.

**中文：** 总管是此 Dashboard 工作区的本地优先统一入口。你只需输入一句话，或把剪贴板交给它；它只会路由到你明确登记并授权过的部门。第一个部门是 Memo：它把自然语言请求记录为本地事件，并显示简要概览。

## Run / 运行

Install the dependencies in each component once:

```powershell
cd memo
npm install
cd ..\steward
npm install
npm start
```

Use **启动 Memo** once after opening Steward. When the status becomes **Memo 已连接**, type a note and select **交给备忘录**, or select **从剪贴板记录**. `Ctrl + Enter` submits the typed request.

打开 Steward 后，先点一次 **启动 Memo**。状态变为 **Memo 已连接** 后，输入事项并点 **交给备忘录**，或者点 **从剪贴板记录**。`Ctrl + Enter` 可直接提交输入内容。

## Privacy and authority / 隐私与权限

- Communication is a Windows named pipe, not a TCP or web endpoint. The current release has no network requests.
- Memo retains its own local data. Steward receives only the summary or limited overview needed for its screen.
- Steward's own Electron runtime files stay in its ignored `steward/data/` folder beside the component, not in the Windows roaming profile.
- A department is not trusted merely because a folder or plugin exists. It must be registered in `department-registry.json`, enabled, and limited to named `approvedActions`.
- An action marked `approval: "required"` is blocked until a future confirmation UI explicitly approves it. The initial Memo actions (`capture`, `list`) are local and pre-approved.

- 通信走 Windows 本地命名管道，不开放 TCP 或网页端口；当前版本不发起任何网络请求。
- Memo 保有自己的本地数据；总管只接收界面所需的摘要或受限概览。
- 总管自身的 Electron 运行文件保存于组件旁、已忽略的 `steward/data/`，不写入 Windows 漫游配置目录。
- 文件夹或插件存在并不代表获得信任。必须在 `department-registry.json` 中登记、启用，并限制到指定的 `approvedActions`。
- 标为 `approval: "required"` 的动作会被拦截，直到未来的确认界面明确批准。首批 Memo 动作（`capture`、`list`）均是已预先批准的本地操作。

## Open department contract / 开放部门合同

An integration contributes a `steward.department.json` manifest and a local JSON-lines named-pipe adapter. The manifest declares the identity, actions, input/output shapes, action mode, confirmation rule, privacy scope, and pipe endpoint. The steward request and response envelope is:

```json
{ "id": "request-id", "protocol": "steward.department/v1", "method": "execute", "params": { "action": "capture", "payload": { "text": "..." } } }
```

```json
{ "id": "request-id", "ok": true, "result": { "status": "completed", "summary": "..." } }
```

To add a future component, create its manifest and adapter, then add a narrow entry to `department-registry.json`. Review the declared permissions and approve only the actions you want the steward to invoke. See Memo's [`steward.department.json`](../memo/steward.department.json) as the reference implementation.

如需添加未来组件，请创建它的清单与适配器，再向 `department-registry.json` 添加范围最小的登记项。审核它声明的权限，只批准你希望总管调用的动作。Memo 的 [`steward.department.json`](../memo/steward.department.json) 可作为参考实现。
