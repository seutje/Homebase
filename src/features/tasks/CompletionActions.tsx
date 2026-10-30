export function CompletionActions({
  busy,
  onDone,
  onBackdate,
}: {
  busy: boolean;
  onDone: () => void;
  onBackdate: () => void;
}) {
  return (
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
  );
}
