import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { api, errorMessage } from '../../lib/api';
import type { Display } from '../../types';

export function Settings({
  display,
  onSaved,
  onClose,
}: {
  display: Display;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      title="Settings"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <label>
        Show last completion as
        <select
          disabled={busy}
          value={display}
          onChange={async (e) => {
            setBusy(true);
            try {
              await api.setDisplay(e.target.value as Display);
              await onSaved();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="relative">Days ago — 9 days ago</option>
          <option value="date">Calendar date — October 21, 2026</option>
        </select>
      </label>
      <p className="hint">
        Your chosen format is always visible in the task list.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-about">
        <strong>Homebase</strong>
        <p>
          A little less to remember.
          <br />
          Personal, local, and offline.
        </p>
      </div>
    </Dialog>
  );
}
