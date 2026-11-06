/*
 * Electron injects window.steward through preload.js.  The Tauri migration
 * intentionally serves the same renderer files, so this bridge supplies the
 * equivalent local-only API when it is hosted by Tauri instead.
 */
(() => {
  if (window.steward || !window.__TAURI__?.core?.invoke) return;

  const invoke = window.__TAURI__.core.invoke;
  const listen = window.__TAURI__.event.listen;
  let latestPointer = { x: 0, y: 0 };
  window.addEventListener('mousemove', (event) => { latestPointer = { x: event.screenX, y: event.screenY }; }, true);
  const stateListener = (eventName, callback) => {
    let unlisten = null;
    listen(eventName, (event) => callback(event.payload)).then((dispose) => { unlisten = dispose; });
    return () => unlisten?.();
  };

  window.steward = {
    bootstrap: async () => {
      const result = await invoke('bootstrap');
      result.storage.launchAtLogin = await window.__TAURI__.autostart.isEnabled();
      return result;
    },
    captureEvent: (payload) => invoke('capture_event', { payload: enrichNaturalLanguageEvent(payload) }),
    updateEvent: (id, patch) => invoke('update_event', { id, patch }),
    deleteEvent: (id) => invoke('delete_event', { id }),
    restoreEvent: (id) => invoke('restore_event', { id }),
    purgeEvent: (id) => invoke('purge_event', { id }),
    setContentOpacity: (value) => invoke('set_content_opacity', { value }),
    setBackgroundOpacity: (value) => invoke('set_background_opacity', { value }),
    setThemeColor: (color) => invoke('set_theme_color', { color }),
    setCategories: (categories) => invoke('set_categories', { categories }),
    setAdaptiveContrast: (enabled) => invoke('set_adaptive_contrast', { enabled }),
    sampleBackdropLuminance: (regions) => invoke('sample_backdrop_luminance', { regions }),
    setLanguage: (language) => invoke('set_language', { language }),
    setCompletedVisibility: (visibility) => invoke('set_completed_visibility', { visibility }),
    setLaunchAtLogin: async (enabled) => {
      const autostart = window.__TAURI__.autostart;
      if (enabled) await autostart.enable(); else await autostart.disable();
      return { launchAtLogin: await autostart.isEnabled() };
    },
    chooseStorageDirectory: async () => {
      const directory = await window.__TAURI__.dialog.open({ directory: true, multiple: false, title: '选择备忘录数据保存位置' });
      return directory ? invoke('set_storage_directory', { directory }) : { canceled: true };
    },
    toggleTopmost: () => invoke('toggle_topmost'),
    toggleWindowLock: () => invoke('toggle_window_lock'),
    toggleClickThrough: (keepHotspotInteractive = false) => invoke('toggle_click_through', { keepHotspotInteractive }),
    setClickThroughHotspot: (active) => invoke('set_click_through_hotspot', { active }),
    setLockedInteractionRegions: (regions) => invoke('set_locked_interaction_regions', { regions }),
    onClickThroughChanged: (callback) => stateListener('click-through-changed', callback),
    onNativeLockedWheel: (callback) => stateListener('native-locked-wheel', callback),
    onNativeUnlockRequested: (callback) => stateListener('native-unlock-requested', callback),
    onNativeUnlockHotspot: (callback) => stateListener('native-unlock-hotspot', callback),
    onUnlockDockRequested: (callback) => stateListener('unlock-dock-requested', callback),
    unlockClickThrough: () => invoke('unlock_click_through'),
    minimizeToOrb: () => invoke('minimize_to_orb'),
    restoreFromOrb: () => invoke('restore_from_orb'),
    beginOrbDrag: () => invoke('begin_orb_drag', { cursor: latestPointer }),
    moveOrb: () => invoke('move_orb', { cursor: latestPointer }),
    endOrbDrag: () => invoke('end_orb_drag'),
    onOrbModeChanged: (callback) => stateListener('orb-mode-changed', callback),
    onStateChanged: (callback) => stateListener('steward-state-changed', callback),
    hide: () => invoke('hide_window'),
    quit: () => invoke('quit_app'),
    exportEvents: async (format) => {
      const path = await window.__TAURI__.dialog.save({ title: '导出备忘录数据', defaultPath: `memo-events-${new Date().toISOString().slice(0, 10)}.${format}`, filters: [{ name: format === 'csv' ? 'CSV' : 'JSON', extensions: [format] }] });
      return path ? invoke('write_export', { format, path }) : { canceled: true };
    },
    getWindowBounds: () => invoke('get_window_bounds'),
    resizeWindow: (payload) => invoke('resize_window', { payload })
  };

  function enrichNaturalLanguageEvent(payload) {
    const next = { ...payload };
    if (!next.text || next.startDate || next.startAt || next.dueDate || next.dueAt) return next;
    const text = String(next.text);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const explicit = text.match(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/) || text.match(/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/);
    const dotted = text.match(/\b(\d{1,2})\.(\d{1,2})\b/);
    let date = null;
    if (/后天|day after tomorrow/i.test(text)) { date = new Date(today); date.setDate(date.getDate() + 2); }
    else if (/明天|tomorrow/i.test(text)) { date = new Date(today); date.setDate(date.getDate() + 1); }
    else if (/今天|今晚|今早|today|tonight/i.test(text)) date = today;
    else if (explicit) { const year = explicit[1] ? Number(explicit[1]) : today.getFullYear(); date = new Date(year, Number(explicit[2]) - 1, Number(explicit[3])); if (!explicit[1] && date < today) date.setFullYear(year + 1); }
    else if (dotted) { date = new Date(today.getFullYear(), Number(dotted[1]) - 1, Number(dotted[2])); if (date < today) date.setFullYear(date.getFullYear() + 1); }
    const chineseTime = text.match(/(上午|下午|晚上|中午)?\s*(\d{1,2})\s*(?:点|时|:|：)\s*(\d{1,2})?/);
    const englishTime = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    let hour = null; let minute = 0;
    if (chineseTime) { hour = Number(chineseTime[2]); minute = Number(chineseTime[3] || 0); if (['下午', '晚上'].includes(chineseTime[1]) && hour < 12) hour += 12; if (chineseTime[1] === '中午' && hour < 11) hour += 12; }
    else if (englishTime) { hour = Number(englishTime[1]); minute = Number(englishTime[2] || 0); if (englishTime[3].toLowerCase() === 'pm' && hour < 12) hour += 12; if (englishTime[3].toLowerCase() === 'am' && hour === 12) hour = 0; }
    if (date && hour != null && hour < 24 && minute < 60) { date.setHours(hour, minute, 0, 0); next.dueAt = date.toISOString(); }
    else if (date) next.dueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return next;
  }
})();
