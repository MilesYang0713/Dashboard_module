use chrono::{Local, SecondsFormat, Utc};
use serde_json::{json, Value};
use std::{fs, path::{Path, PathBuf}, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use uuid::Uuid;

const DEFAULT_CATEGORIES: [(&str, &str, &str); 5] = [
    ("task", "事情", "#9c8cff"), ("learning", "学习", "#65b9ff"),
    ("shopping", "购物", "#ffb560"), ("life", "生活", "#62d39a"), ("other", "其他", "#f28ab8")
];

struct MemoState {
    data_dir: PathBuf,
    state_path: Mutex<PathBuf>,
    write_lock: Mutex<()>,
    window: Mutex<WindowRuntime>,
}

#[derive(Default)]
struct WindowRuntime {
    click_through: bool,
    hotspot_active: bool,
    orb_mode: bool,
    full_bounds: Option<Bounds>,
    orb_drag_offset: Option<(i32, i32)>,
}

#[derive(Clone, Copy)]
struct Bounds { x: i32, y: i32, width: u32, height: u32 }

fn default_categories() -> Value {
    Value::Array(DEFAULT_CATEGORIES.iter().map(|(id, label, color)| json!({"id": id, "label": label, "color": color})).collect())
}

fn default_state() -> Value {
    json!({
      "events": [], "deletedEvents": [],
      "settings": {
        "contentOpacity": 0.92, "backgroundOpacity": 0.94, "themeColor": "#8f82ff",
        "adaptiveContrast": true, "completedVisibility": "immediate", "alwaysOnTop": true, "language": "zh-CN",
        "windowLocked": true, "categories": default_categories()
      }
    })
}

fn data_directory() -> PathBuf {
    if let Ok(path) = std::env::var("MEMO_DATA_DIR") { return PathBuf::from(path); }
    // During migration this deliberately keeps using Electron's existing D-drive data.
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../memo/data")
}

fn read_configured_state_path(data_dir: &Path) -> PathBuf {
    let fallback = data_dir.join("steward-memo.json");
    let config_path = data_dir.join("memo-storage.json");
    fs::read_to_string(config_path).ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|config| config.get("statePath").and_then(Value::as_str).map(PathBuf::from))
        .filter(|path| path.is_absolute()).unwrap_or(fallback)
}

fn normalize_state(mut state: Value) -> Value {
    if !state.is_object() { state = default_state(); }
    let defaults = default_state();
    let root = state.as_object_mut().expect("state object");
    if !root.get("events").is_some_and(Value::is_array) { root.insert("events".into(), json!([])); }
    if !root.get("deletedEvents").is_some_and(Value::is_array) { root.insert("deletedEvents".into(), json!([])); }
    let settings = root.entry("settings").or_insert_with(|| json!({}));
    if !settings.is_object() { *settings = json!({}); }
    let settings = settings.as_object_mut().expect("settings object");
    for (key, value) in defaults["settings"].as_object().unwrap() {
        if !settings.contains_key(key) { settings.insert(key.clone(), value.clone()); }
    }
    if !settings.get("categories").is_some_and(Value::is_array) || settings["categories"].as_array().is_some_and(|v| v.is_empty()) {
        settings.insert("categories".into(), default_categories());
    }
    let now = iso_now();
    for bucket in ["events", "deletedEvents"] {
        if let Some(items) = root.get_mut(bucket).and_then(Value::as_array_mut) {
            for item in items {
                if let Some(event) = item.as_object_mut() {
                    event.entry("category").or_insert_with(|| json!("task"));
                    event.entry("completedAt").or_insert(Value::Null);
                    let created = event.get("createdAt").cloned().unwrap_or_else(|| json!(now));
                    event.entry("createdAt").or_insert(created.clone());
                    event.entry("updatedAt").or_insert(created.clone());
                    event.entry("history").or_insert_with(|| json!([{ "type": "created", "at": created }]));
                }
            }
        }
    }
    state
}

fn iso_now() -> String { Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true) }

fn load_state(app: &MemoState) -> Result<Value, String> {
    let path = app.state_path.lock().map_err(|_| "数据锁不可用".to_string())?.clone();
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).map(normalize_state).map_err(|e| format!("备忘录数据无法读取：{e}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(default_state()),
        Err(error) => Err(format!("备忘录数据无法读取：{error}")),
    }
}

