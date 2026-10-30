import { invoke } from '@tauri-apps/api/core';
import type {
  Category,
  Display,
  TaskInput,
  TaskList,
  Completion,
} from '../types';

export const api = {
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
