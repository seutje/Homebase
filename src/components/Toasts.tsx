import { useState } from 'react';
export function Toasts({
  toasts,
  remove,
}: {
  toasts: { key: number; text: string; undo?: () => Promise<void> }[];
  remove: (key: number) => void;
}) {
  const [pending, setPending] = useState<number[]>([]);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.key}>
          <span>{t.text}</span>
          {t.undo && (
            <button
              disabled={pending.includes(t.key)}
              onClick={async () => {
                setPending((ids) => [...ids, t.key]);
                try {
                  await t.undo?.();
                  remove(t.key);
                } catch {
                  /* The caller displays the error and keeps this undo available. */
                } finally {
                  setPending((ids) => ids.filter((id) => id !== t.key));
                }
              }}
            >
              Undo
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => remove(t.key)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
