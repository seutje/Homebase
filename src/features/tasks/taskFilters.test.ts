import { describe, expect, it } from 'vitest';
import { matchesSearch, sortTasks } from './taskFilters';
import type { Task } from '../../types';

function task(
  id: number,
  title: string,
  elapsed: number | null,
  due: number,
  categoryName = 'Kitchen',
): Task {
  return {
    id,
    title,
    elapsedDays: elapsed,
    daysUntilDue: due,
    categoryName,
    notes: 'Use Affresh tablet',
    links: [],
    categoryId: 1,
    schedule: { kind: 'relative', value: 7, unit: 'days' },
    trackingStartOn: '2026-10-01',
    sourceTemplateKey: null,
    lastCompletedOn: elapsed === null ? null : '2026-10-21',
    nextDue: '2026-10-28',
    status: 'attention',
    snoozedUntil: null,
    comingUpDays: null,
    graceDays: null,
    activeMonths: [],
    isSnoozed: false,
    isOutOfSeason: false,
    recurrenceDue: '2026-10-28',
  };
}
describe('task search and ordering', () => {
  it('keeps untracked tasks after dated tasks for due sorts', () => {
    const untracked = {
      ...task(1, 'Untracked', null, -100),
      status: 'untracked' as const,
    };
    for (const order of ['due', 'overdue'] as const) {
      expect(
        sortTasks([untracked, task(2, 'Tracked', 1, 6)], order).map(
          (t) => t.id,
        ),
      ).toEqual([2, 1]);
    }
  });
  it('matches titles/categories case-insensitively and searches notes only when selected', () => {
    const value = task(1, 'Clean washer', 2, 5, 'Laundry');
    expect(matchesSearch(value, ' WASHER ', false)).toBe(true);
    expect(matchesSearch(value, 'laundry', false)).toBe(true);
    expect(matchesSearch(value, 'affresh', false)).toBe(false);
    expect(matchesSearch(value, 'AFFRESH', true)).toBe(true);
  });
  it('puts never-completed tasks first for longest-since-done, with stable ties', () => {
    const values = [
      task(3, 'Zulu', 3, -2),
      task(2, 'Alpha', null, 0),
      task(1, 'Alpha', null, 0),
      task(4, 'Old', 20, -10),
    ];
    expect(sortTasks(values, 'elapsed').map((t) => t.id)).toEqual([1, 2, 4, 3]);
    expect(values[0].id).toBe(3);
  });
  it('orders overdue dates, categories and titles without unstable equal-name rows', () => {
    const values = [
      task(3, 'Zulu', 1, 5, 'Bathrooms'),
      task(2, 'Alpha', 9, -2, 'Laundry'),
      task(1, 'Alpha', 15, -8, 'Kitchen'),
    ];
    expect(sortTasks(values, 'overdue').map((t) => t.id)).toEqual([1, 2, 3]);
    expect(sortTasks(values, 'category').map((t) => t.id)).toEqual([3, 1, 2]);
    expect(sortTasks(values, 'alpha').map((t) => t.id)).toEqual([1, 2, 3]);
  });
});
