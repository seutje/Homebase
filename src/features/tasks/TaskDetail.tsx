import { useEffect, useState } from 'react';
import { useConfirm } from '../../components/Dialog';
import { api, errorMessage } from '../../lib/api';
import { dueLabel, fullDate, lastDone, recurrence } from '../../lib/format';
import { DateForm } from './DateForm';
import { CompletionActions } from './CompletionActions';
import type { Completion, Display, Task } from '../../types';

export function TaskDetail({
  task,
  display,
  today,
  busy,
  onDone,
  onBackdate,
  onSnooze,
  onEdit,
  onClose,
  onChanged,
}: {
  task: Task;
  display: Display;
  today: string;
  busy: boolean;
  onDone: () => void;
  onBackdate: () => void;
  onSnooze: () => void;
  onEdit: () => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [history, setHistory] = useState<Completion[] | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState<Completion | null>(null);
  const confirm = useConfirm();
  useEffect(() => {
    let cancelled = false;
    api
      .history(task.id)
      .then((rows) => {
        if (!cancelled) {
          setHistory(rows);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [task]);
  const removeHistory = async (entry: Completion) => {
    if (
      !(await confirm(
        `Delete the completion on ${fullDate(entry.completedOn)}?`,
      ))
    )
      return;
    setWorking(true);
    try {
      await api.deleteCompletion(entry.id);
      await onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <div
        className="detail-shade"
        onClick={() => {
          if (!working) onClose();
        }}
      />
      <aside className="detail-panel" aria-label="Task details">
        <header className="dialog-header">
          <p className="eyebrow">TASK DETAILS</p>
          <button
            className="icon-button"
            disabled={working}
            aria-label="Close details"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <h2>{task.title}</h2>
        {task.isOutOfSeason && <p className="state-label">Out of season</p>}
        {task.isSnoozed && task.snoozedUntil && (
          <p className="state-label">
            Snoozed until {fullDate(task.snoozedUntil)}
          </p>
        )}
        <p className="muted small">
          {task.categoryName} · {recurrence(task.schedule)}
        </p>
        {task.activeMonths.length > 0 && task.activeMonths.length < 12 && (
          <p className="hint">
            Active months:{' '}
            {task.activeMonths
              .map(
                (m) =>
                  [
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
                  ][m - 1],
              )
              .join(', ')}
          </p>
        )}
        <div className={`detail-timing ${task.status}`}>
          <div className="completion-value">
            <strong>{lastDone(task, display)}</strong>
            <span>{dueLabel(task)}</span>
          </div>
          <p className="hint">
            Last completed:{' '}
            {task.lastCompletedOn ? fullDate(task.lastCompletedOn) : 'Never'}
            <br />
            Next due: {fullDate(task.nextDue)}
          </p>
        </div>
        <CompletionActions
          busy={busy || working}
          onDone={onDone}
          onBackdate={onBackdate}
          onSnooze={onSnooze}
        />
        <button
          className="text-button detail-edit"
          disabled={working}
          onClick={onEdit}
        >
          Edit task
        </button>
        <h3>Completion history</h3>
        {task.recurrenceDue !== task.nextDue && (
          <p className="hint">
            Previously due {fullDate(task.recurrenceDue)}; carried forward to
            this season’s start on {fullDate(task.nextDue)}.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {history === null ? (
          <p className="hint">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="hint">
            No completions yet. Record one whenever you last did this.
          </p>
        ) : (
          <ol className="history">
            {history.map((entry) => (
              <li key={entry.id}>
                <span>{fullDate(entry.completedOn)}</span>
                <div>
                  <button disabled={working} onClick={() => setEditing(entry)}>
                    Edit date
                  </button>
                  <button
                    className="text-button"
                    disabled={working}
                    onClick={() => void removeHistory(entry)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <button
          className="danger delete-task"
          disabled={working || busy}
          onClick={async () => {
            if (
              !(await confirm(
                `Delete “${task.title}” and all its completion history?`,
              ))
            )
              return;
            setWorking(true);
            try {
              await api.deleteTask(task.id);
              await onChanged();
              onClose();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setWorking(false);
            }
          }}
        >
          Delete task
        </button>
      </aside>
      {editing && (
        <DateForm
          title="Correct completion date"
          date={editing.completedOn}
          today={today}
          onSave={async (value) => {
            await api.updateCompletion(editing.id, value);
            await onChanged();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
