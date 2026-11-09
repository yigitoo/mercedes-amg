"use client";

import { useEffect, useRef, useState } from "react";

import type { HeartRateSample, LiveSnapshot, VehicleId } from "@/domain/types";

/** Sparkline'da tutulan son ölçüm sayısı (1 Hz'de ~2 dakika). */
const HISTORY_LENGTH = 120;
/** Bu kadar süre snapshot gelmezse bağlantı "kopuk" sayılır. */
const STALE_AFTER_MS = 6_000;

export type FeedStatus = "connecting" | "live" | "degraded" | "offline";

export interface LiveFeed {
  snapshot: LiveSnapshot;
  /** Araç başına son nabız değerleri (eskiden yeniye). */
  history: Record<VehicleId, number[]>;
  status: FeedStatus;
}

interface HistoryEntry {
  /** Sürücü değişince geçmiş sıfırlanır; anahtar sürüş başlangıcıdır. */
  sessionKey: number | null;
  lastSampleAt: number | null;
  values: number[];
}

/**
 * /api/stream'e bağlanır ve her saniye gelen snapshot'ı tutar.
 * EventSource kopan bağlantıyı kendiliğinden yeniden kurar (sunucu `retry` süresiyle); burada yalnızca
 * durum izlenir ve snapshot uzun süre gelmezse ekrana "bağlantı yok" yansıtılır.
 */
export function useLiveFeed(initial: LiveSnapshot, initialHistory: Record<VehicleId, HeartRateSample[]> = {}): LiveFeed {
  const [snapshot, setSnapshot] = useState(initial);
  const [status, setStatus] = useState<FeedStatus>("connecting");
  // Açılış izi sunucudan gelir; sonrası akıştan büyür. Ref ve state aynı tohumdan kurulur.
  const [seed] = useState(() => seedHistory(initial, initialHistory));
  const historyRef = useRef(seed);
  const [history, setHistory] = useState<Record<VehicleId, number[]>>(() => valuesOf(seed));
  const lastMessageAt = useRef(0);

  useEffect(() => {
    lastMessageAt.current = Date.now();
    const source = new EventSource("/api/stream");

    source.addEventListener("snapshot", (event) => {
      const next = JSON.parse((event as MessageEvent<string>).data) as LiveSnapshot;
      lastMessageAt.current = Date.now();
      setSnapshot(next);
      if (!next.stale) setHistory(appendHistory(historyRef.current, next));
      setStatus(next.stale ? "degraded" : "live");
    });
    source.addEventListener("error", () => setStatus((s) => (s === "live" ? "connecting" : s)));

    const watchdog = setInterval(() => {
      if (Date.now() - lastMessageAt.current > STALE_AFTER_MS) setStatus("offline");
    }, 1_000);

    return () => {
      clearInterval(watchdog);
      source.close();
    };
  }, []);

  return { snapshot, history, status };
}

function seedHistory(snapshot: LiveSnapshot, initial: Record<VehicleId, HeartRateSample[]>): Map<VehicleId, HistoryEntry> {
  const store = new Map<VehicleId, HistoryEntry>();
  for (const vehicle of snapshot.vehicles) {
    const samples = initial[vehicle.id] ?? [];
    store.set(vehicle.id, {
      sessionKey: vehicle.sessionStartedAt,
      lastSampleAt: samples.at(-1)?.at ?? null,
      values: samples.slice(-HISTORY_LENGTH).map((s) => s.bpm),
    });
  }
  return store;
}

function valuesOf(store: Map<VehicleId, HistoryEntry>): Record<VehicleId, number[]> {
  return Object.fromEntries([...store].map(([id, entry]) => [id, entry.values]));
}

function appendHistory(store: Map<VehicleId, HistoryEntry>, snapshot: LiveSnapshot): Record<VehicleId, number[]> {
  const result: Record<VehicleId, number[]> = {};
  for (const vehicle of snapshot.vehicles) {
    let entry = store.get(vehicle.id);
    if (!entry || entry.sessionKey !== vehicle.sessionStartedAt) {
      entry = { sessionKey: vehicle.sessionStartedAt, lastSampleAt: null, values: [] };
      store.set(vehicle.id, entry);
    }
    // Aynı ölçümü iki kez eklememek için yalnız yeni örnekte büyür.
    if (vehicle.bpm != null && vehicle.sampleAt !== entry.lastSampleAt) {
      entry.values = [...entry.values, vehicle.bpm].slice(-HISTORY_LENGTH);
      entry.lastSampleAt = vehicle.sampleAt;
    }
    result[vehicle.id] = entry.values;
  }
  return result;
}