fn save_state(app: &MemoState, state: &Value) -> Result<(), String> {
    let path = app.state_path.lock().map_err(|_| "数据锁不可用".to_string())?.clone();
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::write(path, serde_json::to_string_pretty(state).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn emit_state(app: &AppHandle, state: &Value) { let _ = app.emit("steward-state-changed", state); }

fn mutate<F>(app: &AppHandle, memo: &MemoState, f: F) -> Result<Value, String>
where F: FnOnce(&mut Value) -> Result<(), String> {
    let _guard = memo.write_lock.lock().map_err(|_| "数据写入锁不可用".to_string())?;
    let mut state = load_state(memo)?;
    f(&mut state)?;
    save_state(memo, &state)?;
    emit_state(app, &state);
    Ok(state)
}

fn category_ids(state: &Value) -> Vec<String> {
    state.pointer("/settings/categories").and_then(Value::as_array).map(|items| items.iter().filter_map(|v| v.get("id").and_then(Value::as_str).map(str::to_owned)).collect()).unwrap_or_default()
}

fn event_moment(event: &Value, start: bool) -> Option<i64> {
    let instant = if start { "startAt" } else { "dueAt" };
    let date = if start { "startDate" } else { "dueDate" };
    if let Some(value) = event.get(instant).and_then(Value::as_str) { return chrono::DateTime::parse_from_rfc3339(value).ok().map(|d| d.timestamp_millis()); }
    event.get(date).and_then(Value::as_str).and_then(|value| {
        let suffix = if start { "T00:00:00" } else { "T23:59:59" };
        chrono::NaiveDateTime::parse_from_str(&format!("{value}{suffix}"), "%Y-%m-%dT%H:%M:%S").ok().and_then(|d| d.and_local_timezone(Local).single()).map(|d| d.timestamp_millis())
    })
}

fn valid_schedule(event: &Value) -> bool {
    match (event_moment(event, true), event_moment(event, false)) { (Some(start), Some(end)) => end >= start, _ => true }
}

fn sorted(events: &mut [Value]) {
    events.sort_by_key(|event| {
        let completed = event.get("completed").and_then(Value::as_bool).unwrap_or(false);
        let timestamp = event_moment(event, true).or_else(|| event_moment(event, false)).unwrap_or(i64::MAX);
        (completed, timestamp)
    });
}

fn bounds(window: &WebviewWindow) -> Result<Bounds, String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    Ok(Bounds { x: pos.x, y: pos.y, width: size.width, height: size.height })
}

fn set_bounds(window: &WebviewWindow, value: Bounds) -> Result<(), String> {
    window.set_position(PhysicalPosition::new(value.x, value.y)).map_err(|e| e.to_string())?;
    window.set_size(PhysicalSize::new(value.width, value.height)).map_err(|e| e.to_string())
}

#[tauri::command]
fn bootstrap(memo: State<MemoState>) -> Result<Value, String> {
    let state = load_state(&memo)?;
    let path = memo.state_path.lock().map_err(|_| "数据锁不可用".to_string())?.display().to_string();
    Ok(json!({ "state": state, "departments": [{ "id": "memo-events", "name": "备忘与事件部", "version": "tauri-migration" }], "storage": { "path": path, "launchAtLogin": false } }))
}

#[tauri::command]
fn capture_event(app: AppHandle, memo: State<MemoState>, payload: Value) -> Result<Value, String> {
    let text = payload.get("text").and_then(Value::as_str).unwrap_or("").trim();
    if text.is_empty() { return Ok(json!({ "status": "needs_input", "summary": "请先告诉总管一件要记录的事。", "requiresApproval": false })); }
    let now = iso_now();
    let ids = category_ids(&load_state(&memo)?);
    let category = payload.get("category").and_then(Value::as_str).filter(|id| ids.iter().any(|allowed| allowed == *id)).unwrap_or("task");
    let priority = payload.get("priority").and_then(Value::as_str).filter(|v| ["high", "medium", "normal"].contains(v)).unwrap_or("normal");
    let event = json!({
      "id": Uuid::new_v4().to_string(), "title": text, "sourceText": text,
      "startDate": payload.get("startDate").cloned().unwrap_or(Value::Null), "startAt": payload.get("startAt").cloned().unwrap_or(Value::Null),
      "dueDate": payload.get("dueDate").cloned().unwrap_or(Value::Null), "dueAt": payload.get("dueAt").cloned().unwrap_or(Value::Null),
      "reminderDays": payload.get("reminderDays").and_then(Value::as_i64).unwrap_or(0).clamp(0, 365), "category": category, "priority": priority,
      "courseCode": Value::Null, "completed": false, "createdAt": now, "updatedAt": now, "completedAt": Value::Null,
      "history": [{ "type": "created", "at": now }]
    });
    if !valid_schedule(&event) { return Ok(json!({ "status": "needs_input", "summary": "截止时间不能早于开始时间，请调整日期或时间。", "requiresApproval": false })); }
    let event_for_reply = event.clone();
    let state = mutate(&app, &memo, |state| {
        let events = state["events"].as_array_mut().ok_or("事件数据无效")?;
        events.push(event); sorted(events); Ok(())
    })?;
    Ok(json!({ "status": "completed", "event": event_for_reply, "summary": "已记录事件。", "requiresApproval": false, "state": state }))
}

#[tauri::command]
fn update_event(app: AppHandle, memo: State<MemoState>, id: String, patch: Value) -> Result<Value, String> {
    mutate(&app, &memo, |state| {
        let ids = category_ids(state);
        let events = state["events"].as_array_mut().ok_or("事件数据无效")?;
        for event in events.iter_mut().filter(|event| event.get("id").and_then(Value::as_str) == Some(&id)) {
            let before = event.clone();
            if let (Some(target), Some(changes)) = (event.as_object_mut(), patch.as_object()) { for (key, value) in changes { target.insert(key.clone(), value.clone()); } }
            if !ids.iter().any(|allowed| event.get("category").and_then(Value::as_str) == Some(allowed)) { event["category"] = json!(ids.first().cloned().unwrap_or_else(|| "task".into())); }
            if !valid_schedule(event) { *event = before; return Err("截止时间不能早于开始时间。".into()); }
            let now = iso_now(); event["updatedAt"] = json!(now);
            let changed_completion = patch.get("completed").and_then(Value::as_bool) != before.get("completed").and_then(Value::as_bool);
            if changed_completion { let completed = event["completed"].as_bool().unwrap_or(false); event["completedAt"] = if completed { json!(now.clone()) } else { Value::Null }; append_history(event, if completed { "completed" } else { "reopened" }, &now); }
            else if patch.as_object().is_some_and(|changes| changes.keys().any(|key| key != "completed")) { append_history(event, "updated", &now); }
        }
        sorted(events); Ok(())
    })
}

fn append_history(event: &mut Value, kind: &str, at: &str) {
    if !event.get("history").is_some_and(Value::is_array) { event["history"] = json!([]); }
    event["history"].as_array_mut().unwrap().push(json!({ "type": kind, "at": at }));
}

#[tauri::command]
fn delete_event(app: AppHandle, memo: State<MemoState>, id: String) -> Result<Value, String> {
    mutate(&app, &memo, |state| {
        let mut deleted = None;
        if let Some(events) = state["events"].as_array_mut() { if let Some(index) = events.iter().position(|event| event.get("id").and_then(Value::as_str) == Some(&id)) { deleted = Some(events.remove(index)); } }
        if let Some(mut event) = deleted { let now = iso_now(); event["deletedAt"] = json!(now.clone()); event["updatedAt"] = json!(now.clone()); append_history(&mut event, "deleted", &now); state["deletedEvents"].as_array_mut().ok_or("回收站数据无效")?.insert(0, event); }
        Ok(())
    })
}

#[tauri::command]
fn restore_event(app: AppHandle, memo: State<MemoState>, id: String) -> Result<Value, String> {
    mutate(&app, &memo, |state| {
        let mut restored = None;
        if let Some(items) = state["deletedEvents"].as_array_mut() { if let Some(index) = items.iter().position(|event| event.get("id").and_then(Value::as_str) == Some(&id)) { restored = Some(items.remove(index)); } }
        if let Some(mut event) = restored { let now = iso_now(); if let Some(map) = event.as_object_mut() { map.remove("deletedAt"); } event["updatedAt"] = json!(now.clone()); append_history(&mut event, "restored", &now); let events = state["events"].as_array_mut().ok_or("事件数据无效")?; events.push(event); sorted(events); }
        Ok(())
    })
}

#[tauri::command]
fn purge_event(app: AppHandle, memo: State<MemoState>, id: String) -> Result<Value, String> { mutate(&app, &memo, |state| { state["deletedEvents"].as_array_mut().ok_or("回收站数据无效")?.retain(|event| event.get("id").and_then(Value::as_str) != Some(&id)); Ok(()) }) }

fn patch_settings(app: &AppHandle, memo: &MemoState, key: &str, value: Value) -> Result<Value, String> { mutate(app, memo, |state| { state["settings"][key] = value; Ok(()) }) }
#[tauri::command] fn set_content_opacity(app: AppHandle, memo: State<MemoState>, value: f64) -> Result<Value, String> { patch_settings(&app, &memo, "contentOpacity", json!(value.clamp(0.45, 1.0))) }
#[tauri::command] fn set_background_opacity(app: AppHandle, memo: State<MemoState>, value: f64) -> Result<Value, String> { patch_settings(&app, &memo, "backgroundOpacity", json!(value.clamp(0.0, 0.98))) }
#[tauri::command] fn set_theme_color(app: AppHandle, memo: State<MemoState>, color: String) -> Result<Value, String> { let safe = if color.len() == 7 && color.starts_with('#') { color } else { "#8f82ff".into() }; patch_settings(&app, &memo, "themeColor", json!(safe)) }
#[tauri::command] fn set_adaptive_contrast(app: AppHandle, memo: State<MemoState>, enabled: bool) -> Result<Value, String> { patch_settings(&app, &memo, "adaptiveContrast", json!(enabled)) }
#[tauri::command] fn set_language(app: AppHandle, memo: State<MemoState>, language: String) -> Result<Value, String> { patch_settings(&app, &memo, "language", json!(if language == "en" { "en" } else { "zh-CN" })) }
#[tauri::command] fn set_completed_visibility(app: AppHandle, memo: State<MemoState>, visibility: String) -> Result<Value, String> { let safe = if ["immediate", "today", "24h"].contains(&visibility.as_str()) { visibility } else { "immediate".into() }; patch_settings(&app, &memo, "completedVisibility", json!(safe)) }

#[tauri::command]
fn set_categories(app: AppHandle, memo: State<MemoState>, categories: Value) -> Result<Value, String> {
    let items = categories.as_array().filter(|list| !list.is_empty()).cloned().unwrap_or_else(|| default_categories().as_array().unwrap().clone());
    mutate(&app, &memo, |state| { state["settings"]["categories"] = Value::Array(items.clone()); let ids = category_ids(state); for bucket in ["events", "deletedEvents"] { if let Some(events) = state[bucket].as_array_mut() { for event in events { if !ids.iter().any(|id| event.get("category").and_then(Value::as_str) == Some(id)) { event["category"] = json!(ids.first().cloned().unwrap_or_else(|| "task".into())); } } } } Ok(()) })
}

#[tauri::command]
fn toggle_topmost(app: AppHandle, memo: State<MemoState>, window: WebviewWindow) -> Result<Value, String> { let current = load_state(&memo)?["settings"]["alwaysOnTop"].as_bool().unwrap_or(true); window.set_always_on_top(!current).map_err(|e| e.to_string())?; patch_settings(&app, &memo, "alwaysOnTop", json!(!current)) }
#[tauri::command]
fn toggle_window_lock(app: AppHandle, memo: State<MemoState>, window: WebviewWindow) -> Result<Value, String> { let current = load_state(&memo)?["settings"]["windowLocked"].as_bool().unwrap_or(true); window.set_resizable(current).map_err(|e| e.to_string())?; patch_settings(&app, &memo, "windowLocked", json!(!current)) }

fn apply_click_through(window: &WebviewWindow, runtime: &WindowRuntime) -> Result<(), String> { window.set_ignore_cursor_events(runtime.click_through && !runtime.hotspot_active).map_err(|e| e.to_string()) }
fn sync_unlock_control(app: &AppHandle, main: &WebviewWindow, visible: bool) {
    let Some(unlock) = app.get_webview_window("unlock") else { return; };
    if visible {
        if let Ok(main_bounds) = bounds(main) {
            let x = main_bounds.x + main_bounds.width as i32 - 48;
            let y = main_bounds.y + main_bounds.height as i32 - 48;
            let _ = unlock.set_position(PhysicalPosition::new(x, y));
        }
        let _ = unlock.set_ignore_cursor_events(false);
        let _ = unlock.show();
    } else { let _ = unlock.hide(); }
}
#[tauri::command]
fn toggle_click_through(app: AppHandle, memo: State<MemoState>, window: WebviewWindow, keep_hotspot_interactive: bool) -> Result<bool, String> { let mut runtime = memo.window.lock().map_err(|_| "窗口锁不可用")?; runtime.click_through = !runtime.click_through; runtime.hotspot_active = keep_hotspot_interactive; apply_click_through(&window, &runtime)?; let enabled = runtime.click_through; drop(runtime); sync_unlock_control(&app, &window, enabled); let _ = window.emit("click-through-changed", enabled); Ok(enabled) }
#[tauri::command]
fn unlock_click_through(app: AppHandle, memo: State<MemoState>) -> Result<bool, String> {
    let main = app.get_webview_window("main").ok_or("Memo 主窗口不存在")?;
    let mut runtime = memo.window.lock().map_err(|_| "窗口锁不可用")?;
    runtime.click_through = false; runtime.hotspot_active = false; apply_click_through(&main, &runtime)?;
    drop(runtime); sync_unlock_control(&app, &main, false); let _ = main.emit("click-through-changed", false); Ok(false)
}
#[tauri::command]
fn set_click_through_hotspot(memo: State<MemoState>, window: WebviewWindow, active: bool) -> Result<bool, String> { let mut runtime = memo.window.lock().map_err(|_| "窗口锁不可用")?; if !runtime.click_through { return Ok(false); } runtime.hotspot_active = active; apply_click_through(&window, &runtime)?; Ok(true) }

#[tauri::command]
fn get_window_bounds(memo: State<MemoState>, window: WebviewWindow) -> Result<Value, String> { let b = bounds(&window)?; let locked = load_state(&memo)?["settings"]["windowLocked"].as_bool().unwrap_or(true); Ok(json!({"x": b.x, "y": b.y, "width": b.width, "height": b.height, "locked": locked })) }
#[tauri::command]
fn resize_window(memo: State<MemoState>, window: WebviewWindow, payload: Value) -> Result<Value, String> {
    if load_state(&memo)?["settings"]["windowLocked"].as_bool().unwrap_or(true) { return Ok(Value::Null); }
    let edge = payload.get("edge").and_then(Value::as_str).unwrap_or(""); let start = &payload["startBounds"]; let dx = payload.get("deltaX").and_then(Value::as_i64).unwrap_or(0) as i32; let dy = payload.get("deltaY").and_then(Value::as_i64).unwrap_or(0) as i32;
    let mut b = Bounds { x: start["x"].as_i64().unwrap_or(0) as i32, y: start["y"].as_i64().unwrap_or(0) as i32, width: start["width"].as_u64().unwrap_or(400) as u32, height: start["height"].as_u64().unwrap_or(510) as u32 };
    if edge.contains("left") { b.x += dx; b.width = (b.width as i32 - dx).max(220) as u32; } if edge.contains("right") { b.width = (b.width as i32 + dx).max(220) as u32; } if edge.contains("top") { b.y += dy; b.height = (b.height as i32 - dy).max(160) as u32; } if edge.contains("bottom") { b.height = (b.height as i32 + dy).max(160) as u32; }
    set_bounds(&window, b)?; Ok(json!({"x": b.x, "y": b.y, "width": b.width, "height": b.height}))
}

#[tauri::command]
fn minimize_to_orb(memo: State<MemoState>, window: WebviewWindow) -> Result<(), String> { let mut runtime = memo.window.lock().map_err(|_| "窗口锁不可用")?; if runtime.orb_mode { return Ok(()); } runtime.full_bounds = Some(bounds(&window)?); runtime.orb_mode = true; window.set_resizable(false).map_err(|e| e.to_string())?; window.set_size(PhysicalSize::new(58, 58)).map_err(|e| e.to_string())?; let _ = window.emit("orb-mode-changed", true); Ok(()) }
#[tauri::command]
fn restore_from_orb(memo: State<MemoState>, window: WebviewWindow) -> Result<(), String> { let mut runtime = memo.window.lock().map_err(|_| "窗口锁不可用")?; if !runtime.orb_mode { return Ok(()); } if let Some(b) = runtime.full_bounds { set_bounds(&window, b)?; } runtime.orb_mode = false; let locked = load_state(&memo)?["settings"]["windowLocked"].as_bool().unwrap_or(true); window.set_resizable(!locked).map_err(|e| e.to_string())?; let _ = window.emit("orb-mode-changed", false); Ok(()) }
#[tauri::command]
fn begin_orb_drag(memo: State<MemoState>, window: WebviewWindow, cursor: Value) -> Result<bool, String> { let mut runtime = memo.window.lock().map_err(|_| "窗口锁不可用")?; if !runtime.orb_mode { return Ok(false); } let b = bounds(&window)?; runtime.orb_drag_offset = Some((cursor["x"].as_i64().unwrap_or(0) as i32 - b.x, cursor["y"].as_i64().unwrap_or(0) as i32 - b.y)); Ok(true) }
#[tauri::command]
fn move_orb(memo: State<MemoState>, window: WebviewWindow, cursor: Value) -> Result<Value, String> { let runtime = memo.window.lock().map_err(|_| "窗口锁不可用")?; let Some((dx, dy)) = runtime.orb_drag_offset else { return Ok(Value::Null); }; let b = bounds(&window)?; let x = cursor["x"].as_i64().unwrap_or(0) as i32 - dx; let y = cursor["y"].as_i64().unwrap_or(0) as i32 - dy; window.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string())?; Ok(json!({"x": x, "y": y, "width": b.width, "height": b.height})) }
#[tauri::command] fn end_orb_drag(memo: State<MemoState>) -> Result<(), String> { memo.window.lock().map_err(|_| "窗口锁不可用")?.orb_drag_offset = None; Ok(()) }
#[tauri::command] fn hide_window(window: WebviewWindow) -> Result<(), String> { window.hide().map_err(|e| e.to_string()) }
#[tauri::command] fn quit_app(app: AppHandle) { app.exit(0); }

