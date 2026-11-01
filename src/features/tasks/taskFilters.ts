import type { Task } from '../../types';

export type SortMode = 'due' | 'overdue' | 'elapsed' | 'category' | 'alpha';
const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});
const titleOrder = (a: Task, b: Task) =>
  collator.compare(a.title, b.title) || a.id - b.id;
export function matchesSearch(
  task: Task,
  query: string,
  includeNotes: boolean,
): boolean {
  const text = query.trim().toLocaleLowerCase();
  return (
    !text ||
    [task.title, task.categoryName, ...(includeNotes ? [task.notes] : [])].some(
      (value) => value.toLocaleLowerCase().includes(text),
    )
  );
}
export function sortTasks(tasks: Task[], order: SortMode): Task[] {
  return [...tasks].sort((a, b) => {
    if (order === 'alpha') return titleOrder(a, b);
    if (order === 'category')
      return (
        collator.compare(a.categoryName, b.categoryName) || titleOrder(a, b)
      );
    if (order === 'elapsed') {
      if (a.elapsedDays === null || b.elapsedDays === null)
        return a.elapsedDays === b.elapsedDays
          ? titleOrder(a, b)
          : a.elapsedDays === null
            ? -1
            : 1;
      return b.elapsedDays - a.elapsedDays || titleOrder(a, b);
    }
    if (a.status === 'untracked' || b.status === 'untracked') {
      if (a.status === b.status) return titleOrder(a, b);
      return a.status === 'untracked' ? 1 : -1;
    }
    return a.daysUntilDue - b.daysUntilDue || titleOrder(a, b);
  });
}
