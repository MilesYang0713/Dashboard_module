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
    bootstrap: () => invoke('bootstrap'),
    captureEvent: (payload) => invoke('capture_event', { payload }),
    updateEvent: (id, patch) => invoke('update_event', { id, patch }),
    deleteEvent: (id) => invoke('delete_event', { id }),
    restoreEvent: (id) => invoke('restore_event', { id }),
    purgeEvent: (id) => invoke('purge_event', { id }),
    setContentOpacity: (value) => invoke('set_content_opacity', { value }),
    setBackgroundOpacity: (value) => invoke('set_background_opacity', { value }),
    setThemeColor: (color) => invoke('set_theme_color', { color }),
    setCategories: (categories) => invoke('set_categories', { categories }),
    setAdaptiveContrast: (enabled) => invoke('set_adaptive_contrast', { enabled }),
    setCompletedVisibility: (visibility) => invoke('set_completed_visibility', { visibility }),
    setLaunchAtLogin: (enabled) => invoke('set_launch_at_login', { enabled }),
    chooseStorageDirectory: () => invoke('choose_storage_directory'),
    toggleTopmost: () => invoke('toggle_topmost'),
    toggleWindowLock: () => invoke('toggle_window_lock'),
    toggleClickThrough: (keepHotspotInteractive = false) => invoke('toggle_click_through', { keepHotspotInteractive }),
    setClickThroughHotspot: (active) => invoke('set_click_through_hotspot', { active }),
    onClickThroughChanged: (callback) => stateListener('click-through-changed', callback),
    minimizeToOrb: () => invoke('minimize_to_orb'),
    restoreFromOrb: () => invoke('restore_from_orb'),
    beginOrbDrag: () => invoke('begin_orb_drag', { cursor: latestPointer }),
    moveOrb: () => invoke('move_orb', { cursor: latestPointer }),
    endOrbDrag: () => invoke('end_orb_drag'),
    onOrbModeChanged: (callback) => stateListener('orb-mode-changed', callback),
    onStateChanged: (callback) => stateListener('steward-state-changed', callback),
    hide: () => invoke('hide_window'),
    quit: () => invoke('quit_app'),
    exportEvents: (format) => invoke('export_events', { format }),
    getWindowBounds: () => invoke('get_window_bounds'),
    resizeWindow: (payload) => invoke('resize_window', { payload })
  };
})();
