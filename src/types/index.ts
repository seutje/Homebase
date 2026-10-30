export type Schedule =
  | { kind: 'relative'; value: number; unit: 'days' | 'weeks' | 'months' }
  | { kind: 'weekly'; weekday: number };
export type Status = 'attention' | 'upcoming' | 'good';
export type Category = { id: number; name: string };
export type Task = {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string;
  schedule: Schedule;
  trackingStartOn: string;
  sourceTemplateKey: string | null;
  lastCompletedOn: string | null;
  elapsedDays: number | null;
  nextDue: string;
  daysUntilDue: number;
  status: Status;
};
export type TaskInput = {
  id: number | null;
  title: string;
  categoryId: number;
  schedule: Schedule;
  trackingStartOn: string;
  initialCompletedOn: string | null;
};
export type TaskList = { asOfDate: string; tasks: Task[] };
export type Display = 'relative' | 'date';
export type Completion = { id: number; taskId: number; completedOn: string };
