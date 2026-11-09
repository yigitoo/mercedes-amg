"use client";

import { useEffect, useRef, useState } from "react";

import type { Driver, HeartRateSample, LiveSnapshot, LiveVehicle, VehicleId } from "@/domain/types";

/** Sparkline'da tutulan son ölçüm sayısı (1 Hz'de ~2 dakika). */
const HISTORY_LENGTH = 120;
/** Bu kadar süre snapshot gelmezse bağlantı "kopuk" sayılır. */
const STALE_AFTER_MS = 6_000;

export type FeedStatus = "connecting" | "live" | "degraded" | "offline";
/** Canlı akışın taşıması: WebSocket (/api/ws) ya da Server-Sent Events (/api/stream). */
export type Transport = "ws" | "sse";

/** Bir araçta sürüş bitti (sürücü indi ya da değişti). Bitiş bayrağı ve yayın bandı bunu dinler. */
export interface Departure {
  /** Sürüş başına tekil. */
  key: string;
  vehicleId: VehicleId;
  slot: number;
  plate: string;
  model: string;
  driver: Driver;
  /** Bitiş anındaki sürüş özeti (son bilinen değerler). */
  durationMs: number;
  avg: number | null;
  max: number | null;
  at: number;
}

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
  /** Ekran açıldıktan sonra biten sürüşler, en yeni sonda. */
  departures: Departure[];
  /** Son 60 saniyede gelen ölçüm sayısı (veri akışı göstergesi). */
  samplesPerMinute: number;
  /** Her snapshot'ta bir artar; akış göstergesinin ritmi. */
  tick: number;
  /** O an kullanılan taşıma (WebSocket açılamazsa tercih "ws" iken bile "sse" olur). */
  transport: Transport;
}

const MAX_ARRIVALS = 20;

interface HistoryEntry {
  /** Sürücü değişince geçmiş sıfırlanır; anahtar sürüş başlangıcıdır. */
  sessionKey: number | null;
  lastSampleAt: number | null;
  values: number[];
}

/**
 * Canlı akışa bağlanır (tercihe göre WebSocket ya da SSE, bkz. connectLive) ve her saniye gelen snapshot'ı tutar.
 * Bağlantı kendiliğinden yeniden kurulur; burada yalnızca durum izlenir ve snapshot uzun süre gelmezse ekrana
 * "bağlantı yok" yansıtılır.
 */
export function useLiveFeed(
  initial: LiveSnapshot,
  initialHistory: Record<VehicleId, HeartRateSample[]> = {},
  preferred: Transport = "ws",
): LiveFeed {
  const [snapshot, setSnapshot] = useState(initial);
  const [status, setStatus] = useState<FeedStatus>("connecting");
  // Açılış izi sunucudan gelir; sonrası akıştan büyür. Ref ve state aynı tohumdan kurulur.
  const [seed] = useState(() => seedHistory(initial, initialHistory));
  const historyRef = useRef(seed);
  const [history, setHistory] = useState<Record<VehicleId, number[]>>(() => valuesOf(seed));
  const lastMessageAt = useRef(0);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  // Araç başına son görülen durum: biniş/iniş farkı ve bitiş özeti buradan çıkarılır.
  const knownRef = useRef(new Map(initial.vehicles.map((v) => [v.id, v])));
  const sampleTimesRef = useRef<number[]>([]);
  const latestGeneratedAtRef = useRef(initial.generatedAt);
  const [samplesPerMinute, setSamplesPerMinute] = useState(0);
  const [tick, setTick] = useState(0);
  const [transport, setTransport] = useState<Transport>(preferred);

  useEffect(() => {
    lastMessageAt.current = Date.now();

    const onSnapshot = (next: LiveSnapshot) => {
      lastMessageAt.current = Date.now();
      // Sayfanın ilk görüntüsünden ya da son gelenden eski snapshot (yeniden bağlanma, sunucu önbelleği) geri sarmasın:
      // eski sürücü "yeniden binmiş" gibi sahte iniş/biniş üretirdi.
      if (next.generatedAt < latestGeneratedAtRef.current) return;
      latestGeneratedAtRef.current = next.generatedAt;
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

      const changes = detectSessionChanges(knownRef.current, next, now);
      if (changes.departures.length) setDepartures((list) => [...list, ...changes.departures].slice(-MAX_ARRIVALS));
      if (changes.arrivals.length) setArrivals((list) => [...list, ...changes.arrivals].slice(-MAX_ARRIVALS));
    };
    const onDisconnect = () => setStatus((s) => (s === "live" ? "connecting" : s));

    const connection = connectLive(preferred, onSnapshot, onDisconnect, setTransport);

    const watchdog = setInterval(() => {
      if (Date.now() - lastMessageAt.current > STALE_AFTER_MS) setStatus("offline");
    }, 1_000);

    return () => {
      clearInterval(watchdog);
      connection.close();
    };
  }, [preferred]); // mod değişince (M) eski bağlantı kapanır, yenisi kurulur

  return { snapshot, history, status, arrivals, departures, samplesPerMinute, tick, transport };
}

