import { Dialog } from './Dialog';
import type { AppUpdates } from '../lib/useAppUpdates';

export function UpdateBanner({ updates }: { updates: AppUpdates }) {
  if (!updates.update) return null;
  return (
    <section className="update-banner">
      <div>
        <strong>Homebase {updates.update.version} is available</strong>
        <p>Homebase will close to install the update. Saved tasks are kept.</p>
        {updates.error && (
          <p className="error" role="alert">
            {updates.error}
          </p>
        )}
      </div>
      <div className="button-row">
        <button
          disabled={updates.checking || updates.installing}
          onClick={updates.dismiss}
        >
          Later
        </button>
        <button
          className="primary"
          disabled={updates.checking || updates.installing}
          onClick={() => void updates.install()}
        >
          Install update
        </button>
      </div>
    </section>
  );
}
export function UpdateSettings({ updates }: { updates: AppUpdates }) {
  return (
    <section className="backup-settings">
      <h3>App updates</h3>
      <p className="hint">
        Homebase automatically checks for signed releases when it starts and
        every six hours. Installation starts when you choose Install update.
      </p>
      <button
        disabled={updates.checking || updates.installing}
        onClick={() => void updates.check()}
      >
        {updates.checking ? 'Checking…' : 'Check for updates'}
      </button>
      {updates.update && (
        <div className="available-update">
          <p>
            Version {updates.update.version} is available. Homebase will close
            to install it.
          </p>
          {updates.update.body && (
            <details>
              <summary>Release notes</summary>
              <p className="plain-notes">{updates.update.body}</p>
            </details>
          )}
          <button
            className="primary"
            disabled={updates.checking || updates.installing}
            onClick={() => void updates.install()}
          >
            Install update
          </button>
        </div>
      )}
      {updates.message && !updates.installing && (
        <p className="hint" role="status">
          {updates.message}
        </p>
      )}
      {updates.error && (
        <p className="error" role="alert">
          {updates.error}
        </p>
      )}
    </section>
  );
}
export function UpdateProgress({ updates }: { updates: AppUpdates }) {
  if (!updates.installing) return null;
  const percent = updates.total
    ? Math.min(100, Math.round((updates.downloaded / updates.total) * 100))
    : undefined;
  return (
    <Dialog title="Updating Homebase" canClose={false} onClose={() => {}}>
      <p>Downloading and verifying the signed update…</p>
      <progress className="update-progress" max={100} value={percent} />
      <p className="hint">
        {percent !== undefined ? `${percent}% · ` : ''}
        {updates.message ||
          'Homebase will close and restart when the installer is ready.'}
      </p>
    </Dialog>
  );
}
