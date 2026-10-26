const $ = (selector) => document.querySelector(selector);
let connected = false;

function showResult(message, tone = '') {
  const result = $('#result');
  result.textContent = message;
  result.className = `result ${tone}`;
}

function eventWhen(event) {
  const value = event.dueAt || event.dueDate || event.startAt || event.startDate;
  if (!value) return '未安排时间';
  const date = new Date(event.dueAt || event.startAt || `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: event.dueAt || event.startAt ? 'short' : undefined }).format(date);
}

function renderDepartments(departments, issues) {
  const target = $('#departments');
  target.replaceChildren();
  for (const department of departments) {
    const item = document.createElement('div');
    item.className = 'department';
    const actions = department.actions.map((action) => action.title || action.id).join('、');
    item.innerHTML = `<strong></strong><p></p><small></small>`;
    item.querySelector('strong').textContent = department.name;
    item.querySelector('p').textContent = department.description;
    item.querySelector('small').textContent = `已授权：${actions} · ${department.privacy?.network === 'none' ? '不联网' : '需查看隐私声明'}`;
    target.append(item);
  }
  $('#issues').textContent = issues.length ? `登记册提示：${issues.join(' ')}` : '';
}

function renderEvents(events) {
  $('#count').textContent = events.length ? `${events.length} 项` : '';
  const list = $('#events');
  list.replaceChildren();
  if (!events.length) {
    list.innerHTML = '<li class="muted">暂时没有待办事件。</li>';
    return;
  }
  for (const event of events) {
    const row = document.createElement('li');
    row.className = event.completed ? 'done' : '';
    row.innerHTML = '<strong></strong><span></span>';
    row.querySelector('strong').textContent = event.title;
    row.querySelector('span').textContent = `${eventWhen(event)} · ${event.category || 'task'}`;
    list.append(row);
  }
}

async function refreshOverview() {
  try {
    const overview = await window.stewardHub.overview();
    connected = overview.status === 'completed';
    $('#memo-status').textContent = connected ? 'Memo 已连接' : 'Memo 需要处理';
    $('#memo-status').className = `status ${connected ? 'online' : 'offline'}`;
    renderEvents(overview.events || []);
  } catch (error) {
    connected = false;
    $('#memo-status').textContent = 'Memo 未启动';
    $('#memo-status').className = 'status offline';
    renderEvents([]);
  }
}

async function capture(task) {
  try {
    const result = await task();
    showResult(result.summary || '已完成。', result.status === 'completed' ? 'success' : 'warning');
    if (result.status === 'completed') {
      $('#request').value = '';
      await refreshOverview();
    }
  } catch (error) {
    showResult(`${error.message} 请先点“启动 Memo”，等待它打开后再试。`, 'warning');
  }
}

async function boot() {
  const state = await window.stewardHub.bootstrap();
  renderDepartments(state.departments, state.issues);
  await refreshOverview();
  $('#capture').addEventListener('click', () => capture(() => window.stewardHub.captureMemo($('#request').value)));
  $('#clipboard').addEventListener('click', () => capture(() => window.stewardHub.captureClipboard()));
  $('#launch').addEventListener('click', async () => showResult((await window.stewardHub.launch('memo')).summary));
  $('#refresh').addEventListener('click', refreshOverview);
  $('#request').addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') capture(() => window.stewardHub.captureMemo($('#request').value)); });
}

boot().catch((error) => showResult(`总管启动失败：${error.message}`, 'warning'));
