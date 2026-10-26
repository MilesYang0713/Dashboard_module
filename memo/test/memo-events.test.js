const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEvent } = require('../src/departments/memo-events');

test('extracts a relative day, afternoon time and high priority', () => {
  const event = parseEvent('明天下午 3 点紧急和张总开会', new Date('2026-10-15T09:00:00+11:00'));
  assert.equal(event.priority, 'high');
  assert.equal(new Date(event.dueAt).getHours(), 15);
  assert.match(event.title, /和张总开会/);
});

test('leaves date empty when the memo has no temporal information', () => {
  const event = parseEvent('下次例会准备报价单', new Date('2026-10-15T09:00:00+11:00'));
  assert.equal(event.dueAt, null);
});

test('uses a manually selected start and deadline over inferred time', () => {
  const event = parseEvent('明天下午 3 点写报告', new Date('2026-10-15T09:00:00+11:00'), {
    startAt: '2026-10-20T08:00:00.000Z',
    dueAt: '2026-10-21T08:00:00.000Z'
  });
  assert.equal(event.startAt, '2026-10-20T08:00:00.000Z');
  assert.equal(event.dueAt, '2026-10-21T08:00:00.000Z');
});

test('creates an initial activity record', () => {
  const event = parseEvent('整理会议纪要', new Date('2026-10-15T09:00:00+11:00'));
  assert.equal(event.history.length, 1);
  assert.equal(event.history[0].type, 'created');
  assert.equal(event.completedAt, null);
  assert.equal(event.updatedAt, event.createdAt);
});

test('uses the selected category when creating an event', () => {
  const event = parseEvent('买牛奶', new Date('2026-10-15T09:00:00+11:00'), { category: 'shopping' });
  assert.equal(event.category, 'shopping');
});

test('stores a date-only deadline and a custom reminder without inventing a time', () => {
  const event = parseEvent('提交申请', new Date('2026-10-15T09:00:00+11:00'), {
    dueDate: '2026-10-27',
    reminderDays: 7
  });
  assert.equal(event.dueDate, '2026-10-27');
  assert.equal(event.dueAt, null);
  assert.equal(event.reminderDays, 7);
});

test('understands mixed course, quiz and month.day notation without an API', () => {
  const event = parseEvent('5339 quizz 10.25', new Date(2026, 9, 23, 9, 0));
  assert.equal(event.courseCode, '5339');
  assert.equal(event.category, 'learning');
  assert.equal(event.dueDate, '2026-10-25');
  assert.equal(event.dueAt, null);
  assert.equal(event.title, '5339 quizz');
});

test('understands next-week Chinese weekdays and English clock time', () => {
  const event = parseEvent('下周五 5339 quiz at 3pm', new Date(2026, 9, 23, 9, 0));
  const deadline = new Date(event.dueAt);
  assert.equal(event.category, 'learning');
  assert.equal(deadline.getFullYear(), 2026);
  assert.equal(deadline.getMonth(), 9);
  assert.equal(deadline.getDate(), 30);
  assert.equal(deadline.getHours(), 15);
});

test('keeps date-only deadlines date-only and recognises important English or Chinese wording', () => {
  const event = parseEvent('明天考试截止日期蛮重要', new Date(2026, 9, 23, 9, 0));
  assert.equal(event.category, 'learning');
  assert.equal(event.priority, 'medium');
  assert.equal(event.dueDate, '2026-10-24');
  assert.equal(event.dueAt, null);
});

test('understands English month names and course identifiers', () => {
  const event = parseEvent('COMP5339 Quiz Oct 25 important', new Date(2026, 9, 23, 9, 0));
  assert.equal(event.courseCode, 'COMP5339');
  assert.equal(event.category, 'learning');
  assert.equal(event.priority, 'medium');
  assert.equal(event.dueDate, '2026-10-25');
});
