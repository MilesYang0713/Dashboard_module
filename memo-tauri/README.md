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
- Still being migrated: natural-language date parsing, native export picker, custom storage picker, startup registration, global shortcuts, updater, and the production installer.
- 仍在迁移：自然语言日期解析、原生导出/数据位置选择器、开机启动、全局快捷键、更新器和正式安装包。

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
