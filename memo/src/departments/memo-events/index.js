const crypto = require('node:crypto');

const manifest = {
  id: 'memo-events',
  name: '备忘与事件部',
  version: '0.1.0',
  purpose: '把自然语言备忘转换为可排序的本地事件。',
  actions: ['capture'],
  permissions: ['local:event-storage'],
  input: 'text, nowISO',
  output: 'event, summary, requiresApproval'
};

function localDate(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function parseDueAt(text, now) {
  let target = new Date(now);
  let hasDate = false;
  const dateMatch = text.match(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (dateMatch) {
    target = localDate(Number(dateMatch[1] || now.getFullYear()), Number(dateMatch[2]), Number(dateMatch[3]), 9, 0);
    hasDate = true;
  } else if (/后天/.test(text)) {
    target.setDate(target.getDate() + 2);
    hasDate = true;
  } else if (/明天/.test(text)) {
    target.setDate(target.getDate() + 1);
    hasDate = true;
  } else if (/今天|今晚|今早|上午|下午|晚上|中午/.test(text)) {
    hasDate = true;
  }

  const timeMatch = text.match(/(上午|下午|晚上|中午)?\s*(\d{1,2})\s*(?:点|时|:|：)\s*(\d{1,2})?/);
  if (timeMatch) {
    let hour = Number(timeMatch[2]);
    const minute = Number(timeMatch[3] || 0);
    if ((timeMatch[1] === '下午' || timeMatch[1] === '晚上') && hour < 12) hour += 12;
    if (timeMatch[1] === '中午' && hour < 11) hour += 12;
    target.setHours(hour, minute, 0, 0);
    hasDate = true;
  }
  return hasDate ? target.toISOString() : null;
}

function parseTitle(text) {
  const trimmed = text
    .replace(/(?:明天|后天|今天|今晚|今早|下周[一二三四五六日天])/g, '')
    .replace(/(?:(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日号]?)/g, '')
    .replace(/(?:上午|下午|晚上|中午)?\s*\d{1,2}\s*(?:点|时|:|：)\s*\d{0,2}/g, '')
    .replace(/(?:提醒我|提醒|记得|帮我|请)/g, '')
    .replace(/[，,。！!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return trimmed || text.trim() || '未命名事件';
}

function validIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function validReminderDays(value) {
  const days = Number(value);
  return Number.isInteger(days) && days > 0 && days <= 365 ? days : 0;
}

function inferCategory(text) {
  if (/买|采购|超市|购物|下单/.test(text)) return 'shopping';
  if (/学习|作业|课程|复习|考试/.test(text)) return 'learning';
  if (/生活|家务|运动|医生|预约/.test(text)) return 'life';
  return 'task';
}

function parseEvent(text, now, overrides = {}) {
  const priority = /紧急|马上|立刻/.test(text) ? 'high' : /重要|尽快/.test(text) ? 'medium' : 'normal';
  return {
    id: crypto.randomUUID(),
    title: parseTitle(text),
    sourceText: text,
    startDate: validDate(overrides.startDate),
    startAt: validIso(overrides.startAt),
    dueDate: validDate(overrides.dueDate),
    dueAt: validIso(overrides.dueAt) || (validDate(overrides.dueDate) ? null : parseDueAt(text, now)),
    reminderDays: validReminderDays(overrides.reminderDays),
    category: ['task', 'learning', 'shopping', 'life', 'other'].includes(overrides.category) ? overrides.category : inferCategory(text),
    priority,
    completed: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
    history: [{ type: 'created', at: now.toISOString() }]
  };
}

async function execute(action, payload) {
  if (action !== 'capture') throw new Error(`未知动作：${action}`);
  const text = String(payload?.text || '').trim();
  if (!text) return { status: 'needs_input', summary: '请先告诉总管一件要记录的事。', requiresApproval: false };
  const now = payload?.nowISO ? new Date(payload.nowISO) : new Date();
  const event = parseEvent(text, now, payload);
  const formatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' });
  const timing = event.dueAt ? `截止 ${formatter.format(new Date(event.dueAt))}` : event.dueDate ? `截止 ${dateFormatter.format(new Date(`${event.dueDate}T12:00:00`))}（全天）` : event.startAt ? `开始 ${formatter.format(new Date(event.startAt))}` : event.startDate ? `开始 ${dateFormatter.format(new Date(`${event.startDate}T12:00:00`))}（全天）` : '尚未指定时间';
  return { status: 'completed', event, summary: `已记录「${event.title}」，${timing}。`, requiresApproval: false };
}

module.exports = { manifest, execute, parseEvent };
