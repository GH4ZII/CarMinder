import { useCallback, useState } from 'react';

export function useApi<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>
): {
  data: T | null;
  error: Error | null;
  loading: boolean;
  run: (...args: A) => Promise<T | null>;
  reset: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (...args: A) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn(...args);
        setData(result);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fn]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, error, loading, run, reset };
}
