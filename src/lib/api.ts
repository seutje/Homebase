import { invoke } from '@tauri-apps/api/core';
import type {
  Category,
  Display,
  TaskInput,
  TaskList,
  Completion,
  TemplateSelection,
  UrgencyDefaults,
} from '../types';

export const api = {
  snooze: (id: number, until: string | null) =>
    invoke<void>('snooze_task', { id, until }),
  saveUrgency: (value: UrgencyDefaults) =>
    invoke<void>('save_urgency_defaults', { value }),
  undoCompletion: (id: number) => invoke<void>('undo_completion', { id }),
  exportBackup: (path: string) => invoke<void>('export_backup', { path }),
  restoreBackup: (path: string) => invoke<string>('restore_backup', { path }),
  directory: () => invoke<string>('get_data_directory'),
  openDirectory: () => invoke<void>('open_data_directory'),
  addTemplates: (selected: TemplateSelection[]) =>
    invoke<number[]>('add_templates', { selected }),
  history: (taskId: number) =>
    invoke<Completion[]>('list_completions', { taskId }),
  record: (taskId: number, completedOn: string) =>
    invoke<{ id: number; inserted: boolean }>('record_completion', {
      taskId,
      completedOn,
    }),
  updateCompletion: (id: number, completedOn: string) =>
    invoke<void>('update_completion', { id, completedOn }),
  deleteCompletion: (id: number) => invoke<void>('delete_completion', { id }),
  tasks: () => invoke<TaskList>('list_tasks'),
  categories: () => invoke<Category[]>('list_categories'),
  display: () => invoke<Display>('get_display'),
  setDisplay: (value: Display) => invoke<void>('set_display', { value }),
  saveTask: (input: TaskInput) => invoke<number>('save_task', { input }),
  deleteTask: (id: number) => invoke<void>('delete_task', { id }),
  saveCategory: (id: number | null, name: string) =>
    invoke<number>('save_category', { id, name }),
  deleteCategory: (id: number, moveTo: number) =>
    invoke<void>('delete_category', { id, moveTo }),
};

export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error)
    return String(error.message);
  if (typeof error === 'string') return error;
  return 'Could not connect to Homebase. Open the desktop app and try again.';
}
