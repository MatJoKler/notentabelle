export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void;
  /** Ausstehenden Aufruf sofort ausführen (z.B. vor dem Schließen der Seite). */
  flush(): void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): DebouncedFunction<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  const run = () => {
    timer = null;
    if (lastArgs === null) return;
    const args = lastArgs;
    lastArgs = null;
    fn(...args);
  };

  const debounced = (...args: Args) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, waitMs);
  };
  debounced.flush = () => {
    if (timer !== null) clearTimeout(timer);
    run();
  };
  return debounced;
}