/** WebSocket kopunca yeniden bağlanma beklemesi: 1 sn'den başlar, 5 sn'de sabitlenir. */
const WS_RETRY_MIN_MS = 1_000;
const WS_RETRY_MAX_MS = 5_000;
/** WebSocket bu sürede açılamazsa bu sunucuda yok sayılır ve SSE'ye geçilir. */
const WS_CONNECT_TIMEOUT_MS = 3_000;

/**
 * Canlı akış taşıması.
 *   "ws":  `/api/ws` (WebSocket: server.mts ya da Vercel'de api/ws/route.ts). Hiç açılamazsa (ör. düz `next dev`) bu
 *          bağlantı boyunca `/api/stream` (SSE) kullanılır. Açılmış WebSocket koparsa 1-5 sn aralıkla yeniden denenir.
 *   "sse": doğrudan `/api/stream`. EventSource kopan bağlantıyı kendisi yeniden kurar.
 * `onTransport` o an gerçekten kullanılan taşımayı bildirir.
 */
function connectLive(
  preferred: Transport,
  onSnapshot: (snapshot: LiveSnapshot) => void,
  onDisconnect: () => void,
  onTransport: (transport: Transport) => void,
): { close(): void } {
  let closed = false;
  let socket: WebSocket | null = null;
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryMs = WS_RETRY_MIN_MS;
  let everOpened = false;

  const openSse = () => {
    onTransport("sse");
    source = new EventSource("/api/stream");
    source.addEventListener("snapshot", (event) => onSnapshot(JSON.parse((event as MessageEvent<string>).data) as LiveSnapshot));
    source.addEventListener("error", onDisconnect);
  };

  const openWebSocket = () => {
    if (typeof WebSocket === "undefined") return openSse();
    onTransport("ws");
    const url = new URL("/api/ws", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    socket = ws;
    const connectTimer = setTimeout(() => ws.close(), WS_CONNECT_TIMEOUT_MS);

    ws.addEventListener("open", () => {
      clearTimeout(connectTimer);
      everOpened = true;
      retryMs = WS_RETRY_MIN_MS;
    });
    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = JSON.parse(event.data) as { type?: string; snapshot?: LiveSnapshot };
      if (message.type === "snapshot" && message.snapshot) onSnapshot(message.snapshot);
    });
    ws.addEventListener("close", () => {
      clearTimeout(connectTimer);
      if (closed) return;
      socket = null;
      if (!everOpened) return openSse(); // bu sunucuda WebSocket yok: SSE yedeği
      onDisconnect();
      retryTimer = setTimeout(openWebSocket, retryMs);
      retryMs = Math.min(retryMs * 2, WS_RETRY_MAX_MS);
    });
  };

  if (preferred === "sse") openSse();
  else openWebSocket();

  return {
    close() {
      closed = true;
      clearTimeout(retryTimer);
      socket?.close();
      source?.close();
    },
  };
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

/**
 * Sürüş başlangıcı değişen araçlar: önceki sürüş bittiyse iniş, yeni sürücü varsa biniş.
 * Sürücü değiştirildiğinde ikisi birden üretilir (önce iniş). Bilinen durum her çağrıda güncellenir.
 */
function detectSessionChanges(known: Map<VehicleId, LiveVehicle>, snapshot: LiveSnapshot, now: number) {
  const arrivals: Arrival[] = [];
  const departures: Departure[] = [];
  for (const v of snapshot.vehicles) {
    const previous = known.get(v.id);
    known.set(v.id, v);
    if (!previous || v.sessionStartedAt === previous.sessionStartedAt) continue;

    if (previous.driver && previous.sessionStartedAt != null) {
      departures.push({
        key: `${v.id}:${previous.sessionStartedAt}:end`,
        vehicleId: v.id,
        slot: v.slot,
        plate: previous.plate,
        model: previous.model,
        driver: previous.driver,
        durationMs: now - previous.sessionStartedAt,
        avg: previous.stats?.avg ?? null,
        max: previous.stats?.max ?? null,
        at: now,
      });
    }
    if (v.driver && v.sessionStartedAt != null) {
      arrivals.push({ key: `${v.id}:${v.sessionStartedAt}`, vehicleId: v.id, slot: v.slot, plate: v.plate, model: v.model, driver: v.driver, at: now });
    }
  }
  return { arrivals, departures };
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
