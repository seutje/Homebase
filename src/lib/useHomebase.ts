import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import { localToday } from './format';
import type { Category, Display, TaskList } from '../types';

export function useHomebase() {
  const [data, setData] = useState<TaskList | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [display, setDisplay] = useState<Display>('relative');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const [next, cats, pref] = await Promise.all([
        api.tasks(),
        api.categories(),
        api.display(),
      ]);
      if (request !== sequence.current) return;
      setData(next);
      setCategories(cats);
      setDisplay(pref);
      setError('');
    } catch (e) {
      if (request === sequence.current) setError(errorMessage(e));
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    // This loads external IPC data; all state updates occur after the awaited calls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    // A cheap local-date check also handles resume after a missed midnight.
    const interval = window.setInterval(() => {
      if (data && localToday() !== data.asOfDate) void refresh();
    }, 15_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data, refresh]);
  return { data, categories, display, error, setError, loading, refresh };
}
