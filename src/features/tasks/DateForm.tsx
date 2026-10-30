import { useState } from 'react';
import { Dialog, useConfirm } from '../../components/Dialog';
import { errorMessage } from '../../lib/api';

export function DateForm({
  title,
  date,
  today,
  onSave,
  onClose,
}: {
  title: string;
  date: string;
  today: string;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(date);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const close = async () => {
    if (
      !busy &&
      (value === date || (await confirm('Discard the date change?')))
    )
      onClose();
  };
  return (
    <Dialog title={title} onClose={() => void close()}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave(value);
            onClose();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Completed on
          <input
            autoFocus
            type="date"
            required
            min="0001-01-01"
            max={today}
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog-footer">
          <button type="button" disabled={busy} onClick={() => void close()}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save completion
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
