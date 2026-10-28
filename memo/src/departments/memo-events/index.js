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

const englishMonths = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12
};

const englishWeekdays = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6
};

const chineseWeekdays = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 0 };

function dateKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function calendarDate(year, month, day) {
  const candidate = localDate(year, month, day, 12, 0);
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day ? candidate : null;
}

function startOfToday(now) {
  return localDate(now.getFullYear(), now.getMonth() + 1, now.getDate(), 0, 0);
}

function dateInDays(now, days) {
  const target = startOfToday(now);
  target.setDate(target.getDate() + days);
  return target;
}

function nextUnspecifiedYear(year, month, day, now) {
  const candidate = calendarDate(year, month, day);
  if (!candidate) return null;
  return candidate < startOfToday(now) ? calendarDate(year + 1, month, day) : candidate;
}

function mondayOfWeek(now) {
  const monday = startOfToday(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function weekdayDate(now, weekday, scope) {
  const target = mondayOfWeek(now);
  target.setDate(target.getDate() + ((weekday + 6) % 7) + (scope === 'next' ? 7 : 0));
  if (scope === 'nearest' && target < startOfToday(now)) target.setDate(target.getDate() + 7);
  return target;
}

function parseExplicitDate(text, now) {
  const chinese = text.match(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (chinese) return chinese[1] ? calendarDate(Number(chinese[1]), Number(chinese[2]), Number(chinese[3])) : nextUnspecifiedYear(now.getFullYear(), Number(chinese[2]), Number(chinese[3]), now);

  const iso = text.match(/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // 10.25 is deliberately month.day, so a course note like "5339 quiz 10.25"
  // stays unambiguous. Slash dates use the number above 12 to infer the order;
  // ambiguous forms such as 10/11 are left untouched rather than guessed.
  const dotted = text.match(/\b(\d{1,2})\.(\d{1,2})\b/);
  if (dotted) return nextUnspecifiedYear(now.getFullYear(), Number(dotted[1]), Number(dotted[2]), now);
  const slashed = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (slashed) {
    const first = Number(slashed[1]);
    const second = Number(slashed[2]);
    if (first > 12 && second <= 12) return nextUnspecifiedYear(now.getFullYear(), second, first, now);
    if (second > 12 && first <= 12) return nextUnspecifiedYear(now.getFullYear(), first, second, now);
  }

  const lower = text.toLowerCase();
  const monthFirst = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthFirst) return nextUnspecifiedYear(now.getFullYear(), englishMonths[monthFirst[1]], Number(monthFirst[2]), now);
  const dayFirst = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\b/);
  if (dayFirst) return nextUnspecifiedYear(now.getFullYear(), englishMonths[dayFirst[2]], Number(dayFirst[1]), now);
  return null;
}

function parseRelativeDate(text, now) {
  if (/后天|day after tomorrow/i.test(text)) return dateInDays(now, 2);
  if (/明天|tomorrow/i.test(text)) return dateInDays(now, 1);
  if (/今天|今晚|今早|today|tonight/i.test(text)) return dateInDays(now, 0);

  const chinese = text.match(/(下(?:个)?(?:周|星期)|(?:本|这)(?:周|星期))\s*([一二三四五六日天1-7])/);
  if (chinese) return weekdayDate(now, chineseWeekdays[chinese[2]], chinese[1].startsWith('下') ? 'next' : 'this');

  const english = text.match(/\b(next|this)\s+(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)\b/i);
  if (english) return weekdayDate(now, englishWeekdays[english[2].toLowerCase()], english[1].toLowerCase() === 'next' ? 'next' : 'this');

  const bareEnglish = text.match(/\b(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)\b/i);
  if (bareEnglish) return weekdayDate(now, englishWeekdays[bareEnglish[1].toLowerCase()], 'nearest');
  return null;
}

function parseTime(text) {
  const chinese = text.match(/(上午|下午|晚上|中午)?\s*(\d{1,2})\s*(?:点|时|:|：)\s*(\d{1,2})?/);
  if (chinese) {
    let hour = Number(chinese[2]);
    const minute = Number(chinese[3] || 0);
    if ((chinese[1] === '下午' || chinese[1] === '晚上') && hour < 12) hour += 12;
    if (chinese[1] === '中午' && hour < 11) hour += 12;
    return hour <= 23 && minute <= 59 ? { hour, minute } : null;
  }
  const english = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (english) {
    let hour = Number(english[1]);
    const minute = Number(english[2] || 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (english[3].toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (english[3].toLowerCase() === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }
  if (/\b(noon|midday)\b|中午/.test(text)) return { hour: 12, minute: 0 };
  if (/\b(morning)\b|上午|今早/.test(text)) return { hour: 9, minute: 0 };
  if (/\b(afternoon)\b|下午/.test(text)) return { hour: 15, minute: 0 };
  if (/\b(evening|tonight)\b|晚上|今晚/.test(text)) return { hour: 19, minute: 0 };
  return null;
}

function parseSchedule(text, now) {
  const date = parseExplicitDate(text, now) || parseRelativeDate(text, now);
  const time = parseTime(text);
  if (!date && !time) return { dueDate: null, dueAt: null };
  if (!time) return { dueDate: dateKey(date), dueAt: null };
  const target = date || startOfToday(now);
  return { dueDate: null, dueAt: localDate(target.getFullYear(), target.getMonth() + 1, target.getDate(), time.hour, time.minute).toISOString() };
}

function parseTitle(text) {
  const trimmed = text
    .replace(/(?:明天|后天|今天|今晚|今早|下(?:个)?(?:周|星期)[一二三四五六日天1-7]|(?:本|这)(?:周|星期)[一二三四五六日天1-7])/g, '')
    .replace(/\b(?:today|tomorrow|day after tomorrow|tonight|next|this)\s*(?:sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)?\b/gi, '')
    .replace(/(?:(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日号]?)/g, '')
    .replace(/\b20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}\b|\b\d{1,2}\.\d{1,2}\b|\b\d{1,2}\/(?:\d{1,2})\b/g, '')
    .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\b/gi, '')
    .replace(/(?:上午|下午|晚上|中午)?\s*\d{1,2}\s*(?:点|时|:|：)\s*\d{0,2}|\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    .replace(/\b(?:morning|afternoon|evening|noon|midday)\b/gi, '')
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

function scheduleTimestamp(event, kind) {
  const instantKey = kind === 'start' ? 'startAt' : 'dueAt';
  const dateKey = kind === 'start' ? 'startDate' : 'dueDate';
  if (event[instantKey]) return new Date(event[instantKey]).getTime();
  if (event[dateKey]) return new Date(`${event[dateKey]}T${kind === 'due' ? '23:59:59.999' : '00:00:00'}`).getTime();
  return null;
}

function hasValidSchedule(event) {
  const start = scheduleTimestamp(event, 'start');
  const due = scheduleTimestamp(event, 'due');
  return start == null || due == null || due >= start;
}

function inferCategory(text) {
  if (/买|采购|超市|购物|下单/.test(text)) return 'shopping';
  if (/学习|作业|课程|复习|考试|测验|小测|\b(?:quiz|quizz|test|exam|assignment|homework|course|lecture)\b/i.test(text)) return 'learning';
  if (/生活|家务|运动|医生|预约/.test(text)) return 'life';
  return 'task';
}

function inferCourseCode(text) {
  const match = text.match(/\b(?:[a-z]{2,8}\s*-?\s*\d{3,6}|\d{4,6})\b/i);
  return match ? match[0].replace(/\s+/g, '').toUpperCase() : null;
}

function parseEvent(text, now, overrides = {}) {
  const inferredPriority = /紧急|马上|立刻|\b(?:urgent|asap|immediately)\b/i.test(text) ? 'high' : /重要|尽快|\b(?:important|high priority)\b/i.test(text) ? 'medium' : 'normal';
  const priority = ['high', 'medium', 'normal'].includes(overrides.priority) ? overrides.priority : inferredPriority;
  const schedule = parseSchedule(text, now);
  return {
    id: crypto.randomUUID(),
    title: parseTitle(text),
    sourceText: text,
    startDate: validDate(overrides.startDate),
    startAt: validIso(overrides.startAt),
    dueDate: validDate(overrides.dueDate) || schedule.dueDate,
    dueAt: validIso(overrides.dueAt) || (validDate(overrides.dueDate) ? null : schedule.dueAt),
    reminderDays: validReminderDays(overrides.reminderDays),
    category: ['task', 'learning', 'shopping', 'life', 'other'].includes(overrides.category) ? overrides.category : inferCategory(text),
    priority,
    courseCode: inferCourseCode(text),
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
  if (!hasValidSchedule(event)) return { status: 'needs_input', summary: '截止时间不能早于开始时间，请调整日期或时间。', requiresApproval: false };
  const formatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' });
  const timing = event.dueAt ? `截止 ${formatter.format(new Date(event.dueAt))}` : event.dueDate ? `截止 ${dateFormatter.format(new Date(`${event.dueDate}T12:00:00`))}（全天）` : event.startAt ? `开始 ${formatter.format(new Date(event.startAt))}` : event.startDate ? `开始 ${dateFormatter.format(new Date(`${event.startDate}T12:00:00`))}（全天）` : '尚未指定时间';
  return { status: 'completed', event, summary: `已记录「${event.title}」，${timing}。`, requiresApproval: false };
}

module.exports = { manifest, execute, parseEvent, parseSchedule, hasValidSchedule };
