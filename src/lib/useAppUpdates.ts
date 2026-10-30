import { useCallback, useEffect, useRef, useState } from 'react';
import { updates, type AppUpdate } from './updates';

const initial = {
  update: null as AppUpdate | null,
  checking: false,
  installing: false,
  downloaded: 0,
  total: undefined as number | undefined,
  error: '',
  message: '',
};
export function useAppUpdates(automatic = import.meta.env.PROD) {
  const [state, setState] = useState(initial);
  const current = useRef<AppUpdate | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const checked = useRef(false);
  const dismissed = useRef('');
  const check = useCallback(async (manual = true) => {
    if (busy.current) return;
    busy.current = true;
    checked.current = true;
    setState((old) => ({ ...old, checking: true, error: '', message: '' }));
    try {
      let found = await updates.check();
      if (!alive.current) {
        await found?.close().catch(() => {});
        return;
      }
      if (found && !manual && found.version === dismissed.current) {
        await found.close().catch(() => {});
        found = null;
      }
      await current.current?.close().catch(() => {});
      if (!alive.current) {
        await found?.close().catch(() => {});
        return;
      }
      current.current = found;
      setState((old) => ({
        ...old,
        update: found,
        checking: false,
        error: '',
        message: !found && manual ? 'You are up to date.' : '',
      }));
    } catch {
      if (alive.current)
        setState((old) => ({
          ...old,
          checking: false,
          error: manual
            ? 'Could not check for updates. Check your connection and try again.'
            : '',
          message: '',
        }));
    } finally {
      busy.current = false;
    }
  }, []);
  const dismiss = useCallback(() => {
    if (busy.current) return;
    dismissed.current = current.current?.version ?? '';
    void current.current?.close().catch(() => {});
    current.current = null;
    setState((old) => ({ ...old, update: null, error: '', message: '' }));
  }, []);
  const install = useCallback(async () => {
    const update = current.current;
    if (!update || busy.current) return;
    busy.current = true;
    setState((old) => ({
      ...old,
      installing: true,
      error: '',
      message: '',
      downloaded: 0,
      total: undefined,
    }));
    try {
      await updates.install(update, (event) => {
        if (!alive.current) return;
        setState((old) =>
          event.event === 'Started'
            ? { ...old, downloaded: 0, total: event.data.contentLength }
            : event.event === 'Progress'
              ? { ...old, downloaded: old.downloaded + event.data.chunkLength }
              : { ...old, message: 'Verifying and starting the installer…' },
        );
      });
      // On Windows the plugin exits Homebase after launching the installer.
      if (alive.current)
        setState((old) => ({ ...old, message: 'Starting the installer…' }));
    } catch {
      busy.current = false;
      if (alive.current)
        setState((old) => ({
          ...old,
          installing: false,
          error:
            'The update could not be installed. Please try again. You can keep using Homebase.',
        }));
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void current.current?.close().catch(() => {});
      current.current = null;
    };
  }, []);
  useEffect(() => {
    if (!automatic) return;
    const first = setTimeout(() => {
      if (!checked.current) void check(false);
    }, 3000);
    const interval = setInterval(() => void check(false), 6 * 60 * 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [automatic, check]);
  return { ...state, check, dismiss, install };
}
export type AppUpdates = ReturnType<typeof useAppUpdates>;
