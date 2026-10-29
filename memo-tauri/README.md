# Memo Tauri migration / Memo Tauri 迁移版

This folder is the parallel Tauri desktop-shell migration for Memo. It reuses
the existing renderer in `../memo/src/renderer` and reads the existing local
event file selected by `../memo/data/memo-storage.json`. It never copies or
moves the user's event data.

本目录是 Memo 的 Tauri 桌面外壳迁移版。它复用 `../memo/src/renderer` 的现有界面，
并读取 `../memo/data/memo-storage.json` 指定的既有本地事件文件；不会复制、移动或
覆盖用户数据。

## Status / 当前状态

- Tauri window: transparent, frameless, always-on-top, resizable and click-through-capable.
- Tauri 窗口：透明、无边框、置顶、可缩放，并具备点击穿透能力。
- Event list, completion, edit, delete, restore, category, settings, theme, lock, orb and JSON state mutations use the same data schema as Electron.
- 事件列表、完成、修改、删除、恢复、分类、设置、主题、锁定、悬浮球及 JSON 写入均与 Electron 共用同一份数据结构。
- Native export and data-folder dialogs, startup registration, and the two existing global shortcuts are now implemented with Tauri plugins. Natural-language parsing is local and covers the common Chinese/English date and time forms used in the capture sheet.
- 原生导出与数据目录选择器、开机启动及两个既有全局快捷键现已使用 Tauri 插件实现。自然语言解析保持本地运行，并覆盖添加页常用的中英文日期与时间形式。
- Still pending before the Electron entry can be replaced: full parser parity for every rare date expression, Steward named-pipe transport, signed installers, updater publishing, and manual acceptance testing of every visual interaction.
- 在替换 Electron 入口前仍需完成：少见日期表达的完整解析一致性、Steward 命名管道传输、签名安装包、更新发布和所有视觉交互的手动验收。

## Run / 运行

```powershell
cd 'D:\PrivateInformation\Project\Dashboard Manager\Dashboard_module\memo-tauri'
npm install
npm run dev
```

Run `npm run check` to verify the Rust backend without opening a window.

使用 `npm run check` 可只验证 Rust 后端，不打开窗口。

The frozen Electron baseline is Git tag `memo-electron-v2.3.0`.

冻结的 Electron 基线为 Git 标签 `memo-electron-v2.3.0`。
