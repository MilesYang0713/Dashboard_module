let state;
let storage;
let activeCategory = 'all';
let sortField = 'time';
let clickThroughEnabled = false;
let actionHotspotActive = false;
let scrollHotspotActive = false;
let scrollHotspotReleaseTimer = null;
let editingEventId = null;
let backdropSampleTimer = null;
let backdropSamples = new Map();

const locale = () => state?.settings?.language === 'en' ? 'en' : 'zh-CN';
const translations = {
  en: {
    language: 'System language', settings: 'Display settings', add: 'Add event', save: 'Save changes',
    category: 'Category:', priority: 'Priority:', startDate: 'Start date', startTime: 'Start time', dueDate: 'Due date', dueTime: 'Due time',
    reminder: 'Advance reminder', dayDefault: 'days (default: 1)', dataPath: 'Data location', change: 'Change',
    completed: 'Completed items', hideNow: 'Hide immediately', todayEnd: 'Keep until today ends', keep24: 'Keep for 24 hours',
    lockWindow: 'Lock position and size', clickThrough: 'Lock interaction and click through', topmost: 'Always on top', launch: 'Launch at login', quit: 'Quit Memo',
    history: 'Update history', register: 'Event register', deleted: 'Deleted events', overview: 'Work overview', adaptive: 'Adaptive contrast',
    created: 'Created', updated: 'Updated', completedAction: 'Completed', reopened: 'Reopened', deletedAction: 'Deleted', restored: 'Restored', edit: 'Edit event', delete: 'Delete event', done: 'Complete event',
    filter: 'Filter', sortTime: 'Time', sortDue: 'Deadline', sortStart: 'Start', department: 'Memo events', ready: 'Ready',
    contentOpacity: 'Content opacity', backgroundOpacity: 'Background opacity', themeColor: 'Theme colour', categoryManager: 'Category manager', newCategory: 'New category name', addCategory: 'Add',
    total: 'Total', open: 'Open', complete: 'Done', completion: 'Completion', trend: 'Activity trend', last7: 'Last 7 days',
    work: 'Work', status: 'Status', action: 'Action', priority: 'Priority', noTime: 'No schedule', overdue: 'Overdue', started: 'Start time passed', within6: 'within 6 hours', within12: 'within 12 hours', daysUntil: 'days until', start: 'Start', deadline: 'deadline',
    registerEmpty: 'No event records yet.', statusDone: 'Done', statusOpen: 'Open', allDay: 'all day', noDeadline: 'None', restoreTodo: 'Reopen', restoredTodo: 'Reopened as open', moveTrash: 'Move to Bin', movedTrash: 'Moved to Bin',
    trashEmpty: 'Bin is empty.', deletedAt: 'Deleted', restore: 'Restore', restoredEvent: 'Event restored', purge: 'Delete forever', purged: 'Deleted forever', exportedTo: 'Exported to',
    openCount: 'open', noCategoryEvents: 'No events in this category.', noEvents: 'No events yet.', startAdding: 'Use the + button to begin.', windowPinned: 'Window position and size are locked; click to unlock', windowFree: 'Window can move and resize; click to lock',
    interactionLocked: 'Interaction is locked; click this lock to restore', interactionOpen: 'Lock interaction and click through', dockUnlock: 'Expand and unlock interaction', dockCollapse: 'Collapse quick actions', dockExpand: 'Expand quick actions',
    categoryName: 'category name', categoryColor: 'category colour', categoryDelete: 'Delete', keepOneCategory: 'Keep at least one category', invalidSchedule: 'Deadline cannot be before start time.', titleRequired: 'Event text is required.', eventUpdated: 'Event updated.', categoryRequired: 'Enter a category name first.', categoryAdded: 'Category added:', storageUnchanged: 'Data location unchanged.', storageMoved: 'Data moved to the new location.', launchEnabled: 'Launch at login enabled.', launchDisabled: 'Launch at login disabled.', completionDetail: 'completed', account: 'Account', accountEyebrow: 'ACCOUNT', localMode: 'Local mode', onlineOff: 'Online services are off', accountCopy: 'Your Memo data stays on this computer. Sign-in, licensing, subscriptions and cloud features will only be available after you explicitly enable online services.', comingSoon: 'Coming next', accountRoadmap: 'Account sign-in · License status · Subscription management · Major update alerts'
  },
  'zh-CN': {}
};
const t = (key, fallback) => translations[locale()]?.[key] || fallback;
const originalText = new WeakMap();
const bilingualText = {
  'Filter': { en: 'Filter', 'zh-CN': '筛选' }, '时间': { en: 'Time', 'zh-CN': '时间' }, '截止': { en: 'Deadline', 'zh-CN': '截止' }, '开始': { en: 'Start', 'zh-CN': '开始' },
  '备忘与事件部': { en: 'Memo events', 'zh-CN': '备忘与事件部' }, '类别：': { en: 'Category:', 'zh-CN': '类别：' }, '优先级：': { en: 'Priority:', 'zh-CN': '优先级：' },
  '提前提醒': { en: 'Advance reminder', 'zh-CN': '提前提醒' }, '天（默认 1 天）': { en: 'days (default: 1)', 'zh-CN': '天（默认 1 天）' }, '开始日期': { en: 'Start date', 'zh-CN': '开始日期' }, '开始时间': { en: 'Start time', 'zh-CN': '开始时间' }, '截止日期': { en: 'Due date', 'zh-CN': '截止日期' }, '截止时间': { en: 'Due time', 'zh-CN': '截止时间' },
  '内容透明度': { en: 'Content opacity', 'zh-CN': '内容透明度' }, '背景透明度': { en: 'Background opacity', 'zh-CN': '背景透明度' }, '主题颜色': { en: 'Theme colour', 'zh-CN': '主题颜色' }, '数据保存位置': { en: 'Data location', 'zh-CN': '数据保存位置' }, '更改': { en: 'Change', 'zh-CN': '更改' }, '完成后主页显示': { en: 'Completed items', 'zh-CN': '完成后主页显示' }, '立即隐藏': { en: 'Hide immediately', 'zh-CN': '立即隐藏' }, '保留到今天结束': { en: 'Keep until today ends', 'zh-CN': '保留到今天结束' }, '保留 24 小时': { en: 'Keep for 24 hours', 'zh-CN': '保留 24 小时' },
  '添加': { en: 'Add', 'zh-CN': '添加' }, '自动': { en: 'Automatic', 'zh-CN': '自动' }, '最高': { en: 'Highest', 'zh-CN': '最高' }, '高': { en: 'High', 'zh-CN': '高' }, '普通': { en: 'Normal', 'zh-CN': '普通' }, '已就绪': { en: 'Ready', 'zh-CN': '已就绪' }, '显示设置': { en: 'Display settings', 'zh-CN': '显示设置' }
};

