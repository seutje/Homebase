export function CompletionActions({
  busy,
  onDone,
  onBackdate,
  onSnooze,
}: {
  busy: boolean;
  onDone: () => void;
  onBackdate: () => void;
  onSnooze?: () => void;
}) {
  return (
    <div className="completion-actions-wrap">
      <div className="completion-actions">
        <button disabled={busy} onClick={onDone}>
          {busy ? 'Saving…' : 'Done'}
        </button>
        <button
          disabled={busy}
          aria-label="Complete on another date"
          title="Complete on another date"
          onClick={onBackdate}
        >
          ⌄
        </button>
      </div>
      {onSnooze && (
        <button
          className="text-button snooze-link"
          disabled={busy}
          onClick={onSnooze}
        >
          Snooze
        </button>
      )}
    </div>
  );
}
