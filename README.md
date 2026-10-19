# Dashboard Module / 仪表盘组件库

> A private collection of independent desktop widgets and applications for the Dashboard Manager workspace.  
> 用于 Dashboard Manager 工作区的私有组件与桌面应用集合。每个组件独立放在自己的目录中。

## Components / 组件目录

| Component / 组件 | Description / 简介 | Documentation / 文档 |
| --- | --- | --- |
| [Memo](#memo) | Local-first Windows desktop memo with event queues, reminders, analytics, and a transparent always-on-top window. / 本地优先的 Windows 桌面备忘录，含事件队列、提醒、数据概览和透明置顶窗口。 | [Open Memo README / 打开 Memo 说明](memo/README.md) |

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

**English:** Add each new widget or app in its own top-level folder. Include a bilingual `README.md` with its purpose, setup steps, controls, storage behavior, and any integrations. Then add a row and an anchored section to this catalog.

**中文：** 每个新小组件或应用都放在独立的一级目录中，并提供双语 `README.md`，说明用途、安装步骤、操作方式、数据保存与外部集成。随后在本目录页中添加一行索引和一个可跳转的锚点介绍区块。