function translateStaticText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const original = originalText.get(node) ?? node.nodeValue;
    originalText.set(node, original);
    const trimmed = original.trim(); const translation = bilingualText[trimmed]?.[locale()];
    if (translation) node.nodeValue = original.replace(trimmed, translation);
  }
}

function applyLanguage() {
  const en = locale() === 'en';
  document.documentElement.lang = en ? 'en' : 'zh-CN';
  document.documentElement.dataset.language = locale();
  translateStaticText();
  $('#language-label').textContent = t('language', '系统语言');
  $('#language').value = locale();
  $('#capture-sheet-title').textContent = editingEventId ? t('save', '修改事件') : t('add', '添加事件');
  $('#capture-button').textContent = editingEventId ? t('save', '保存修改') : t('add', '添加');
  const metricLabels = locale() === 'en' ? ['Total', 'Open', 'Done'] : ['全部', '待办', '完成'];
  document.querySelectorAll('.metric-grid span').forEach((element, index) => { element.textContent = metricLabels[index] || ''; });
  const registerLabels = locale() === 'en' ? ['Work', 'Category', 'Priority', 'Status', 'Created', 'Updated', 'Deadline', 'Action'] : ['工作', '类别', '优先级', '状态', '已创建', '已更新', '截止日期', '操作'];
  document.querySelectorAll('.event-register thead th').forEach((element, index) => { element.textContent = registerLabels[index] || ''; });
  const categoryHeading = $('#toggle-categories');
  if (categoryHeading) categoryHeading.setAttribute('aria-label', t('categoryManager', '类别管理'));
  $('#new-category-label').placeholder = t('newCategory', '新类别名称');
  $('#add-category').textContent = t('addCategory', '添加');
  const staticText = [['#settings-sheet h2', 'settings', '显示设置'], ['#setting-adaptive-contrast', 'adaptive', '自动对比色'], ['#setting-launch-at-login', 'launch', '开机自动运行'], ['#setting-window-lock', 'lockWindow', '固定窗口位置与尺寸'], ['#setting-click-through', 'clickThrough', '锁定交互并点击穿透'], ['#setting-topmost', 'topmost', '始终置顶'], ['#quit-app', 'quit', '退出备忘录']];
  for (const [selector, key, fallback] of staticText) { const element = $(selector); if (element) element.childNodes[0] ? element.childNodes[0].textContent = t(key, fallback) : element.textContent = t(key, fallback); }
  $('#open-account').title = t('account', '账户');
  $('#open-account').setAttribute('aria-label', t('account', '账户'));
  $('#account-eyebrow').textContent = t('accountEyebrow', '账户');
  $('#account-title').textContent = t('account', '账户');
  $('#account-mode').textContent = t('localMode', '本地模式');
  $('#account-status').textContent = t('onlineOff', '在线服务已关闭');
  $('#account-copy').textContent = t('accountCopy', '你的备忘录数据仅保存在此电脑。登录、授权、订阅和云端功能将在你主动开启在线服务后提供。');
  $('#account-roadmap-title').textContent = t('comingSoon', '即将支持');
  $('#account-roadmap-copy').textContent = t('accountRoadmap', '账户登录 · 授权状态 · 订阅管理 · 重大更新提醒');
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
const formatTime = (time) => time ? new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time)) : null;
const formatDateOnly = (date) => date ? new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)) : null;
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
  const created = item.createdAt ? `${t('created', '创建')} ${formatTime(item.createdAt)}` : null;
  const completed = item.completedAt ? `${t('completedAction', '完成')} ${formatTime(item.completedAt)}` : null;
  return [created, completed].filter(Boolean).join(' · ');
};

