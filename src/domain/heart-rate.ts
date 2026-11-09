/**
 * Nabız kuralları tek yerde: geçerli aralık, bölgeler, sinyal tazeliği ve istatistik.
 * Canlı ekran, admin, rapor ve ingest API'si bu dosyadan okur; eşik değiştirmek için yalnız burası düzenlenir.
 */
import type { SessionStats } from "./types";

/** Bileklikten gelebilecek makul aralık; dışındaki değerler sensör hatası sayılır ve reddedilir. */
export const BPM_RANGE = { min: 30, max: 230 } as const;

/** Göstergenin (devir saati) ölçeği. */
export const GAUGE_RANGE = { min: 40, max: 200 } as const;

/** Bu süreden eski ölçüm "sinyal yok" sayılır. */
export const SIGNAL_TIMEOUT_MS = 15_000;

export type ZoneId = "calm" | "focus" | "intense" | "redline";

export interface Zone {
  id: ZoneId;
  label: string;
  /** Bölgenin alt sınırı (dahil). */
  from: number;
}

/** Artan sırada. "redline" AMG kırmızısıyla vurgulanan tek bölgedir. */
export const ZONES: readonly Zone[] = [
  { id: "calm", label: "Sakin", from: 0 },
  { id: "focus", label: "Odak", from: 100 },
  { id: "intense", label: "Yoğun", from: 130 },
  { id: "redline", label: "Kırmızı bölge", from: 160 },
];

export const REDLINE_BPM = ZONES[ZONES.length - 1]!.from;

export function zoneOf(bpm: number): Zone {
  let current = ZONES[0]!;
  for (const zone of ZONES) if (bpm >= zone.from) current = zone;
  return current;
}

export function isValidBpm(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= BPM_RANGE.min && value <= BPM_RANGE.max;
}

export function isFresh(sampleAt: number | null | undefined, now: number): boolean {
  return sampleAt != null && now - sampleAt <= SIGNAL_TIMEOUT_MS;
}

/** Değeri göstergenin 0..1 aralığına çevirir (ibre, vites ışıkları). */
export function gaugeRatio(bpm: number): number {
  const { min, max } = GAUGE_RANGE;
  return Math.min(1, Math.max(0, (bpm - min) / (max - min)));
}

export const EMPTY_STATS: SessionStats = { count: 0, sum: 0, min: null, max: null };

export function addToStats(stats: SessionStats, bpm: number): SessionStats {
  return {
    count: stats.count + 1,
    sum: stats.sum + bpm,
    min: stats.min == null ? bpm : Math.min(stats.min, bpm),
    max: stats.max == null ? bpm : Math.max(stats.max, bpm),
  };
}

export function averageOf(stats: SessionStats): number | null {
  return stats.count > 0 ? Math.round(stats.sum / stats.count) : null;
}

export function summarize(stats: SessionStats) {
  return { avg: averageOf(stats), min: stats.min, max: stats.max };
}

/** Birden fazla sürüşün istatistiğini birleştirir (araç ve etkinlik toplamı). */
export function mergeStats(all: SessionStats[]): SessionStats {
  return all.reduce<SessionStats>(
    (acc, s) => ({
      count: acc.count + s.count,
      sum: acc.sum + s.sum,
      min: acc.min == null ? s.min : s.min == null ? acc.min : Math.min(acc.min, s.min),
      max: acc.max == null ? s.max : s.max == null ? acc.max : Math.max(acc.max, s.max),
    }),
    EMPTY_STATS,
  );
}

/** "<100", "100-129", "160+" gibi okunur aralık etiketi. */
export function zoneRangeLabel(zone: Zone): string {
  const next = ZONES[ZONES.indexOf(zone) + 1];
  if (zone.from === 0 && next) return `<${next.from}`;
  return next ? `${zone.from}-${next.from - 1}` : `${zone.from}+`;
}
