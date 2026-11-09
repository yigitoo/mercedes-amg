"use client";

import { useEffect, useState } from "react";

export type IgnitionPhase = "sweep" | "new" | null;

const SWEEP_MS = 1_200;
const NEW_TAG_MS = 8_000;

/**
 * Kontak sekansı: sürücü bindiğinde gösterge önce sonuna kadar süpürür ("sweep"), sonra bir süre
 * "yeni sürücü" vurgusu kalır ("new"). `arrivedAt` değişince yeniden başlar; zamanlayıcılar temizlenir.
 */
export function useIgnition(arrivedAt: number | null): IgnitionPhase {
  const [phase, setPhase] = useState<IgnitionPhase>(null);

  useEffect(() => {
    if (arrivedAt == null) return;
    const timers = [
      setTimeout(() => setPhase("sweep"), 0),
      setTimeout(() => setPhase("new"), SWEEP_MS),
      setTimeout(() => setPhase(null), NEW_TAG_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [arrivedAt]);

  return phase;
}
