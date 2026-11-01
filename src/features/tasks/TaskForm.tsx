import { useState } from 'react';
import { Dialog, useConfirm } from '../../components/Dialog';
import { api, errorMessage } from '../../lib/api';
import { weekdays } from '../../lib/format';
import { UrgencyFields } from '../../components/UrgencyFields';
import type { Category, Schedule, Task, TaskInput } from '../../types';

export function TaskForm({
  task,
  categories,
  defaultCategoryId = 1,
  today,
  onSaved,
  onClose,
}: {
  task?: Task;
  categories: Category[];
  defaultCategoryId?: number;
  today: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const initial: TaskInput = {
    notes: task?.notes ?? '',
    links: task?.links ?? [],
    activeMonths: task?.activeMonths ?? [],
    id: task?.id ?? null,
    title: task?.title ?? '',
    categoryId: task?.categoryId ?? defaultCategoryId,
    schedule: task?.schedule ?? { kind: 'relative', value: 7, unit: 'days' },
    trackingStartOn: task?.trackingStartOn ?? today,
    initialCompletedOn: null,
    comingUpDays: task?.comingUpDays ?? null,
    graceDays: task?.graceDays ?? null,
  };
  const [input, setInput] = useState(initial);
  const [linkText, setLinkText] = useState(initial.links.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const close = async () => {
    if (
      !busy &&
      ((JSON.stringify(input) === JSON.stringify(initial) &&
        linkText === initial.links.join('\n')) ||
        (await confirm('Discard your unsaved task changes?')))
    )
      onClose();
  };
  const update = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setInput((old) => ({ ...old, [key]: value }));
  return (
    <Dialog
      title={task ? 'Edit task' : 'Add a task'}
      onClose={() => void close()}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api.saveTask({
              ...input,
              links: linkText
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
            });
            await onSaved();
            onClose();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Task name
            <input
              autoFocus
              required
              maxLength={200}
              value={input.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Wash bedsheets"
            />
          </label>
          <label>
            Category
            <select
              value={input.categoryId}
              onChange={(e) => update('categoryId', Number(e.target.value))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Repeat
            <select
              value={input.schedule.kind}
              onChange={(e) =>
                update(
                  'schedule',
                  e.target.value === 'weekly'
                    ? { kind: 'weekly', weekday: 7 }
                    : { kind: 'relative', value: 7, unit: 'days' },
                )
              }
            >
              <option value="relative">After last completion</option>
              <option value="weekly">On a weekday</option>
            </select>
          </label>
          {input.schedule.kind === 'relative' ? (
            <div className="field-row">
              <label>
                Every
                <input
                  aria-label="Interval"
                  type="number"
                  required
                  min={1}
                  max={
                    { days: 3650, weeks: 520, months: 120 }[input.schedule.unit]
                  }
                  value={input.schedule.value}
                  onChange={(e) =>
                    update('schedule', {
                      ...input.schedule,
                      value: Number(e.target.value),
                    } as Schedule)
                  }
                />
              </label>
              <label>
                Unit
                <select
                  value={input.schedule.unit}
                  onChange={(e) =>
                    update('schedule', {
                      ...input.schedule,
                      unit: e.target.value,
                    } as Schedule)
                  }
                >
                  {['days', 'weeks', 'months'].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <>
              <label>
                Every
                <select
                  aria-label="Weekday"
                  value={input.schedule.weekday}
                  onChange={(e) =>
                    update('schedule', {
                      kind: 'weekly',
                      weekday: Number(e.target.value),
                    })
                  }
                >
                  {weekdays.map((d, i) => (
                    <option value={i + 1} key={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint">
                Early completion records what you did; the upcoming scheduled
                day remains due. Missed days stay overdue until completion.
              </p>
            </>
          )}
          {!task && (
            <label>
              Last completed <span className="muted">(optional)</span>
              <input
                type="date"
                min="0001-01-01"
                max={today}
                value={input.initialCompletedOn ?? ''}
                onChange={(e) =>
                  update('initialCompletedOn', e.target.value || null)
                }
              />
            </label>
          )}
          <details>
            <summary>Tracking start date</summary>
            <label>
              First due / start tracking
              <input
                type="date"
                required
                min="0001-01-01"
                max="9989-12-31"
                value={input.trackingStartOn}
                onChange={(e) => update('trackingStartOn', e.target.value)}
              />
            </label>
            <p className="hint">
              Tasks without completion history stay Not yet tracked. Record a
              completion to start tracking due dates; this date also sets the
              earliest weekly occurrence.
            </p>
          </details>
          <details>
            <summary>Personal urgency</summary>
            <UrgencyFields
              coming={input.comingUpDays}
              grace={input.graceDays}
              onChange={(comingUpDays, graceDays) =>
                setInput((old) => ({ ...old, comingUpDays, graceDays }))
              }
            />
          </details>
          <details>
            <summary>Seasonal months</summary>
            <p className="hint">
              Choose the months this task is relevant. Leave all unchecked for
              all year.
            </p>
            <div className="month-picker">
              {[
                'Jan',
                'Feb',
                'Mar',
                'Apr',
                'May',
                'Jun',
                'Jul',
                'Aug',
                'Sep',
                'Oct',
                'Nov',
                'Dec',
              ].map((month, i) => (
                <button
                  type="button"
                  key={month}
                  aria-pressed={input.activeMonths.includes(i + 1)}
                  className={input.activeMonths.includes(i + 1) ? 'chosen' : ''}
                  onClick={() =>
                    update(
                      'activeMonths',
                      input.activeMonths.includes(i + 1)
                        ? input.activeMonths.filter((m) => m !== i + 1)
                        : [...input.activeMonths, i + 1].sort((a, b) => a - b),
                    )
                  }
                >
                  {month}
                </button>
              ))}
            </div>
          </details>
          <details>
            <summary>Notes and links</summary>
            <label>
              Notes
              <textarea
                rows={5}
                maxLength={20000}
                value={input.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Instructions, model numbers, things to remember…"
              />
            </label>
            <label>
              Links (one per line)
              <textarea
                rows={3}
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="https://example.com/manual"
              />
            </label>
            <p className="hint">
              HTTP(S) links open in your browser only when you click them.
            </p>
          </details>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer className="dialog-footer">
          <button type="button" disabled={busy} onClick={() => void close()}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save task'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