const priorityLabels = () => locale() === 'en' ? { high: 'Highest', medium: 'High', normal: 'Normal' } : { high: '最高', medium: '高', normal: '普通' };

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
  if (dueTime && dueTime < now) return { tone: 'overdue', label: `！${t('overdue', '已过截止时间')}` };
  if (startTime && startTime < now && !dueTime) return { tone: 'started', label: `！${t('started', '已过开始时间')}` };

  // The advance reminder follows the first upcoming moment: start when there
  // is one, otherwise deadline. After a start has passed, deadline is next.
  const nextKind = startTime != null && startTime >= now ? 'start' : dueTime != null ? 'due' : null;
  const nextTime = nextKind === 'start' ? startTime : dueTime;
  if (nextTime != null) {
    const hours = (nextTime - now) / 3_600_000;
    const verb = nextKind === 'start' ? t('start', '开始') : t('deadline', '截止');
    const tonePrefix = nextKind === 'start' ? 'start-' : '';
    if (hours <= 6) return { tone: `${tonePrefix}urgent`, label: locale() === 'en' ? `! ${verb} ${t('within6', 'within 6 hours')}` : `！6 小时内${verb}` };
    if (hours <= 12) return { tone: `${tonePrefix}soon`, label: locale() === 'en' ? `! ${verb} ${t('within12', 'within 12 hours')}` : `！12 小时内${verb}` };
    if (reminderDays > 0 && hours <= reminderDays * 24) return { tone: `${tonePrefix}reminder`, label: locale() === 'en' ? `! ${Math.ceil(hours / 24)} ${t('daysUntil', 'days until')} ${verb}` : `！提前提醒：${Math.ceil(hours / 24)} 天后${verb}` };
  }
  if (startTime && startTime < now) return { tone: 'started', label: `！${t('started', '已过开始时间')}` };
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
  $('#completion-detail').textContent = `${completed} / ${total} ${t('completionDetail', '完成')}`;

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
    cell.textContent = t('registerEmpty', '还没有事件记录。');
    row.append(cell);
    body.append(row);
    return;
  }
  for (const item of rows) {
    const row = document.createElement('tr');
    const values = [
      item.title,
      categoryFor(item.category).label,
      priorityLabels()[item.priority] || t('priority', '普通'),
      item.completed ? t('statusDone', '完成') : t('statusOpen', '待办'),
      formatTime(item.createdAt) || '—',
      formatTime(item.updatedAt || item.completedAt || item.createdAt) || '—',
      formatTime(item.dueAt) || (item.dueDate ? `${formatDateOnly(item.dueDate)} (${t('allDay', '全天')})` : t('noDeadline', '无'))
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
      reopen.textContent = t('restoreTodo', '恢复待办');
      reopen.addEventListener('click', async () => {
        state = await window.steward.updateEvent(item.id, { completed: false });
        render();
        showToast(t('restoredTodo', '已恢复为待办'));
      });
      actions.append(reopen);
    }
    const remove = document.createElement('button');
    remove.className = 'register-delete';
    remove.textContent = t('delete', '删除');
    remove.title = t('moveTrash', '移入回收站');
    remove.addEventListener('click', async () => {
      state = await window.steward.deleteEvent(item.id);
      render();
      showToast(t('movedTrash', '已移入回收站'));
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
    empty.textContent = t('trashEmpty', '回收站为空。');
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
    time.textContent = `${t('deletedAt', '删除于')} ${formatTime(item.deletedAt) || '—'}`;
    copy.append(title, time);
    const actions = document.createElement('div');
    const restore = document.createElement('button');
    restore.textContent = t('restore', '恢复');
    restore.addEventListener('click', async () => { state = await window.steward.restoreEvent(item.id); render(); showToast(t('restoredEvent', '已恢复事件')); });
    const purge = document.createElement('button');
    purge.className = 'purge';
    purge.textContent = t('purge', '永久删除');
    purge.addEventListener('click', async () => { state = await window.steward.purgeEvent(item.id); render(); showToast(t('purged', '已永久删除')); });
    actions.append(restore, purge);
    row.append(copy, actions);
    trash.append(row);
  }
}

async function exportData(format) {
  const result = await window.steward.exportEvents(format);
  if (!result.canceled) showToast(`${t('exportedTo', '已导出到')} ${result.filePath}`);
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
    label.setAttribute('aria-label', `${category.label} ${t('categoryName', '类别名称')}`);
    const color = document.createElement('input');
    color.type = 'color';
    color.value = category.color;
    color.setAttribute('aria-label', `${category.label} ${t('categoryColor', '类别颜色')}`);
    const update = () => {
      const next = currentCategories.map((item) => item.id === category.id ? { ...item, label: label.value.trim() || item.label, color: color.value } : item);
      saveCategories(next);
    };
    label.addEventListener('change', update);
    color.addEventListener('change', update);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = t('categoryDelete', '删除');
    remove.disabled = currentCategories.length === 1;
    remove.title = currentCategories.length === 1 ? t('keepOneCategory', '至少保留一个类别') : `${t('categoryDelete', '删除')} ${category.label}`;
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

function contrastTargets() {
  const targets = [];
  const add = (selector, key, glass = 0, fallbackThreshold = .43) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      targets.push({ element, key: `${key}-${index}`, glass, fallbackThreshold });
    });
  };
  add('.drag-region h1, .section-heading > span', 'header', 0, .34);
  add('.filter-control, .filter-control select, .sort-control', 'control', .08, .39);
  add('.event', 'event', .075, .43);
  add('.empty', 'empty', .04, .42);
  add('.toast', 'toast', 0, .46);
  return targets;
}

