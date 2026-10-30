import { useEffect, useRef, useState } from 'react';
type Toast = { key: number; text: string; undo?: () => Promise<void> };
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const remove = (key: number) =>
    setToasts((all) => all.filter((t) => t.key !== key));
  const notify = (text: string, undo?: () => Promise<void>) => {
    const key = ++next.current;
    setToasts((all) => [...all, { key, text, undo }]);
    timers.current.push(setTimeout(() => remove(key), 10_000));
  };
  return { toasts, notify, remove };
}
