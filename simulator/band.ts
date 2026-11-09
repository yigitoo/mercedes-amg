/**
 * Nabız bilekliği: sürücünün nabzını ölçer ve sunucuya gönderir.
 * Gerçek cihazdan beklenen davranışın aynısı:
 *   - her ölçüm zaman damgasıyla kuyruğa girer, sunucu yanıt vermezse kaybolmaz, sonra toplu gönderilir;
 *   - kuyruk sınırlıdır (en eski atılır), bağlantısız kalan cihaz belleği doldurmaz;
 *   - sensör zaman zaman kolla temasını kaybeder (kayma): o sürede ölçüm üretilmez.
 */
import { HeartModel } from "./heart-model.ts";

export interface Sample {
  deviceId: string;
  bpm: number;
  at: number;
}

export interface BandOptions {
  deviceId: string;
  model: HeartModel;
  random: () => number;
  /** Saniyede bilekliğin kopma olasılığı. */
  dropoutChance: number;
}

const MAX_QUEUE = 500; // sunucunun tek istekte kabul ettiği en fazla ölçüm
const DROPOUT_SECONDS: [number, number] = [20, 45];

export type SendResult = { ok: true; sent: number } | { ok: false; queued: number; reason: string };

export class Band {
  readonly deviceId: string;
  private readonly options: BandOptions;
  private queue: Sample[] = [];
  private bandOfflineUntil = 0;
  lastBpm: number | null = null;

  constructor(options: BandOptions) {
    this.options = options;
    this.deviceId = options.deviceId;
  }

  get bandConnected() {
    return Date.now() >= this.bandOfflineUntil;
  }

  get queued() {
    return this.queue.length;
  }

  /** Bileklikten bir ölçüm okur (bağlıysa) ve kuyruğa ekler. */
  measure(dtSeconds: number, now = Date.now()): void {
    const { model, random, dropoutChance } = this.options;
    const bpm = model.step(dtSeconds); // bileklik kopukken de kalp atmaya devam eder
    if (now < this.bandOfflineUntil) return;

    if (random() < dropoutChance * dtSeconds) {
      const [min, max] = DROPOUT_SECONDS;
      this.bandOfflineUntil = now + (min + random() * (max - min)) * 1000;
      this.lastBpm = null;
      return;
    }

    this.lastBpm = bpm;
    this.queue.push({ deviceId: this.deviceId, bpm, at: now });
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
  }

  /** Kuyruktaki tüm ölçümleri tek istekte gönderir; başarısızsa kuyruk korunur. */
  async flush(endpoint: string, deviceKey: string, timeoutMs: number): Promise<SendResult> {
    if (this.queue.length === 0) return { ok: true, sent: 0 };
    const batch = this.queue.slice();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Key": deviceKey },
        body: JSON.stringify(batch.length === 1 ? batch[0] : { samples: batch }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 401) return { ok: false, queued: this.queue.length, reason: "401: INGEST_KEY eşleşmiyor" };
      if (!response.ok) return { ok: false, queued: this.queue.length, reason: `HTTP ${response.status}` };

      this.queue.splice(0, batch.length);
      return { ok: true, sent: batch.length };
    } catch (error) {
      const reason = error instanceof Error ? (error.name === "TimeoutError" ? "zaman aşımı" : error.message) : String(error);
      return { ok: false, queued: this.queue.length, reason };
    }
  }
}
