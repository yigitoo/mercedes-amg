"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tarayıcıda (localStorage) hatırlanan küçük tercih, örn. kulenin sıralaması. Her ekran kendi tercihini tutar.
 * Depolama kapalıysa (gizli pencere, kiosk) sessizce varsayılana döner.
 */
export function useStoredState<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (value: T) => void] {
  const read = () => {
    try {
      const stored = window.localStorage.getItem(key) as T | null;
      return stored && allowed.includes(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const set = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // depolama kapalı: tercih yalnız bu oturumda geçerli olmaz, varsayılan kalır
      }
      window.dispatchEvent(new Event(STORAGE_EVENT));
    },
    [key],
  );
  return [value, set];
}

const STORAGE_EVENT = "amg-stored-state";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}
