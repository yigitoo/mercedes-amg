/**
 * Zaman serisi yardımcıları (saf fonksiyonlar): grafik için seyreltme ve bölge dağılımı.
 */
import { ZONES, zoneOf, type ZoneId } from "./heart-rate";
import type { HeartRateSample } from "./types";

/** Ölçümleri `bucketMs` genişliğinde pencerelere bölüp ortalamasını alır; 8 saatlik sürüş de grafiğe sığar. */
export function bucketAverage(samples: HeartRateSample[], bucketMs: number): HeartRateSample[] {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const { bpm, at } of samples) {
    const key = Math.floor(at / bucketMs) * bucketMs;
    const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += bpm;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([at, { sum, count }]) => ({ at, bpm: Math.round(sum / count) }));
}

/** Grafikte en fazla `maxPoints` nokta kalacak şekilde pencere genişliği seçer (en az 1 sn). */
export function bucketSizeFor(samples: HeartRateSample[], maxPoints: number): number {
  if (samples.length < 2) return 1000;
  const span = samples[samples.length - 1]!.at - samples[0]!.at;
  return Math.max(1000, Math.ceil(span / maxPoints / 1000) * 1000);
}

export type ZoneShare = Record<ZoneId, number>;

/** Her bölgede geçen ölçüm oranı (0..1). 1 Hz ölçümde oran = süre oranı. */
export function zoneShare(samples: HeartRateSample[]): ZoneShare {
  const counts = Object.fromEntries(ZONES.map((z) => [z.id, 0])) as ZoneShare;
  for (const { bpm } of samples) counts[zoneOf(bpm).id] += 1;
  const total = samples.length || 1;
  return Object.fromEntries(ZONES.map((z) => [z.id, counts[z.id] / total])) as ZoneShare;
}