const mixRgb = (base, overlay, amount) => base.map((channel, index) => channel * (1 - amount) + overlay[index] * amount);
const relativeLuminance = (rgb) => rgb.map((channel) => {
  const value = channel / 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
}).reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
const contrastRatio = (first, second) => (Math.max(first, second) + .05) / (Math.min(first, second) + .05);

function prefersDarkInk(backdrop, glass) {
  const panelTint = [30, 27, 49];
  const panel = mixRgb(backdrop, panelTint, Number(state.settings.backgroundOpacity));
  const surface = mixRgb(panel, [255, 255, 255], glass * Number(state.settings.contentOpacity));
  const surfaceLuminance = relativeLuminance(surface);
  return contrastRatio(surfaceLuminance, relativeLuminance([20, 32, 57])) >= contrastRatio(surfaceLuminance, relativeLuminance([228, 231, 248]));
}

function applyIndividualContrast() {
  const adaptive = state.settings.adaptiveContrast !== false;
  const backgroundOpacity = Number(state.settings.backgroundOpacity);
  const contentOpacity = Number(state.settings.contentOpacity);
  const exposure = (1 - backgroundOpacity) * contentOpacity;
  contrastTargets().forEach(({ element, key, glass, fallbackThreshold }) => {
    const sampled = backdropSamples.get(key);
    // Until a native sample returns, retain the opacity-only fallback. The
    // normal path below uses the actual desktop colour behind this region.
    const darkInk = sampled ? prefersDarkInk(sampled, glass) : exposure >= fallbackThreshold;
    element.classList.toggle('contrast-dark-ink', adaptive && darkInk);
  });
}

