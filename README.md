# Dashboard Module / 仪表盘组件库

> A private collection of independent desktop widgets and applications for the Dashboard Manager workspace.  
> 用于 Dashboard Manager 工作区的私有组件与桌面应用集合。每个组件独立放在自己的目录中。

## Components / 组件目录

| Component / 组件 | Description / 简介 | Documentation / 文档 |
| --- | --- | --- |
| [Memo](#memo) | Local-first Windows desktop memo with event queues, reminders, analytics, and a transparent always-on-top window. / 本地优先的 Windows 桌面备忘录，含事件队列、提醒、数据概览和透明置顶窗口。 | [Open Memo README / 打开 Memo 说明](memo/README.md) |
| [Memo Tauri](#memo-tauri) | Parallel lightweight Tauri-shell migration of Memo. / Memo 的并行轻量 Tauri 外壳迁移版。 | [Open Tauri migration README / 打开迁移说明](memo-tauri/README.md) |
| [Steward](#steward) | Local-first workspace steward that routes typed or clipboard tasks to explicitly approved departments. / 本地优先的工作区总管，可把输入或剪贴板任务路由到明确授权的部门。 | [Open Steward README / 打开总管说明](steward/README.md) |

---

<a id="memo-tauri"></a>

## Memo Tauri — Migration Preview / 迁移预览版

**English**

Memo Tauri is the parallel lighter desktop shell for Memo. It reuses the existing interface and the same local event schema while Electron remains the stable release during migration.

**中文**

Memo Tauri 是 Memo 的并行轻量桌面外壳。迁移期间，它复用现有界面及同一份本地事件数据结构；Electron 版本仍保持为稳定版。

See [Memo Tauri README / Tauri 迁移说明](memo-tauri/README.md).

详见 [Memo Tauri README / Tauri 迁移说明](memo-tauri/README.md)。

---

<a id="steward"></a>

## Steward — Workspace Steward / 工作区总管

**English**

Steward is the single interaction point for the component workspace. It can receive a typed request or clipboard text, then call an explicitly approved department through a local-only interface. Its first connection is Memo, which records natural-language notes as local events. Future apps and plugins can use the same manifest-and-action contract, while each action stays limited to the permissions you explicitly approve.

**中文**

Steward 是组件工作区的单一交互入口。它可以接收输入内容或剪贴板文本，并通过仅本地的接口调用明确获批的部门。首个接入部门为 Memo：将自然语言事项记录为本地事件。未来应用和插件可复用同一套“清单 + 动作”合同，但每个动作仍仅限于你明确批准的权限范围。

See [Steward README / 总管完整说明](steward/README.md) for launch, privacy, and integration details.

启动、隐私与接入细节请看 [Steward README / 总管完整说明](steward/README.md)。

---

<a id="memo"></a>

## Memo — Desktop Memo / 桌面备忘录

**English**

Memo is a transparent, always-on-top Electron desktop memo. It turns natural-language notes into sortable local events, supports categories, date-only or timed schedules, custom early reminders, event history, a recycle bin, exports, and a compact interaction dock. It can create a desktop shortcut, run at Windows startup, and lets you select the local data-storage folder.

**中文**

Memo 是一个透明、可置顶的 Electron 桌面备忘录。它会把自然语言备忘转换为本地可排序事件，支持类别、仅日期或带时间的日程、自定义提前提醒、事件历史、回收站、导出与紧凑快捷栏。它可以创建桌面图标、随 Windows 开机运行，并允许选择本地数据保存文件夹。

### Quick start / 快速开始

```powershell
cd memo
npm install
npm start
```

For feature details, controls, local data behavior, and architecture, see the [Memo README / Memo 完整说明](memo/README.md).

功能细节、操作方式、本地数据行为和架构说明请查看 [Memo README / Memo 完整说明](memo/README.md)。

---

## Adding a component / 新增组件


