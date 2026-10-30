export function UrgencyFields({
  coming,
  grace,
  onChange,
  defaults = false,
}: {
  coming: number | null;
  grace: number | null;
  onChange: (coming: number | null, grace: number | null) => void;
  defaults?: boolean;
}) {
  return (
    <>
      <div className="field-row">
        <label>
          Coming up (days)
          <input
            type="number"
            min={0}
            max={365}
            placeholder={defaults ? 'Automatic' : 'Use app default'}
            value={coming ?? ''}
            onChange={(e) =>
              onChange(
                e.target.value === '' ? null : Number(e.target.value),
                grace,
              )
            }
          />
        </label>
        <label>
          Overdue grace (days)
          <input
            type="number"
            min={0}
            max={365}
            placeholder={defaults ? '0' : 'Use app default'}
            value={grace ?? ''}
            onChange={(e) =>
              onChange(
                coming,
                e.target.value === '' ? null : Number(e.target.value),
              )
            }
          />
        </label>
      </div>
      <p className="hint">
        Grace softens urgency without changing when the chore was due. Leave
        blank to{' '}
        {defaults
          ? 'use an automatic coming-up window'
          : 'inherit your app defaults'}
        .
      </p>
    </>
  );
}
