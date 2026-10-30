import { useEffect, useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Dialog, useConfirm } from '../../components/Dialog';
import { api, errorMessage } from '../../lib/api';
import { localToday } from '../../lib/format';
import type { Display, UrgencyDefaults } from '../../types';
import { UrgencyFields } from '../../components/UrgencyFields';

export function Settings({
  display,
  urgency,
  onSaved,
  onRestored,
  onClose,
}: {
  display: Display;
  urgency: UrgencyDefaults;
  onSaved: () => Promise<void>;
  onRestored: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [urgencyInput, setUrgencyInput] = useState(urgency);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [directory, setDirectory] = useState('');
  const confirm = useConfirm();
  useEffect(() => {
    api
      .directory()
      .then(setDirectory)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
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
          onChange={(e) =>
            void perform(async () => {
              await api.setDisplay(e.target.value as Display);
              await onSaved();
            })
          }
        >
          <option value="relative">Days ago — 9 days ago</option>
          <option value="date">Calendar date — October 21, 2026</option>
        </select>
      </label>
      <p className="hint">
        Your chosen format is always visible in the task list.
      </p>
      <section className="backup-settings">
        <h3>Default urgency</h3>
        <fieldset disabled={busy}>
          <UrgencyFields
            defaults
            coming={urgencyInput.comingUpDays}
            grace={urgencyInput.graceDays}
            onChange={(comingUpDays, graceDays) =>
              setUrgencyInput({ comingUpDays, graceDays: graceDays ?? 0 })
            }
          />
          <button
            onClick={() =>
              void perform(async () => {
                await api.saveUrgency(urgencyInput);
                await onSaved();
                setMessage('Urgency defaults saved.');
              })
            }
          >
            Save urgency defaults
          </button>
        </fieldset>
      </section>
      <section className="backup-settings">
        <h3>Your data, on your computer</h3>
        <p className="hint">
          Back up your tasks, categories, history, and preferences to a file you
          can keep wherever you like.
        </p>
        <div className="button-row">
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const path = await save({
                  title: 'Export Homebase backup',
                  defaultPath: `Homebase-${localToday()}.db`,
                  filters: [{ name: 'Homebase database', extensions: ['db'] }],
                });
                if (path) {
                  await api.exportBackup(path);
                  setMessage('Backup saved.');
                }
              })
            }
          >
            Export backup
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const path = await open({
                  title: 'Restore Homebase backup',
                  multiple: false,
                  directory: false,
                  filters: [{ name: 'Homebase database', extensions: ['db'] }],
                });
                if (!path) return;
                if (
                  !(await confirm(
                    'Replace your current tasks, categories, history, and preferences with this backup? Homebase will keep a pre-restore snapshot in your data folder.',
                  ))
                )
                  return;
                const safety = await api.restoreBackup(path);
                await onRestored();
                setMessage(`Backup restored. Previous data saved to ${safety}`);
              })
            }
          >
            Restore backup…
          </button>
        </div>
        <p className="hint data-path">
          {directory || 'Finding your data folder…'}
        </p>
        <button
          className="text-button"
          disabled={busy || !directory}
          onClick={() => void perform(() => api.openDirectory())}
        >
          Open data folder
        </button>
      </section>
      {busy && <p className="hint">Working…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      <div className="settings-about">
        <strong>Homebase · 0.1.0</strong>
        <p>
          A little less to remember.
          <br />
          Personal, local, and offline.
        </p>
      </div>
    </Dialog>
  );
}
