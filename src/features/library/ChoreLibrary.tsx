import { useState } from 'react';
import { Dialog, useConfirm } from '../../components/Dialog';
import catalog from '../../data/chore-templates.json';
import { api, errorMessage } from '../../lib/api';
import type { Task, TemplateSelection } from '../../types';

export function ChoreLibrary({
  tasks,
  onSaved,
  onClose,
}: {
  tasks: Task[];
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Record<string, TemplateSelection>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const close = async () => {
    if (
      !busy &&
      (!Object.keys(selected).length ||
        (await confirm('Discard your chore selections?')))
    )
      onClose();
  };
  const choose = async (template: (typeof catalog)[number]) => {
    if (selected[template.key]) {
      setSelected((old) => {
        const next = { ...old };
        delete next[template.key];
        return next;
      });
      return;
    }
    const duplicate = tasks.some((t) => t.sourceTemplateKey === template.key);
    if (
      duplicate &&
      !(await confirm(
        `${template.name} was already added. Add another independent copy, for example for another room?`,
      ))
    )
      return;
    setSelected((old) => ({
      ...old,
      [template.key]: {
        key: template.key,
        value: template.value,
        unit: template.unit as TemplateSelection['unit'],
        allowDuplicate: duplicate,
      },
    }));
  };
  return (
    <Dialog
      title="A few less things to think of"
      wide
      onClose={() => void close()}
    >
      <p className="hint">
        Choose a few suggested chores, then make the intervals your own. Nothing
        is added until you say so.
      </p>
      <label>
        Browse category
        <select
          value={category}
          disabled={busy}
          onChange={(e) => setCategory(e.target.value)}
        >
          {['All', ...new Set(catalog.map((t) => t.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="library-list">
        {catalog
          .filter((t) => category === 'All' || t.category === category)
          .map((template) => {
            const selection = selected[template.key];
            const duplicate = tasks.some(
              (t) => t.sourceTemplateKey === template.key,
            );
            return (
              <div
                className={`library-row ${selection ? 'chosen' : ''}`}
                key={template.key}
              >
                <label className="library-choice">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={!!selection}
                    onChange={() => void choose(template)}
                  />
                  <div>
                    <strong>{template.name}</strong>
                    <span>
                      {template.category}
                      {duplicate
                        ? ' · Already added — select to add another'
                        : ''}
                    </span>
                    <p>{template.suggestion}</p>
                  </div>
                </label>
                <fieldset className="field-row" disabled={busy || !selection}>
                  <label>
                    Every
                    <input
                      aria-label={`Interval for ${template.name}`}
                      type="number"
                      min={1}
                      max={
                        { days: 3650, weeks: 520, months: 120 }[
                          selection?.unit ??
                            (template.unit as TemplateSelection['unit'])
                        ]
                      }
                      value={selection?.value ?? template.value}
                      onChange={(e) =>
                        setSelected((old) => ({
                          ...old,
                          [template.key]: {
                            ...old[template.key],
                            value: Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Unit
                    <select
                      aria-label={`Unit for ${template.name}`}
                      value={selection?.unit ?? template.unit}
                      onChange={(e) =>
                        setSelected((old) => ({
                          ...old,
                          [template.key]: {
                            ...old[template.key],
                            unit: e.target.value as TemplateSelection['unit'],
                          },
                        }))
                      }
                    >
                      {['days', 'weeks', 'months'].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              </div>
            );
          })}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="dialog-footer">
        <span className="hint">{Object.keys(selected).length} selected</span>
        <button disabled={busy} onClick={() => void close()}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={busy || !Object.keys(selected).length}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await api.addTemplates(Object.values(selected));
              await onSaved();
              onClose();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Adding…' : 'Add selected chores'}
        </button>
      </footer>
    </Dialog>
  );
}
