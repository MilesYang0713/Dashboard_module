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
