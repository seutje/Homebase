import { useState } from 'react';
import { Dialog, useConfirm } from '../../components/Dialog';
import { api, errorMessage } from '../../lib/api';
import type { Category } from '../../types';

export function CategoryManager({
  categories,
  onSaved,
  onClose,
}: {
  categories: Category[];
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [id, setId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [moveTo, setMoveTo] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await onSaved();
      setId(null);
      setName('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const close = async () => {
    if (
      !busy &&
      (!name || (await confirm('Discard the category name you are editing?')))
    )
      onClose();
  };
  return (
    <Dialog title="Your categories" onClose={() => void close()}>
      <p className="hint">
        Organize chores in whatever way feels natural to you.
      </p>
      <div className="category-list">
        {categories.map((c) => (
          <button
            key={c.id}
            disabled={busy || c.id === 1}
            className={id === c.id ? 'selected' : ''}
            onClick={() => {
              setId(c.id);
              setName(c.name);
              setMoveTo(1);
            }}
          >
            {c.name}
            <span>{c.id === 1 ? 'Permanent' : 'Edit'}</span>
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void perform(() => api.saveCategory(id, name));
        }}
      >
        <fieldset disabled={busy}>
          <label>
            {id ? 'Rename category' : 'New category'}
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="button-row">
            <button className="primary">
              {id ? 'Save name' : 'Add category'}
            </button>
            {id && (
              <button
                type="button"
                onClick={() => {
                  setId(null);
                  setName('');
                }}
              >
                New category instead
              </button>
            )}
          </div>
          {id && (
            <div className="delete-section">
              <label>
                Move tasks to
                <select
                  value={moveTo}
                  onChange={(e) => setMoveTo(Number(e.target.value))}
                >
                  {categories
                    .filter((c) => c.id !== id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  if (
                    await confirm(
                      `Delete this category and move its tasks to ${categories.find((c) => c.id === moveTo)?.name}?`,
                    )
                  )
                    void perform(() => api.deleteCategory(id, moveTo));
                }}
              >
                Delete category
              </button>
            </div>
          )}
        </fieldset>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
