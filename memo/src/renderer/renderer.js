let state;
let storage;
let activeCategory = 'all';
let sortField = 'time';
let clickThroughEnabled = false;
let actionHotspotActive = false;
let scrollHotspotActive = false;
let scrollHotspotReleaseTimer = null;
let editingEventId = null;

const locale = () => state?.settings?.language === 'en' ? 'en' : 'zh-CN';
const translations = {
  en: {
    language: 'System language', settings: 'Display settings', add: 'Add event', save: 'Save changes',
    category: 'Category:', priority: 'Priority:', startDate: 'Start date', startTime: 'Start time', dueDate: 'Due date', dueTime: 'Due time',
    reminder: 'Advance reminder', dayDefault: 'days (default: 1)', dataPath: 'Data location', change: 'Change',
    completed: 'Completed items', hideNow: 'Hide immediately', todayEnd: 'Keep until today ends', keep24: 'Keep for 24 hours',
    lockWindow: 'Lock position and size', clickThrough: 'Lock interaction and click through', topmost: 'Always on top', launch: 'Launch at login', quit: 'Quit Memo',
    history: 'Update history', register: 'Event register', deleted: 'Deleted events', overview: 'Work overview', adaptive: 'Adaptive contrast',
    created: 'Created', updated: 'Updated', completedAction: 'Completed', reopened: 'Reopened', deletedAction: 'Deleted', restored: 'Restored', edit: 'Edit event', delete: 'Delete event', done: 'Complete event'
  },
  'zh-CN': {}
};
const t = (key, fallback) => translations[locale()]?.[key] || fallback;

function applyLanguage() {
  const en = locale() === 'en';
  document.documentElement.lang = en ? 'en' : 'zh-CN';
  $('#language-label').textContent = t('language', '系统语言');
  $('#language').value = locale();
  $('#capture-sheet-title').textContent = editingEventId ? t('save', '修改事件') : t('add', '添加事件');
  $('#capture-button').textContent = editingEventId ? t('save', '保存修改') : t('add', '添加');
  const staticText = [['#settings-sheet h2', 'settings', '显示设置'], ['#setting-adaptive-contrast', 'adaptive', '自动对比色'], ['#setting-launch-at-login', 'launch', '开机自动运行'], ['#setting-window-lock', 'lockWindow', '固定窗口位置与尺寸'], ['#setting-click-through', 'clickThrough', '锁定交互并点击穿透'], ['#setting-topmost', 'topmost', '始终置顶'], ['#quit-app', 'quit', '退出备忘录'], ['#analytics h3', 'overview', 'Work overview'], ['#register h3', 'register', 'Event register'], ['#trash h3', 'deleted', 'Deleted events'], ['#toggle-updates strong', 'history', 'Update history']];
  for (const [selector, key, fallback] of staticText) { const element = $(selector); if (element) element.childNodes[0] ? element.childNodes[0].textContent = t(key, fallback) : element.textContent = t(key, fallback); }
}