function requestIndividualContrastSample() {
  applyIndividualContrast();
  clearTimeout(backdropSampleTimer);
  if (state.settings.adaptiveContrast === false || !window.steward?.sampleBackdropLuminance) return;
  backdropSampleTimer = setTimeout(async () => {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    const targets = contrastTargets();
    const sampleArea = (element) => {
      if (element.matches('.drag-region h1')) return element.closest('.drag-region').getBoundingClientRect();
      if (element.matches('.section-heading > span, .filter-control, .filter-control select, .sort-control')) return element.closest('.section-heading').getBoundingClientRect();
      return element.getBoundingClientRect();
    };
    const regions = targets.map(({ element, key }) => {
      const rect = sampleArea(element);
      return { id: key, x: rect.left / width, y: rect.top / height, width: rect.width / width, height: rect.height / height };
    }).filter((region) => region.width > 0 && region.height > 0);
    if (!regions.length) return;
    try {
      const samples = await window.steward.sampleBackdropLuminance(regions);
      backdropSamples = new Map(samples.map(({ id, r, g, b }) => [id, [r, g, b]]));
      applyIndividualContrast();
    } catch {
      // Keep the local opacity-based fallback if Windows cannot sample while
      // the desktop is transitioning or the Memo window is hidden.
    }
  }, 90);
}

