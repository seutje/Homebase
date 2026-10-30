import type { Display, Schedule, Task } from '../types';

// Construct a local calendar date for formatting only; domain math is native.
export function fullDate(value: string, includeWeekday = false): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date.toLocaleDateString(undefined, {
    ...(includeWeekday ? { weekday: 'long' as const } : {}),
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function lastDone(task: Task, mode: Display): string {
  if (!task.lastCompletedOn) return 'Never completed';
  if (mode === 'date') return fullDate(task.lastCompletedOn);
  if (task.elapsedDays === 0) return 'Today';
  if (task.elapsedDays === 1) return 'Yesterday';
  return `${task.elapsedDays} days ago`;
}
export function dueLabel(task: Task): string {
  if (task.status === 'grace')
    return `Due within grace · ${actualDueLabel(task)}`;
  return actualDueLabel(task);
}
export function actualDueLabel(task: Task): string {
  if (task.daysUntilDue < 0)
    return `${-task.daysUntilDue} ${task.daysUntilDue === -1 ? 'day' : 'days'} overdue`;
  if (task.daysUntilDue === 0) return 'Due today';
  return `Due in ${task.daysUntilDue} ${task.daysUntilDue === 1 ? 'day' : 'days'}`;
}
export const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export function recurrence(schedule: Schedule): string {
  if (schedule.kind === 'weekly')
    return `Every ${weekdays[schedule.weekday - 1]}`;
  return `Every ${schedule.value === 1 ? schedule.unit.slice(0, -1) : `${schedule.value} ${schedule.unit}`}`;
}
