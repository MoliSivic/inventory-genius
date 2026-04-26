import { useState, useEffect, useCallback } from "react";

/**
 * Like useState, but persists the value to localStorage under the given key.
 * Falls back to `defaultValue` when nothing is stored yet.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      /* ignore parse errors */
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota */
    }
  }, [key, value]);

  const setter = useCallback(
    (v: T | ((prev: T) => T)) => setValue(v),
    [],
  );

  return [value, setter];
}
