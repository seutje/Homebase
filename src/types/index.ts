export type Schedule =
  | { kind: 'relative'; value: number; unit: 'days' | 'weeks' | 'months' }
  | { kind: 'weekly'; weekday: number };
export type Status =
  'attention' | 'upcoming' | 'good' | 'grace' | 'snoozed' | 'outOfSeason';
export type UrgencyDefaults = {
  comingUpDays: number | null;
  graceDays: number;
};
export type Category = { id: number; name: string };
export type Task = {
  notes: string;
  links: string[];
  activeMonths: number[];
  isSnoozed: boolean;
  isOutOfSeason: boolean;
  recurrenceDue: string;
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
  snoozedUntil: string | null;
  comingUpDays: number | null;
  graceDays: number | null;
};
export type TaskInput = {
  notes: string;
  links: string[];
  activeMonths: number[];
  id: number | null;
  title: string;
  categoryId: number;
  schedule: Schedule;
  trackingStartOn: string;
  initialCompletedOn: string | null;
  comingUpDays: number | null;
  graceDays: number | null;
};
export type TaskList = {
  asOfDate: string;
  tasks: Task[];
  urgencyDefaults: UrgencyDefaults;
};
export type Display = 'relative' | 'date';
export type TemplateSelection = {
  key: string;
  value: number;
  unit: 'days' | 'weeks' | 'months';
  allowDuplicate: boolean;
};
export type Completion = { id: number; taskId: number; completedOn: string };
