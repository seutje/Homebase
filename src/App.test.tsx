import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { api } from './lib/api';
import type { Task } from './types';

let task: Task;
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  task = {
    id: 3,
    notes: '',
    links: [],
    activeMonths: [],
    isSnoozed: false,
    isOutOfSeason: false,
    recurrenceDue: '2026-10-28',
    title: 'Wash bedsheets',
    categoryId: 2,
    categoryName: 'Laundry',
    schedule: { kind: 'relative', value: 7, unit: 'days' },
    trackingStartOn: '2026-10-01',
    sourceTemplateKey: null,
    lastCompletedOn: '2026-10-21',
    elapsedDays: 9,
    nextDue: '2026-10-28',
    daysUntilDue: -2,
    status: 'attention',
    snoozedUntil: null,
    comingUpDays: null,
    graceDays: null,
  };
  vi.spyOn(api, 'tasks').mockImplementation(async () => ({
    asOfDate: '2026-10-30',
    tasks: [{ ...task }],
    urgencyDefaults: { comingUpDays: null, graceDays: 0 },
  }));
  vi.spyOn(api, 'categories').mockResolvedValue([
    { id: 1, name: 'Uncategorized' },
    { id: 2, name: 'Laundry' },
  ]);
  vi.spyOn(api, 'display').mockResolvedValue('relative');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('completion workflows', () => {
  it('combines optional notes search with category/status filtering and clear filters', async () => {
    const user = userEvent.setup();
    task.notes = 'Use Affresh tablet';
    render(<App />);
    await screen.findByText(/^9 days ago \(21\s.+\)$/);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search' }),
      'affresh',
    );
    await screen.findByText('Nothing here right now.');
    await user.click(screen.getByRole('checkbox', { name: 'Include notes' }));
    await screen.findByText(/^9 days ago \(21\s.+\)$/);
    await user.click(screen.getByRole('button', { name: /Laundry\s*1/ }));
    await user.click(
      screen.getByRole('button', { name: /1\s*Needs attention/ }),
    );
    expect(screen.getByText(/^9 days ago \(21\s.+\)$/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
  });
  it('snoozes without hiding completion age from All tasks, with a separate filter', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'snooze').mockImplementation(async (_id, until) => {
      task = {
        ...task,
        snoozedUntil: until,
        status: 'snoozed',
        isSnoozed: true,
      };
    });
    render(<App />);
    await screen.findByText(/^9 days ago \(21\s.+\)$/);
    await user.click(screen.getByRole('button', { name: /^Snooze$/ }));
    fireEvent.change(screen.getByLabelText('Snooze until'), {
      target: { value: '2026-11-03' },
    });
    await user.click(screen.getByRole('button', { name: 'Snooze task' }));
    await screen.findByText(/Snoozed until/);
    expect(screen.getByText(/^9 days ago \(21\s.+\)$/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Snoozed · 1' }));
    expect(screen.getByText(/^9 days ago \(21\s.+\)$/)).toBeVisible();
    expect(
      screen.getByRole('button', { name: /0\s*Needs attention/ }),
    ).toBeVisible();
  });
  it('records today after commit and undoes the exact inserted completion', async () => {
    const user = userEvent.setup();
    const record = vi.spyOn(api, 'record').mockImplementation(async () => {
      task = {
        ...task,
        lastCompletedOn: '2026-10-30',
        elapsedDays: 0,
        daysUntilDue: 7,
        status: 'good',
      };
      return { id: 81, inserted: true };
    });
    const remove = vi
      .spyOn(api, 'undoCompletion')
      .mockImplementation(async () => {
        task = {
          ...task,
          lastCompletedOn: '2026-10-21',
          elapsedDays: 9,
          daysUntilDue: -2,
          status: 'attention',
        };
      });
    render(<App />);
    await screen.findByText(/^9 days ago \(21\s.+\)$/);
    await user.click(screen.getByRole('button', { name: /^Done$/ }));
    await screen.findByText(/^Today \(30\s.+\)$/);
    expect(record).toHaveBeenCalledWith(3, '2026-10-30');
    await user.click(screen.getByRole('button', { name: /^Undo$/ }));
    await screen.findByText(/^9 days ago \(21\s.+\)$/);
    expect(remove).toHaveBeenCalledWith(81);
  });
  it('sends a backdated date without opening the detail panel; duplicates offer no undo', async () => {
    const user = userEvent.setup();
    const record = vi
      .spyOn(api, 'record')
      .mockResolvedValue({ id: 71, inserted: false });
    render(<App />);
    await screen.findByText(/^9 days ago \(21\s.+\)$/);
    await user.click(
      screen.getByRole('button', { name: 'Complete on another date' }),
    );
    fireEvent.change(screen.getByLabelText('Completed on'), {
      target: { value: '2026-10-21' },
    });
    await user.click(screen.getByRole('button', { name: 'Save completion' }));
    await screen.findByText('Already recorded on that date.');
    expect(record).toHaveBeenCalledWith(3, '2026-10-21');
    expect(screen.queryByRole('button', { name: /^Undo$/ })).toBeNull();
    expect(screen.queryByLabelText('Task details')).toBeNull();
  });
  it('keeps the previous completion visible when a write fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'record').mockRejectedValue({
      message: 'Disk is full. Free some space and retry.',
    });
    render(<App />);
    await screen.findByText(/^9 days ago \(21\s.+\)$/);
    await user.click(screen.getByRole('button', { name: /^Done$/ }));
    await screen.findByRole('alert');
    expect(screen.getByText(/^9 days ago \(21\s.+\)$/)).toBeVisible();
    expect(screen.queryByText(/^Today \(30\s.+\)$/)).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Done$/ })).toBeEnabled(),
    );
  });
});
