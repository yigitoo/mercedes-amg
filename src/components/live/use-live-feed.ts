"use client";

import { useEffect, useRef, useState } from "react";

import type { Driver, HeartRateSample, LiveSnapshot, VehicleId } from "@/domain/types";

/** Sparkline'da tutulan son ölçüm sayısı (1 Hz'de ~2 dakika). */
const HISTORY_LENGTH = 120;
/** Bu kadar süre snapshot gelmezse bağlantı "kopuk" sayılır. */
const STALE_AFTER_MS = 6_000;

export type FeedStatus = "connecting" | "live" | "degraded" | "offline";

/** Bir araca yeni sürücü bindi (ekran açıkken). Kontak animasyonu ve yayın bandı bunu dinler. */
export interface Arrival {
  /** Sürüş başına tekil: aynı sürüş iki kez kutlanmaz. */
  key: string;
  vehicleId: VehicleId;
  slot: number;
  plate: string;
  model: string;
  driver: Driver;
  /** İstemci saatiyle varış anı (animasyon zamanlaması için). */
  at: number;
}

export interface LiveFeed {
  snapshot: LiveSnapshot;
  /** Araç başına son nabız değerleri (eskiden yeniye). */
  history: Record<VehicleId, number[]>;
  status: FeedStatus;
  /** Ekran açıldıktan sonraki sürücü gelişleri, en yeni sonda. */
  arrivals: Arrival[];
  /** Son 60 saniyede gelen ölçüm sayısı (veri akışı göstergesi). */
  samplesPerMinute: number;
  /** Her snapshot'ta bir artar; akış göstergesinin ritmi. */
  tick: number;
}

const MAX_ARRIVALS = 20;

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
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const sessionsRef = useRef(new Map(initial.vehicles.map((v) => [v.id, v.sessionStartedAt])));
  const sampleTimesRef = useRef<number[]>([]);
  const [samplesPerMinute, setSamplesPerMinute] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    lastMessageAt.current = Date.now();
    const source = new EventSource("/api/stream");

    source.addEventListener("snapshot", (event) => {
      const next = JSON.parse((event as MessageEvent<string>).data) as LiveSnapshot;
      lastMessageAt.current = Date.now();
      const now = Date.now();
      setSnapshot(next);
      setTick((t) => t + 1);
      setStatus(next.stale ? "degraded" : "live");
      if (next.stale) return;

      const { values, added } = appendHistory(historyRef.current, next);
      setHistory(values);
      const times = sampleTimesRef.current;
      for (let i = 0; i < added; i++) times.push(now);
      while (times.length && now - times[0]! > 60_000) times.shift();
      setSamplesPerMinute(times.length);

      const fresh = detectArrivals(sessionsRef.current, next, now);
      if (fresh.length) setArrivals((list) => [...list, ...fresh].slice(-MAX_ARRIVALS));
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

  return { snapshot, history, status, arrivals, samplesPerMinute, tick };
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

/** Sürüş başlangıcı değişen ve sürücüsü olan araçlar = yeni biniş. Bilinen durum her çağrıda güncellenir. */
function detectArrivals(known: Map<VehicleId, number | null>, snapshot: LiveSnapshot, now: number): Arrival[] {
  const arrivals: Arrival[] = [];
  for (const v of snapshot.vehicles) {
    const previous = known.get(v.id);
    known.set(v.id, v.sessionStartedAt);
    if (v.driver && v.sessionStartedAt != null && v.sessionStartedAt !== previous) {
      arrivals.push({ key: `${v.id}:${v.sessionStartedAt}`, vehicleId: v.id, slot: v.slot, plate: v.plate, model: v.model, driver: v.driver, at: now });
    }
  }
  return arrivals;
}

function appendHistory(store: Map<VehicleId, HistoryEntry>, snapshot: LiveSnapshot): { values: Record<VehicleId, number[]>; added: number } {
  const result: Record<VehicleId, number[]> = {};
  let added = 0;
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
      added += 1;
    }
    result[vehicle.id] = entry.values;
  }
  return { values: result, added };
}