function render() {
  applyLanguage();
  const events = state.events || [];
  $('#event-count').textContent = `${events.filter((item) => !item.completed).length} ${t('openCount', '项待办')}`;
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
  document.body.classList.toggle('window-unlocked', !state.settings.windowLocked);
  document.body.classList.toggle('interaction-scroll-locked', clickThroughEnabled);
  $('#setting-window-lock').classList.toggle('active', state.settings.windowLocked);
  $('#setting-topmost').classList.toggle('active', state.settings.alwaysOnTop);
  $('#setting-adaptive-contrast').classList.toggle('active', adaptiveContrast);
  $('#setting-launch-at-login').classList.toggle('active', Boolean(storage?.launchAtLogin));
  $('#storage-path').value = storage?.path || '';
  $('#toggle-window-pin').classList.toggle('active', state.settings.windowLocked);
  $('#toggle-window-pin').textContent = state.settings.windowLocked ? '📌' : '📍';
  $('#toggle-window-pin').title = state.settings.windowLocked ? t('windowPinned', '窗口位置和尺寸已固定；点击取消固定') : t('windowFree', '窗口可移动和缩放；点击固定');
  $('#setting-click-through').classList.toggle('active', clickThroughEnabled);
  $('#toggle-click-through').classList.toggle('active', clickThroughEnabled);
  $('#toggle-click-through').textContent = clickThroughEnabled ? '🔒' : '🔓';
  $('#toggle-click-through').title = clickThroughEnabled ? t('interactionLocked', '已锁定交互；只有此锁可点击以恢复交互') : t('interactionOpen', '锁定交互，让鼠标点击底层页面');
  renderCategoryControls();
  renderAnalytics();
  renderTrash();
  const list = $('#event-list');
  list.replaceChildren();
  const visibleEvents = sortEvents(events.filter((item) => shouldShowInQueue(item) && (activeCategory === 'all' || item.category === activeCategory)));
  if (!visibleEvents.length) {
    list.innerHTML = `<div class="empty">${events.length ? t('noCategoryEvents', '这个类别暂时没有事件。') : `${t('noEvents', '暂时没有事件。')}<br/>${t('startAdding', '点击右下角 ＋ 开始吧。')}`}</div>`;
    requestIndividualContrastSample();
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
  requestIndividualContrastSample();
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
  $('#capture-sheet-title').textContent = t('add', '添加事件');
  $('#capture-button').textContent = t('add', '添加');
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
  $('#capture-sheet-title').textContent = t('save', '修改事件');
  $('#capture-button').textContent = t('save', '保存修改');
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
    showToast(t('invalidSchedule', '截止时间不能早于开始时间。'));
    return;
  }
  if (editingEventId) {
    const title = input.value.trim();
    if (!title) { showToast(t('titleRequired', '事件内容不能为空。')); return; }
    state = await window.steward.updateEvent(editingEventId, { title, category, priority: priority === 'auto' ? 'normal' : priority, startDate: startAt ? null : startDate, startAt, dueDate: dueAt ? null : dueDate, dueAt, reminderDays });
    resetEventEditor();
    render();
    closeSheet('capture-sheet');
    showToast(t('eventUpdated', '事件已修改。'));
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
  let resizeFrame = 0;
  for (const handle of document.querySelectorAll('.resize-handle')) {
    handle.addEventListener('pointerdown', async (event) => {
      event.preventDefault();
      const bounds = await window.steward.getWindowBounds();
      if (bounds.locked) return;
      // Tauri reports native physical pixels while DOM pointer coordinates are
      // CSS pixels. Capture the ratio once so a left/top resize never fights
      // the window manager on high-DPI displays.
      resizeSession = { edge: handle.dataset.edge, startX: event.screenX, startY: event.screenY, startBounds: bounds, scaleX: bounds.width / Math.max(1, window.innerWidth), scaleY: bounds.height / Math.max(1, window.innerHeight), latestX: event.screenX, latestY: event.screenY };
      handle.setPointerCapture(event.pointerId);
    });
  }
  window.addEventListener('pointermove', (event) => {
    if (!resizeSession) return;
    resizeSession.latestX = event.screenX;
    resizeSession.latestY = event.screenY;
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!resizeSession) return;
      const deltaX = Math.round((resizeSession.latestX - resizeSession.startX) * resizeSession.scaleX);
      const deltaY = Math.round((resizeSession.latestY - resizeSession.startY) * resizeSession.scaleY);
      window.steward.resizeWindow({ edge: resizeSession.edge, startBounds: resizeSession.startBounds, deltaX, deltaY });
    });
  });
  window.addEventListener('pointerup', () => { resizeSession = null; if (resizeFrame) { cancelAnimationFrame(resizeFrame); resizeFrame = 0; } });
}