const $ = (selector) => document.querySelector(selector);
const defaultCategories = [
  { id: 'task', label: '事情', color: '#9c8cff' },
  { id: 'learning', label: '学习', color: '#65b9ff' },
  { id: 'shopping', label: '购物', color: '#ffb560' },
  { id: 'life', label: '生活', color: '#62d39a' },
  { id: 'other', label: '其他', color: '#f28ab8' }
];
const categories = () => state?.settings?.categories?.length ? state.settings.categories : defaultCategories;
const categoryFor = (id) => categories().find((item) => item.id === id) || categories()[0];
const formatTime = (time) => time ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time)) : null;
const formatDateOnly = (date) => date ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)) : null;
const eventTime = (item, kind, endOfDay = false) => {
  const timeKey = kind === 'due' ? 'dueAt' : 'startAt';
  const dateKey = kind === 'due' ? 'dueDate' : 'startDate';
  if (item[timeKey]) return new Date(item[timeKey]).getTime();
  if (item[dateKey]) return new Date(`${item[dateKey]}T${endOfDay ? '23:59:59.999' : '00:00:00'}`).getTime();
  return null;
};
const formatSchedulePoint = (item, kind) => {
  const instantKey = kind === 'start' ? 'startAt' : 'dueAt';
  const dateKey = kind === 'start' ? 'startDate' : 'dueDate';
  if (item[instantKey]) {
    const date = new Date(item[instantKey]);
    const pad = (part) => String(part).padStart(2, '0');
    return `${date.getMonth() + 1}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (item[dateKey]) {
    const [year, month, day] = item[dateKey].split('-');
    return `${Number(month)}.${day}`;
  }
  return null;
};
const formatSchedule = (item) => [formatSchedulePoint(item, 'start'), formatSchedulePoint(item, 'due')].filter(Boolean).join(' — ');
const formatActivity = (item) => {
  const created = item.createdAt ? `创建 ${formatTime(item.createdAt)}` : null;
  const completed = item.completedAt ? `完成 ${formatTime(item.completedAt)}` : null;
  return [created, completed].filter(Boolean).join(' · ');
};

const priorityLabels = { high: '最高', medium: '高', normal: '普通' };

const dateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const timeInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function eventAlert(item) {
  if (item.completed) return null;
  const now = Date.now();
  const reminderDays = Number(item.reminderDays) || 0;
  const startTime = eventTime(item, 'start');
  const dueTime = eventTime(item, 'due', true);
  if (dueTime && dueTime < now) return { tone: 'overdue', label: '！已过截止时间' };
  if (startTime && startTime < now && !dueTime) return { tone: 'started', label: '！已过开始时间' };

  // The advance reminder follows the first upcoming moment: start when there
  // is one, otherwise deadline. After a start has passed, deadline is next.
  const nextKind = startTime != null && startTime >= now ? 'start' : dueTime != null ? 'due' : null;
  const nextTime = nextKind === 'start' ? startTime : dueTime;
  if (nextTime != null) {
    const hours = (nextTime - now) / 3_600_000;
    const verb = nextKind === 'start' ? '开始' : '截止';
    const tonePrefix = nextKind === 'start' ? 'start-' : '';
    if (hours <= 6) return { tone: `${tonePrefix}urgent`, label: `！6 小时内${verb}` };
    if (hours <= 12) return { tone: `${tonePrefix}soon`, label: `！12 小时内${verb}` };
    if (reminderDays > 0 && hours <= reminderDays * 24) return { tone: `${tonePrefix}reminder`, label: `！提前提醒：${Math.ceil(hours / 24)} 天后${verb}` };
  }
  if (startTime && startTime < now) return { tone: 'started', label: '！已过开始时间' };
  return null;
}

function isScheduleInputValid({ startDate, startAt, dueDate, dueAt }) {
  const start = startAt ? new Date(startAt).getTime() : startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
  const due = dueAt ? new Date(dueAt).getTime() : dueDate ? new Date(`${dueDate}T23:59:59.999`).getTime() : null;
  return start == null || due == null || due >= start;
}

function sortEvents(items) {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (sortField === 'time') {
      const aStart = eventTime(a, 'start');
      const bStart = eventTime(b, 'start');
      const aDue = eventTime(a, 'due', true);
      const bDue = eventTime(b, 'due', true);
      // An event with both dates is scheduled from its start. An event with
      // only one date uses that one; equal starts break ties by deadline.
      const aPrimary = aStart ?? aDue ?? Number.POSITIVE_INFINITY;
      const bPrimary = bStart ?? bDue ?? Number.POSITIVE_INFINITY;
      const aSecondary = aStart == null ? Number.POSITIVE_INFINITY : aDue ?? Number.POSITIVE_INFINITY;
      const bSecondary = bStart == null ? Number.POSITIVE_INFINITY : bDue ?? Number.POSITIVE_INFINITY;
      return aPrimary - bPrimary || aSecondary - bSecondary || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    const kind = sortField === 'dueAt' ? 'due' : 'start';
    const aTime = eventTime(a, kind, kind === 'due') ?? Number.POSITIVE_INFINITY;
    const bTime = eventTime(b, kind, kind === 'due') ?? Number.POSITIVE_INFINITY;
    return aTime - bTime || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function shouldShowInQueue(item) {
  if (!item.completed) return true;
  const visibility = state.settings.completedVisibility || 'immediate';
  if (visibility === 'immediate') return false;
  const completedAt = new Date(item.completedAt || item.updatedAt || item.createdAt).getTime();
  if (visibility === '24h') return Date.now() - completedAt < 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return completedAt >= startOfToday.getTime() && completedAt <= endOfToday.getTime();
}

function renderAnalytics() {
  const events = state.events || [];
  const total = events.length;
  const completed = events.filter((item) => item.completed).length;
  const open = total - completed;
  const completion = total ? Math.round((completed / total) * 100) : 0;
  $('#metric-total').textContent = total;
  $('#metric-open').textContent = open;
  $('#metric-done').textContent = completed;
  $('#donut-label').textContent = `${completion}%`;
  $('#status-donut').style.background = `conic-gradient(${state.settings.themeColor} 0 ${completion}%, rgba(255,255,255,.11) ${completion}% 100%)`;
  $('#completion-detail').textContent = `${completed} / ${total} completed`;

  const counts = categories().map((category) => ({ ...category, count: events.filter((item) => item.category === category.id).length }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  const chart = $('#category-chart');
  chart.replaceChildren();
  for (const item of counts) {
    const row = document.createElement('div');
    row.className = 'category-bar';
    const label = document.createElement('span');
    label.textContent = item.label;
    const track = document.createElement('i');
    const fill = document.createElement('b');
    fill.style.width = `${(item.count / max) * 100}%`;
    fill.style.background = item.color;
    track.append(fill);
    const value = document.createElement('em');
    value.textContent = item.count;
    row.append(label, track, value);
    chart.append(row);
  }

  renderTrend(events);
  renderEventRegister(events);
}

function renderTrend(events) {
  const svg = $('#history-trend');
  svg.replaceChildren();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const dayKey = (date) => new Date(date).toLocaleDateString('sv-SE');
  const counts = new Map(days.map((day) => [dayKey(day), 0]));
  for (const item of events) {
    for (const record of item.history || []) {
      const key = dayKey(record.at);
      if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    }
  }
  const values = days.map((day) => counts.get(dayKey(day)) || 0);
  const max = Math.max(1, ...values);
  const width = 280;
  const height = 112;
  const pad = { left: 12, right: 12, top: 12, bottom: 24 };
  const graphWidth = width - pad.left - pad.right;
  const graphHeight = height - pad.top - pad.bottom;
  const ns = 'http://www.w3.org/2000/svg';
  const make = (name, attributes = {}) => {
    const node = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  [0, .5, 1].forEach((fraction) => svg.append(make('line', { x1: pad.left, x2: width - pad.right, y1: pad.top + graphHeight * fraction, y2: pad.top + graphHeight * fraction, class: 'trend-grid' })));
  const points = values.map((value, index) => ({
    x: pad.left + (graphWidth / (values.length - 1)) * index,
    y: pad.top + graphHeight - (value / max) * graphHeight
  }));
  svg.append(make('polyline', { points: points.map((point) => `${point.x},${point.y}`).join(' '), class: 'trend-line' }));
  points.forEach((point, index) => {
    svg.append(make('circle', { cx: point.x, cy: point.y, r: 3.5, class: 'trend-point' }));
    const label = make('text', { x: point.x, y: height - 7, class: 'trend-label', 'text-anchor': 'middle' });
    label.textContent = `${days[index].getMonth() + 1}/${days[index].getDate()}`;
    svg.append(label);
  });
}

function renderEventRegister(events) {
  const body = $('#event-register-body');
  body.replaceChildren();
  const rows = [...events].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.textContent = '还没有事件记录。';
    row.append(cell);
    body.append(row);
    return;
  }
  for (const item of rows) {
    const row = document.createElement('tr');
    const values = [
      item.title,
      categoryFor(item.category).label,
      priorityLabels[item.priority] || '普通',
      item.completed ? '完成' : '待办',
      formatTime(item.createdAt) || '—',
      formatTime(item.updatedAt || item.completedAt || item.createdAt) || '—',
      formatTime(item.dueAt) || (item.dueDate ? `${formatDateOnly(item.dueDate)}（全天）` : '无')
    ];
    values.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (index === 3) cell.className = item.completed ? 'register-status done' : 'register-status open';
      if (index === 2) cell.className = `register-priority ${item.priority || 'normal'}`;
      row.append(cell);
    });
    const actions = document.createElement('td');
    actions.className = 'register-actions';
    if (item.completed) {
      const reopen = document.createElement('button');
      reopen.className = 'register-restore';
      reopen.textContent = '恢复待办';
      reopen.addEventListener('click', async () => {
        state = await window.steward.updateEvent(item.id, { completed: false });
        render();
        showToast('已恢复为待办');
      });
      actions.append(reopen);
    }
    const remove = document.createElement('button');
    remove.className = 'register-delete';
    remove.textContent = '删除';
    remove.title = '移入回收站';
    remove.addEventListener('click', async () => {
      state = await window.steward.deleteEvent(item.id);
      render();
      showToast('已移入回收站');
    });
    actions.append(remove);
    row.append(actions);
    body.append(row);
  }
}

function renderTrash() {
  const trash = $('#trash-list');
  const deleted = state.deletedEvents || [];
  trash.replaceChildren();
  if (!deleted.length) {
    const empty = document.createElement('p');
    empty.className = 'trash-empty';
    empty.textContent = '回收站为空。';
    trash.append(empty);
    return;
  }
  for (const item of deleted) {
    const row = document.createElement('article');
    row.className = 'trash-item';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const time = document.createElement('small');
    time.textContent = `删除于 ${formatTime(item.deletedAt) || '—'}`;
    copy.append(title, time);
    const actions = document.createElement('div');
    const restore = document.createElement('button');
    restore.textContent = '恢复';
    restore.addEventListener('click', async () => { state = await window.steward.restoreEvent(item.id); render(); showToast('已恢复事件'); });
    const purge = document.createElement('button');
    purge.className = 'purge';
    purge.textContent = '永久删除';
    purge.addEventListener('click', async () => { state = await window.steward.purgeEvent(item.id); render(); showToast('已永久删除'); });
    actions.append(restore, purge);
    row.append(copy, actions);
    trash.append(row);
  }
}

async function exportData(format) {
  const result = await window.steward.exportEvents(format);
  if (!result.canceled) showToast(`已导出到 ${result.filePath}`);
}

function showToast(text) {
  $('#toast').textContent = text;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { $('#toast').textContent = ''; }, 4200);
}

function populateCategorySelect(select, selected, includeAll = false) {
  select.replaceChildren();
  if (includeAll) {
    const option = document.createElement('option');
    option.value = 'all';
    option.textContent = '全部';
    select.append(option);
  }
  for (const category of categories()) {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.label;
    select.append(option);
  }
  const valid = [...select.options].some((option) => option.value === selected);
  select.value = valid ? selected : (includeAll ? 'all' : categories()[0].id);
}

async function saveCategories(nextCategories) {
  state = await window.steward.setCategories(nextCategories);
  if (activeCategory !== 'all' && !categories().some((category) => category.id === activeCategory)) activeCategory = 'all';
  render();
}

function renderCategoryManager() {
  const list = $('#category-manager-list');
  list.replaceChildren();
  const currentCategories = categories();
  for (const category of currentCategories) {
    const row = document.createElement('div');
    row.className = 'category-manager-row';
    const label = document.createElement('input');
    label.type = 'text';
    label.maxLength = 18;
    label.value = category.label;
    label.setAttribute('aria-label', `${category.label} 类别名称`);
    const color = document.createElement('input');
    color.type = 'color';
    color.value = category.color;
    color.setAttribute('aria-label', `${category.label} 类别颜色`);
    const update = () => {
      const next = currentCategories.map((item) => item.id === category.id ? { ...item, label: label.value.trim() || item.label, color: color.value } : item);
      saveCategories(next);
    };
    label.addEventListener('change', update);
    color.addEventListener('change', update);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '删除';
    remove.disabled = currentCategories.length === 1;
    remove.title = currentCategories.length === 1 ? '至少保留一个类别' : `删除 ${category.label}`;
    remove.addEventListener('click', () => saveCategories(currentCategories.filter((item) => item.id !== category.id)));
    row.append(label, color, remove);
    list.append(row);
  }
}

function renderCategoryControls() {
  if (activeCategory !== 'all' && !categories().some((category) => category.id === activeCategory)) activeCategory = 'all';
  populateCategorySelect($('#category-filter'), activeCategory, true);
  populateCategorySelect($('#event-category'), $('#event-category').value || categories()[0].id);
  renderCategoryManager();
}

function render() {
  applyLanguage();
  const events = state.events || [];
  $('#event-count').textContent = `${events.filter((item) => !item.completed).length} 项待办`;
  $('#content-opacity').value = state.settings.contentOpacity;
  $('#background-opacity').value = state.settings.backgroundOpacity;
  $('#theme-color').value = state.settings.themeColor;
  const adaptiveContrast = state.settings.adaptiveContrast !== false;
  $('#completed-visibility').value = state.settings.completedVisibility || 'immediate';
  document.documentElement.style.setProperty('--background-opacity', state.settings.backgroundOpacity);
  document.documentElement.style.setProperty('--content-opacity', state.settings.contentOpacity);
  document.documentElement.style.setProperty('--accent-color', state.settings.themeColor);
  $('.panel').classList.toggle('background-clear', state.settings.backgroundOpacity === 0);
  document.body.classList.toggle('adaptive-contrast', adaptiveContrast);
  document.body.classList.toggle('contrast-dark-ink', adaptiveContrast && Number(state.settings.backgroundOpacity) <= 0.54);
  document.body.classList.toggle('window-unlocked', !state.settings.windowLocked);
  document.body.classList.toggle('interaction-scroll-locked', clickThroughEnabled);
  $('#setting-window-lock').classList.toggle('active', state.settings.windowLocked);
  $('#setting-topmost').classList.toggle('active', state.settings.alwaysOnTop);
  $('#setting-adaptive-contrast').classList.toggle('active', adaptiveContrast);
  $('#setting-launch-at-login').classList.toggle('active', Boolean(storage?.launchAtLogin));
  $('#storage-path').value = storage?.path || '';
  $('#toggle-window-pin').classList.toggle('active', state.settings.windowLocked);
  $('#toggle-window-pin').textContent = state.settings.windowLocked ? '📌' : '📍';
  $('#toggle-window-pin').title = state.settings.windowLocked ? '窗口位置和尺寸已固定；点击取消固定' : '窗口可移动和缩放；点击固定';
  $('#setting-click-through').classList.toggle('active', clickThroughEnabled);
  $('#toggle-click-through').classList.toggle('active', clickThroughEnabled);
  $('#toggle-click-through').textContent = clickThroughEnabled ? '🔒' : '🔓';
  $('#toggle-click-through').title = clickThroughEnabled ? '已锁定交互；只有此锁可点击以恢复交互' : '锁定交互，让鼠标点击底层页面';
  renderCategoryControls();
  renderAnalytics();
  renderTrash();
  const list = $('#event-list');
  list.replaceChildren();
  const visibleEvents = sortEvents(events.filter((item) => shouldShowInQueue(item) && (activeCategory === 'all' || item.category === activeCategory)));
  if (!visibleEvents.length) {
    list.innerHTML = `<div class="empty">${events.length ? '这个类别暂时没有事件。' : '暂时没有事件。<br/>点击右下角 ＋ 开始吧。'}</div>`;
    return;
  }
  for (const item of visibleEvents) {
    const alert = eventAlert(item);
    const card = document.createElement('article');
    const category = categoryFor(item.category);
    const schedule = formatSchedule(item);
    card.className = `event category-${category.id} priority-${item.priority}${item.completed ? ' completed' : ''}${alert ? ` alert-${alert.tone}` : ''}`;
    card.style.setProperty('--event-category-color', category.color);
    card.innerHTML = `
      <button class="done" aria-label="${t('done', '完成事件')}">${item.completed ? '✓' : ''}</button>
      <div class="event-copy"><p class="event-title"></p><p class="event-meta">${schedule ? `<span>${schedule}</span>` : ''}<span class="category-chip">${category.label}</span></p>${alert ? `<p class="event-alert">${alert.label}</p>` : ''}</div>
      <div class="event-actions"><button class="edit" aria-label="${t('edit', '修改事件')}" title="${t('edit', '修改事件')}">✎</button><button class="delete" aria-label="${t('delete', '删除事件')}">×</button></div>`;
    card.querySelector('.event-title').textContent = item.title;
    card.querySelector('.done').addEventListener('click', async () => { state = await window.steward.updateEvent(item.id, { completed: !item.completed }); render(); });
    card.querySelector('.edit').addEventListener('click', () => openEventEditor(item));
    card.querySelector('.delete').addEventListener('click', async () => { state = await window.steward.deleteEvent(item.id); render(); });
    list.append(card);
  }
}

const sevenSegmentMap = {
  0: 'abcedf', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
  5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg'
};

function buildSevenSegmentClock(clock, value) {
  const fragment = document.createDocumentFragment();
  for (const character of value) {
    if (character === ':') {
      const colon = document.createElement('span');
      colon.className = 'seven-colon';
      colon.setAttribute('aria-hidden', 'true');
      fragment.append(colon);
      continue;
    }
    const digit = document.createElement('span');
    digit.className = 'seven-digit';
    digit.setAttribute('aria-hidden', 'true');
    for (const segmentName of 'abcdefg') {
      const segment = document.createElement('i');
      segment.className = `segment segment-${segmentName}${sevenSegmentMap[character]?.includes(segmentName) ? ' on' : ''}`;
      digit.append(segment);
    }
    fragment.append(digit);
  }
  clock.replaceChildren(fragment);
}

function renderClock() {
  const now = new Date();
  const clock = $('#clock');
  const value = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  clock.dateTime = now.toISOString();
  clock.setAttribute('aria-label', value);
  if (clock.dataset.value === value) return;
  if (!clock.children.length) buildSevenSegmentClock(clock, value);
  else {
    const digits = [...clock.querySelectorAll('.seven-digit')];
    const characters = [...value].filter((character) => character !== ':');
    if (digits.length !== characters.length) buildSevenSegmentClock(clock, value);
    else characters.forEach((character, index) => {
      const activeSegments = sevenSegmentMap[character] || '';
      for (const segmentName of 'abcdefg') {
        digits[index].querySelector(`.segment-${segmentName}`).classList.toggle('on', activeSegments.includes(segmentName));
      }
    });
  }
  clock.dataset.value = value;
}

function resetEventEditor() {
  editingEventId = null;
  $('#capture-sheet-title').textContent = '添加事件';
  $('#capture-button').textContent = '添加';
  $('#memo').value = '';
  $('#event-category').value = categories()[0].id;
  $('#event-priority').value = 'auto';
  $('#start-date').value = '';
  $('#start-time').value = '';
  $('#due-date').value = '';
  $('#due-time').value = '';
  $('#reminder-days').value = '1';
}

function openEventEditor(item) {
  editingEventId = item.id;
  $('#capture-sheet-title').textContent = '修改事件';
  $('#capture-button').textContent = '保存修改';
  $('#memo').value = item.title || '';
  $('#event-category').value = categoryFor(item.category).id;
  $('#event-priority').value = item.priority || 'normal';
  $('#start-date').value = item.startDate || dateInputValue(item.startAt);
  $('#start-time').value = timeInputValue(item.startAt);
  $('#due-date').value = item.dueDate || dateInputValue(item.dueAt);
  $('#due-time').value = timeInputValue(item.dueAt);
  $('#reminder-days').value = Number.isInteger(Number(item.reminderDays)) ? String(item.reminderDays) : '1';
  openSheet('capture-sheet');
}

async function capture() {
  const input = $('#memo');
  const startDate = $('#start-date').value || null;
  const dueDate = $('#due-date').value || null;
  const startAt = startDate && $('#start-time').value ? new Date(`${startDate}T${$('#start-time').value}`).toISOString() : null;
  const dueAt = dueDate && $('#due-time').value ? new Date(`${dueDate}T${$('#due-time').value}`).toISOString() : null;
  const category = $('#event-category').value;
  const priority = $('#event-priority').value;
  const reminderDays = Number($('#reminder-days').value) || 0;
  if (!isScheduleInputValid({ startDate, startAt, dueDate, dueAt })) {
    showToast('截止时间不能早于开始时间。');
    return;
  }
  if (editingEventId) {
    const title = input.value.trim();
    if (!title) { showToast('事件内容不能为空。'); return; }
    state = await window.steward.updateEvent(editingEventId, { title, category, priority: priority === 'auto' ? 'normal' : priority, startDate: startAt ? null : startDate, startAt, dueDate: dueAt ? null : dueDate, dueAt, reminderDays });
    resetEventEditor();
    render();
    closeSheet('capture-sheet');
    showToast('事件已修改。');
    return;
  }
  const result = await window.steward.captureEvent({ text: input.value, startDate, startAt, dueDate, dueAt, reminderDays, category, priority });
  if (result.state) { state = result.state; resetEventEditor(); render(); closeSheet('capture-sheet'); }
  showToast(result.summary);
}

function openSheet(id) {
  const sheet = $(`#${id}`);
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  if (id === 'capture-sheet') $('#memo').focus();
}

function closeSheet(id) {
  const sheet = $(`#${id}`);
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  if (id === 'capture-sheet') resetEventEditor();
}

function setupResizeHandles() {
  let resizeSession = null;
  for (const handle of document.querySelectorAll('.resize-handle')) {
    handle.addEventListener('pointerdown', async (event) => {
      event.preventDefault();
      const bounds = await window.steward.getWindowBounds();
      if (bounds.locked) return;
      resizeSession = { edge: handle.dataset.edge, startX: event.screenX, startY: event.screenY, startBounds: bounds };
      handle.setPointerCapture(event.pointerId);
    });
  }
  window.addEventListener('pointermove', (event) => {
    if (!resizeSession) return;
    const deltaX = Math.round(event.screenX - resizeSession.startX);
    const deltaY = Math.round(event.screenY - resizeSession.startY);
    window.steward.resizeWindow({ edge: resizeSession.edge, startBounds: resizeSession.startBounds, deltaX, deltaY });
  });
  window.addEventListener('pointerup', () => { resizeSession = null; });
}

async function boot() {
  const bootstrap = await window.steward.bootstrap();
  state = bootstrap.state;
  storage = bootstrap.storage;
  $('#department-status').textContent = `${bootstrap.departments.map((item) => item.name).join('、')}已就绪`;
  $('#category-filter').value = activeCategory;
  $('#sort-by').value = sortField;
  render();
  $('#capture-button').addEventListener('click', capture);
  $('#memo').addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') capture(); });
  $('#category-filter').addEventListener('change', (event) => { activeCategory = event.target.value; render(); });
  $('#add-category').addEventListener('click', async () => {
    const label = $('#new-category-label').value.trim();
    if (!label) { showToast('请先填写类别名称。'); return; }
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await saveCategories([...categories(), { id, label, color: $('#new-category-color').value }]);
    $('#new-category-label').value = '';
    showToast(`已添加类别：${label}`);
  });
  $('#toggle-categories').addEventListener('click', () => {
    const content = $('#category-manager-content');
    const expanded = !content.classList.toggle('collapsed');
    $('#toggle-categories').setAttribute('aria-expanded', String(expanded));
  });
  $('#sort-by').addEventListener('change', (event) => { sortField = event.target.value; render(); });
  $('#content-opacity').addEventListener('input', async (event) => { document.documentElement.style.setProperty('--content-opacity', event.target.value); state = await window.steward.setContentOpacity(event.target.value); });
  $('#background-opacity').addEventListener('input', async (event) => { state = await window.steward.setBackgroundOpacity(event.target.value); render(); });
  $('#theme-color').addEventListener('input', async (event) => { document.documentElement.style.setProperty('--accent-color', event.target.value); state = await window.steward.setThemeColor(event.target.value); render(); });
  $('#setting-adaptive-contrast').addEventListener('click', async () => { state = await window.steward.setAdaptiveContrast(!(state.settings.adaptiveContrast !== false)); render(); });
  $('#language').addEventListener('change', async (event) => { state = await window.steward.setLanguage(event.target.value); render(); });
  $('#setting-launch-at-login').addEventListener('click', async () => {
    storage = { ...storage, ...(await window.steward.setLaunchAtLogin(!storage?.launchAtLogin)) };
    render();
    showToast(storage.launchAtLogin ? '已设为开机自动运行。' : '已关闭开机自动运行。');
  });
  $('#choose-storage-path').addEventListener('click', async () => {
    const result = await window.steward.chooseStorageDirectory();
    if (result.error) { showToast(result.error); return; }
    if (result.canceled) return;
    state = result.state;
    storage = result.storage;
    render();
    showToast(result.unchanged ? '保存位置未变。' : '数据已迁移到新保存位置。');
  });
  $('#completed-visibility').addEventListener('change', async (event) => { state = await window.steward.setCompletedVisibility(event.target.value); render(); });
  const toggleWindowPin = async () => { state = await window.steward.toggleWindowLock(); render(); };
  $('#setting-window-lock').addEventListener('click', toggleWindowPin);
  $('#setting-topmost').addEventListener('click', async () => { state = await window.steward.toggleTopmost(); render(); });
  const toggleClickThrough = async (keepHotspotInteractive = false) => {
    clickThroughEnabled = await window.steward.toggleClickThrough(keepHotspotInteractive);
    render();
  };
  const collapseDockForInteractionLock = () => {
    $('#action-dock').classList.remove('expanded');
    $('#dock-toggle').setAttribute('aria-expanded', 'false');
    $('#dock-toggle').title = '展开并解除交互锁定';
    actionHotspotActive = false;
    scrollHotspotActive = false;
    if (clickThroughEnabled) window.steward.setClickThroughHotspot(false);
  };
  $('#setting-click-through').addEventListener('click', async () => {
    if (!clickThroughEnabled) {
      closeSheet('settings-sheet');
      collapseDockForInteractionLock();
    }
    await toggleClickThrough(false);
  });
  $('#toggle-window-pin').addEventListener('click', toggleWindowPin);
  $('#toggle-click-through').addEventListener('click', () => {
    if (!clickThroughEnabled) collapseDockForInteractionLock();
    actionHotspotActive = true;
    toggleClickThrough(true);
  });
  $('#open-capture').addEventListener('click', () => openSheet('capture-sheet'));
  $('#open-settings').addEventListener('click', () => openSheet('settings-sheet'));
  $('#dock-toggle').addEventListener('click', async () => {
    if (clickThroughEnabled) {
      actionHotspotActive = true;
      await toggleClickThrough(true);
      $('#action-dock').classList.add('expanded');
      $('#dock-toggle').setAttribute('aria-expanded', 'true');
      $('#dock-toggle').title = '收起快捷功能';
      return;
    }
    const dock = $('#action-dock');
    const expanded = !dock.classList.contains('expanded');
    dock.classList.toggle('expanded', expanded);
    $('#dock-toggle').setAttribute('aria-expanded', String(expanded));
    $('#dock-toggle').title = expanded ? '收起快捷功能' : '展开快捷功能';
  });
  $('#hide').addEventListener('click', () => window.steward.minimizeToOrb());
  const orb = $('#orb-restore');
  let orbPress = null;
  let suppressOrbClick = false;
  const moveOrb = () => window.steward.moveOrb();
  orb.addEventListener('mousedown', (event) => {
    if (!document.body.classList.contains('orb-mode')) return;
    event.preventDefault();
    const press = orbPress = { dragging: false, dragReady: false, startX: event.screenX, startY: event.screenY };
    window.steward.beginOrbDrag().then(() => {
      if (orbPress !== press) return;
      press.dragReady = true;
      if (press.dragging) moveOrb();
    });
  });
  window.addEventListener('mousemove', (event) => {
    if (!orbPress) return;
    if (!orbPress.dragging && Math.hypot(event.screenX - orbPress.startX, event.screenY - orbPress.startY) >= 3) {
      orbPress.dragging = true;
      orb.classList.add('dragging');
    }
    if (orbPress.dragging && orbPress.dragReady) moveOrb();
  });
  const finishOrbPress = () => {
    if (!orbPress) return;
    const dragged = orbPress.dragging;
    orbPress = null;
    orb.classList.remove('dragging');
    if (dragged) { window.steward.endOrbDrag(); suppressOrbClick = true; return; }
    window.steward.restoreFromOrb();
  };
  window.addEventListener('mouseup', finishOrbPress);
  orb.addEventListener('dragstart', (event) => event.preventDefault());
  orb.addEventListener('click', (event) => {
    if (suppressOrbClick) { suppressOrbClick = false; event.preventDefault(); return; }
    if (event.detail === 0) window.steward.restoreFromOrb();
  });
  $('#quit-app').addEventListener('click', () => window.steward.quit());
  $('#export-json').addEventListener('click', () => exportData('json'));
  $('#export-csv').addEventListener('click', () => exportData('csv'));
  $('#toggle-updates').addEventListener('click', () => {
    const button = $('#toggle-updates');
    const collapsed = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!collapsed));
    $('#release-list').classList.toggle('collapsed', collapsed);
  });
  for (const slider of [$('#content-opacity'), $('#background-opacity')]) {
    slider.addEventListener('pointerdown', () => $('#settings-sheet').classList.add('previewing'));
    slider.addEventListener('pointerup', () => $('#settings-sheet').classList.remove('previewing'));
    slider.addEventListener('pointercancel', () => $('#settings-sheet').classList.remove('previewing'));
  }
  window.addEventListener('pointerup', () => $('#settings-sheet').classList.remove('previewing'));
  document.querySelectorAll('.close-sheet').forEach((button) => button.addEventListener('click', () => closeSheet(button.dataset.close)));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelectorAll('.sheet.open').forEach((sheet) => closeSheet(sheet.id)); });
  const isPointerInside = (event, element) => {
    const rect = element.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  };
  const releaseScrollHotspot = () => {
    scrollHotspotReleaseTimer = null;
    if (!clickThroughEnabled || !scrollHotspotActive) return;
    scrollHotspotActive = false;
    window.steward.setClickThroughHotspot(actionHotspotActive);
  };
  const armScrollHotspot = (releaseDelay = 100) => {
    if (!clickThroughEnabled) return;
    if (!scrollHotspotActive) {
      scrollHotspotActive = true;
      window.steward.setClickThroughHotspot(true);
    }
    clearTimeout(scrollHotspotReleaseTimer);
    // Native Windows input must briefly target Memo to deliver a wheel event.
    // Return to click-through as soon as browsing pauses.
    scrollHotspotReleaseTimer = setTimeout(releaseScrollHotspot, releaseDelay);
  };
  const updateInteractionHotspots = (event) => {
    if (!clickThroughEnabled) return;
    const nextActionHotspot = isPointerInside(event, $('#dock-toggle'));
    const nextScrollHotspot = isPointerInside(event, $('#event-list')) || isPointerInside(event, $('#locked-scroll-rail'));
    // Give a newly-hovered card a brief window to receive the first wheel tick;
    // after actual scrolling, the shorter delay below takes over.
    if (nextScrollHotspot) armScrollHotspot(350);
    else if (scrollHotspotActive) releaseScrollHotspot();
    if (nextActionHotspot === actionHotspotActive) return;
    actionHotspotActive = nextActionHotspot;
    window.steward.setClickThroughHotspot(actionHotspotActive || scrollHotspotActive);
  };
  document.addEventListener('mousemove', updateInteractionHotspots);
  const browseLockedList = (event) => {
    if (!clickThroughEnabled) return;
    event.preventDefault();
    $('#event-list').scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' });
    armScrollHotspot(100);
  };
  $('#event-list').addEventListener('wheel', browseLockedList, { passive: false });
  $('#locked-scroll-rail').addEventListener('wheel', browseLockedList, { passive: false });
  $('.floating-actions').addEventListener('mouseleave', () => {
    if (!clickThroughEnabled || !actionHotspotActive) return;
    actionHotspotActive = false;
    window.steward.setClickThroughHotspot(scrollHotspotActive);
  });
  document.addEventListener('click', (event) => {
    if (!clickThroughEnabled || event.target.closest('#dock-toggle')) return;
    // The narrow browse rail temporarily receives pointer input for native
    // wheel scrolling, but no locked-mode click may edit Memo.
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.steward.onClickThroughChanged((enabled) => {
    clickThroughEnabled = enabled;
    if (enabled) collapseDockForInteractionLock();
    else { actionHotspotActive = false; scrollHotspotActive = false; }
    render();
  });
  window.steward.onOrbModeChanged((enabled) => document.body.classList.toggle('orb-mode', enabled));
  window.steward.onStateChanged((nextState) => {
    state = nextState;
    render();
  });
  renderClock();
  setInterval(renderClock, 1000);
  setupResizeHandles();
}

boot();
