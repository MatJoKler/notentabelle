import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('führt erst nach Ablauf der Wartezeit aus', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('mehrere Aufrufe innerhalb der Wartezeit bündeln sich', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced();
    vi.advanceTimersByTime(500);
    debounced();
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('flush führt ausstehenden Aufruf sofort aus', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced();
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('flush ohne ausstehenden Aufruf tut nichts', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  test('übergibt die Argumente des letzten Aufrufs', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced('a');
    debounced('b');
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledWith('b');
  });
});