async function boot() {
  const bootstrap = await window.steward.bootstrap();
  state = bootstrap.state;
  storage = bootstrap.storage;
  $('#department-status').textContent = `${bootstrap.departments.map((item) => item.name).join(locale() === 'en' ? ', ' : '、')} ${t('ready', '已就绪')}`;
  $('#category-filter').value = activeCategory;
  $('#sort-by').value = sortField;
  render();
  $('#capture-button').addEventListener('click', capture);
  $('#memo').addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') capture(); });
  $('#category-filter').addEventListener('change', (event) => { activeCategory = event.target.value; render(); });
  $('#add-category').addEventListener('click', async () => {
    const label = $('#new-category-label').value.trim();
    if (!label) { showToast(t('categoryRequired', '请先填写类别名称。')); return; }
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await saveCategories([...categories(), { id, label, color: $('#new-category-color').value }]);
    $('#new-category-label').value = '';
    showToast(`${t('categoryAdded', '已添加类别：')} ${label}`);
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
    showToast(storage.launchAtLogin ? t('launchEnabled', '已设为开机自动运行。') : t('launchDisabled', '已关闭开机自动运行。'));
  });
  $('#choose-storage-path').addEventListener('click', async () => {
    const result = await window.steward.chooseStorageDirectory();
    if (result.error) { showToast(result.error); return; }
    if (result.canceled) return;
    state = result.state;
    storage = result.storage;
    render();
    showToast(result.unchanged ? t('storageUnchanged', '保存位置未变。') : t('storageMoved', '数据已迁移到新保存位置。'));
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
    $('#dock-toggle').title = t('dockUnlock', '展开并解除交互锁定');
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
  $('#open-account').addEventListener('click', () => openSheet('account-sheet'));
  $('#dock-toggle').addEventListener('click', async () => {
    if (clickThroughEnabled) {
      actionHotspotActive = true;
      await toggleClickThrough(true);
      $('#action-dock').classList.add('expanded');
      $('#dock-toggle').setAttribute('aria-expanded', 'true');
      $('#dock-toggle').title = t('dockCollapse', '收起快捷功能');
      return;
    }
    const dock = $('#action-dock');
    const expanded = !dock.classList.contains('expanded');
    dock.classList.toggle('expanded', expanded);
    $('#dock-toggle').setAttribute('aria-expanded', String(expanded));
    $('#dock-toggle').title = expanded ? t('dockCollapse', '收起快捷功能') : t('dockExpand', '展开快捷功能');
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
  const updateNativeLockRegions = async () => {
    if (!window.steward.setLockedInteractionRegions) return;
    const bounds = await window.steward.getWindowBounds();
    const scaleX = bounds.width / Math.max(1, window.innerWidth);
    const scaleY = bounds.height / Math.max(1, window.innerHeight);
    const toScreenRect = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: Math.round(bounds.x + rect.left * scaleX), top: Math.round(bounds.y + rect.top * scaleY), right: Math.round(bounds.x + rect.right * scaleX), bottom: Math.round(bounds.y + rect.bottom * scaleY) };
    };
    const unlockRect = $('#dock-toggle').getBoundingClientRect();
    window.steward.setLockedInteractionRegions({
      scroll: toScreenRect($('#event-list')),
      unlock: toScreenRect($('#dock-toggle')),
      // Used by the native input hook. Ratios remain correct on every Windows
      // DPI scale, unlike a CSS-pixel screen coordinate.
      unlockLocal: {
        left: unlockRect.left / Math.max(1, window.innerWidth), top: unlockRect.top / Math.max(1, window.innerHeight),
        right: unlockRect.right / Math.max(1, window.innerWidth), bottom: unlockRect.bottom / Math.max(1, window.innerHeight)
      }
    });
  };
  window.addEventListener('resize', updateNativeLockRegions);
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
    requestAnimationFrame(updateNativeLockRegions);
  });
  window.steward.onNativeLockedWheel?.(({ deltaY }) => {
    if (clickThroughEnabled) $('#event-list').scrollBy({ top: deltaY, left: 0, behavior: 'auto' });
  });
  window.steward.onNativeUnlockRequested?.(() => window.steward.unlockClickThrough?.());
  window.steward.onNativeUnlockHotspot?.(({ active }) => {
    // The original chevrons are the only interactive area in locked mode.
    actionHotspotActive = active;
    window.steward.setClickThroughHotspot(active);
  });
  window.steward.onUnlockDockRequested?.(() => {
    // Locked-mode unlock uses the same outcome as clicking the original
    // dock chevrons: restore interaction and open the quick-action drawer.
    $('#action-dock').classList.add('expanded');
    $('#dock-toggle').setAttribute('aria-expanded', 'true');
    $('#dock-toggle').title = t('dockCollapse', '收起快捷功能');
  });
  window.steward.onOrbModeChanged((enabled) => document.body.classList.toggle('orb-mode', enabled));
  window.steward.onStateChanged((nextState) => {
    state = nextState;
    render();
  });
  renderClock();
  setInterval(renderClock, 1000);
  setupResizeHandles();
  requestAnimationFrame(updateNativeLockRegions);
}

boot();