#[tauri::command]
fn set_storage_directory(memo: State<MemoState>, directory: String) -> Result<Value, String> {
    let target_dir = PathBuf::from(directory);
    let target = target_dir.join("steward-memo.json");
    if target.exists() { return Ok(json!({ "canceled": true, "error": "所选文件夹已含有 steward-memo.json；为防止覆盖，未更改保存位置。" })); }
    let _guard = memo.write_lock.lock().map_err(|_| "数据写入锁不可用".to_string())?;
    let current = load_state(&memo)?;
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    fs::write(&target, serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let config = memo.data_dir.join("memo-storage.json");
    fs::write(config, serde_json::to_string_pretty(&json!({ "statePath": target })).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    *memo.state_path.lock().map_err(|_| "数据锁不可用".to_string())? = target.clone();
    Ok(json!({ "canceled": false, "state": current, "storage": { "path": target, "launchAtLogin": false } }))
}

fn csv_quote(value: impl ToString) -> String { format!("\"{}\"", value.to_string().replace('"', "\"\"")) }

#[tauri::command]
fn write_export(memo: State<MemoState>, format: String, path: String) -> Result<Value, String> {
    let state = load_state(&memo)?;
    let destination = PathBuf::from(path);
    let output = if format == "csv" {
        let headers = "工作,类别,优先级,状态,解决方案,已创建,已更新,截止日期,已删除";
        let categories = state.pointer("/settings/categories").and_then(Value::as_array).cloned().unwrap_or_default();
        let name_for = |id: &str| categories.iter().find(|category| category.get("id").and_then(Value::as_str) == Some(id)).and_then(|category| category.get("label").and_then(Value::as_str)).unwrap_or("事情");
        let mut rows = vec![headers.to_owned()];
        for event in state["events"].as_array().into_iter().flatten().chain(state["deletedEvents"].as_array().into_iter().flatten()) {
            let deleted = event.get("deletedAt").and_then(Value::as_str); let completed = event.get("completed").and_then(Value::as_bool).unwrap_or(false);
            rows.push([event.get("title").and_then(Value::as_str).unwrap_or(""), name_for(event.get("category").and_then(Value::as_str).unwrap_or("task")), event.get("priority").and_then(Value::as_str).unwrap_or("normal"), if deleted.is_some() { "已删除" } else if completed { "完成" } else { "待办" }, if deleted.is_some() { "已移至回收站" } else if completed { "完成" } else { "未解决" }, event.get("createdAt").and_then(Value::as_str).unwrap_or(""), event.get("updatedAt").and_then(Value::as_str).unwrap_or(""), event.get("dueAt").and_then(Value::as_str).or_else(|| event.get("dueDate").and_then(Value::as_str)).unwrap_or("无"), deleted.unwrap_or("无")].into_iter().map(csv_quote).collect::<Vec<_>>().join(","));
        }
        rows.join("\r\n")
    } else { serde_json::to_string_pretty(&json!({ "exportedAt": iso_now(), "events": state["events"], "deletedEvents": state["deletedEvents"] })).map_err(|e| e.to_string())? };
    fs::write(&destination, output).map_err(|e| e.to_string())?;
    Ok(json!({ "canceled": false, "filePath": destination }))
}

pub fn run() {
    let data_dir = data_directory();
    let app_state = MemoState { data_dir: data_dir.clone(), state_path: Mutex::new(read_configured_state_path(&data_dir)), write_lock: Mutex::new(()), window: Mutex::new(WindowRuntime::default()) };
    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            app.handle().plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None::<Vec<&str>>))?;
            let toggle_window = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyM);
            let toggle_click = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyL);
            let shortcut_app = app.handle().clone();
            app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(move |_app, shortcut, event| {
                if event.state() != ShortcutState::Pressed { return; }
                if let Some(window) = shortcut_app.get_webview_window("main") {
                    if shortcut == &toggle_window { if window.is_visible().unwrap_or(true) { let _ = window.hide(); } else { let _ = window.show(); let _ = window.set_focus(); } }
                    if shortcut == &toggle_click { let state = shortcut_app.state::<MemoState>(); if let Ok(mut runtime) = state.window.lock() { runtime.click_through = !runtime.click_through; let _ = apply_click_through(&window, &runtime); let enabled = runtime.click_through; drop(runtime); sync_unlock_control(&shortcut_app, &window, enabled); let _ = window.emit("click-through-changed", enabled); }; }
                }
            }).build())?;
            app.global_shortcut().register(toggle_window)?;
            app.global_shortcut().register(toggle_click)?;
            if let Some(window) = app.get_webview_window("main") {
                let state = app.state::<MemoState>();
                if let Ok(saved) = load_state(&state) {
                    let _ = window.set_always_on_top(saved["settings"]["alwaysOnTop"].as_bool().unwrap_or(true));
                    let _ = window.set_resizable(!saved["settings"]["windowLocked"].as_bool().unwrap_or(true));
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![bootstrap, capture_event, update_event, delete_event, restore_event, purge_event, set_content_opacity, set_background_opacity, set_theme_color, set_categories, set_adaptive_contrast, set_language, set_completed_visibility, toggle_topmost, toggle_window_lock, toggle_click_through, unlock_click_through, set_click_through_hotspot, get_window_bounds, resize_window, minimize_to_orb, restore_from_orb, begin_orb_drag, move_orb, end_orb_drag, hide_window, quit_app, set_storage_directory, write_export])
        .run(tauri::generate_context!())
        .expect("Memo Tauri 无法启动");
}
