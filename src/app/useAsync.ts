/**
 * The two data hooks every screen uses.
 *
 * `useAsync` covers reads: it exposes the same loading/error/data shape the
 * Flutter app gets from a FutureProvider's `.when()`, so screens are written
 * the same way in both codebases.
 *
 * `useAction` covers writes: it tracks a pending flag, surfaces the Arabic
 * error message a repository threw, and lets the caller refresh reads on
 * success.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  /** Re-runs the loader. Safe to pass straight to an onClick. */
  reload: () => void;
  /** Replaces the data locally without a round trip, for optimistic updates. */
  setData: (next: T) => void;
}

/**
 * Runs `loader` on mount and whenever `deps` change.
 *
 * The result of a stale run is discarded, so quickly changing a filter can
 * never leave an older response on screen.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const runIdRef = useRef(0);

  // The loader is a fresh closure every render; deps are the real trigger.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    let cancelled = false;

    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (cancelled || runIdRef.current !== runId) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled || runIdRef.current !== runId) return;
        setError(err instanceof Error ? err.message : 'صار خطأ غير متوقع');
      })
      .finally(() => {
        if (cancelled || runIdRef.current !== runId) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload, setData };
}

export interface ActionState {
  pending: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Wraps a mutation. Returns a runner plus its pending/error state.
 *
 * The runner resolves to `true` on success and `false` on failure, so callers
 * can close a dialog only when the write actually landed.
 */
export function useAction(): [
  <T>(fn: () => Promise<T>, onSuccess?: (result: T) => void) => Promise<boolean>,
  ActionState,
] {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, onSuccess?: (result: T) => void): Promise<boolean> => {
      setPending(true);
      setError(null);
      try {
        const result = await fn();
        onSuccess?.(result);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'صار خطأ غير متوقع');
        return false;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);
  return [run, { pending, error, clearError }];
}

/** Debounces a value — used by every search box so typing does not spam reads. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
