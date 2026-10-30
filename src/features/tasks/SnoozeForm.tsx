import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { errorMessage } from '../../lib/api';
import type { Task } from '../../types';

export function SnoozeForm({
  task,
  today,
  onSave,
  onClose,
}: {
  task: Task;
  today: string;
  onSave: (until: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [until, setUntil] = useState(
    task.status === 'snoozed' ? task.snoozedUntil! : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (value: string | null) => {
    setBusy(true);
    try {
      await onSave(value);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={`Snooze ${task.title}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(until);
        }}
      >
        <p className="hint">
          Give this chore a little space. Its last completion and actual due
          date stay the same.
        </p>
        <label>
          Snooze until
          <input
            type="date"
            required
            min={today}
            max="9999-12-31"
            value={until}
            disabled={busy}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog-footer">
          {task.status === 'snoozed' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(null)}
            >
              Unsnooze
            </button>
          )}
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Snooze task
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
