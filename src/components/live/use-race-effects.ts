"use client";

import { useEffect, useState } from "react";

import { FINISH_MS, IGNITION_SWEEP_MS, NEW_DRIVER_TAG_MS, PERIMETER_MS } from "./race-timing";

export type IgnitionPhase = "sweep" | "new" | null;
export interface RaceEffects {
  ignition: IgnitionPhase;
  /** Çevre çizgisi tur atıyor mu (kontağın ilk saniyeleri). */
  perimeter: boolean;
  /** Bitiş bayrağı gösteriliyor mu. */
  finish: boolean;
}

/**
 * Panelin yarış efektleri. `arrivedAt` gelecekte olabilir (sürücü değiştiyse bitiş bayrağından sonra başlar);
 * gecikme efekt içinde hesaplanır. Her olay kendi zamanlayıcılarını kurar ve temizler.
 */
export function useRaceEffects(arrivedAt: number | null, departedAt: number | null): RaceEffects {
  const [ignition, setIgnition] = useState<IgnitionPhase>(null);
  const [perimeter, setPerimeter] = useState(false);
  const [finish, setFinish] = useState(false);

  useEffect(() => {
    if (arrivedAt == null) return;
    const delay = Math.max(0, arrivedAt - Date.now());
    const timers = [
      setTimeout(() => {
        setIgnition("sweep");
        setPerimeter(true);
      }, delay),
      setTimeout(() => setIgnition("new"), delay + IGNITION_SWEEP_MS),
      setTimeout(() => setPerimeter(false), delay + PERIMETER_MS),
      setTimeout(() => setIgnition(null), delay + NEW_DRIVER_TAG_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [arrivedAt]);

  useEffect(() => {
    if (departedAt == null) return;
    const timers = [setTimeout(() => setFinish(true), 0), setTimeout(() => setFinish(false), FINISH_MS)];
    return () => timers.forEach(clearTimeout);
  }, [departedAt]);

  return { ignition, perimeter, finish };
}
