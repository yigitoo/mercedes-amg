/**
 * Domain modeli. Saf tipler: veritabanı, framework ya da UI bilgisi içermez.
 *
 *   Vehicle  ── 8 araç, her biri bir plaka ve araçtaki nabız bilekliğinin kimliği (deviceId)
 *   Session  ── bir aracın bir sürücüyle yaptığı tek sürüş (route). Sürücü değişince yeni session açılır.
 *   Reading  ── bileklikten gelen tek nabız ölçümü; aktif session'a yazılır.
 */

export type VehicleId = string;
export type SessionId = string;

export interface Driver {
  firstName: string;
  lastName: string;
}

export interface HeartRateSample {
  bpm: number;
  /** Ölçüm zamanı (epoch ms). */
  at: number;
}

export interface Vehicle {
  id: VehicleId;
  /** Ekrandaki sıra (1-8). */
  slot: number;
  plate: string;
  /** Araçtaki bilekliğin kimliği (band-0N); ingest isteklerinde aracı bulmak için kullanılır. */
  deviceId: string;
  /** Opsiyonel model adı, örn. "AMG GT 63". */
  model: string;
  /** Bileklikten gelen son ölçüm (sürüş olsun olmasın). */
  lastSample: HeartRateSample | null;
}

/** Bir sürüşün özet istatistiği; her ölçümde artımlı güncellenir, rapor için tüm ölçümleri taramaya gerek kalmaz. */
export interface SessionStats {
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
}

export interface Session {
  id: SessionId;
  vehicleId: VehicleId;
  /** Sürüş başladığı anki plaka; araç sonradan düzenlense de rapor doğru kalır. */
  plate: string;
  driver: Driver;
  startedAt: number;
  endedAt: number | null;
  stats: SessionStats;
}

export interface Reading extends HeartRateSample {
  sessionId: SessionId;
  vehicleId: VehicleId;
}

/** Log ve dışa aktarma için kimlikli ölçüm; kimlik, aynı milisaniyedeki ölçümleri sayfalamada ayırır. */
export interface ReadingRow extends Reading {
  id: string;
}

/** Canlı ekranda bir aracın durumu. */
export type LiveStatus =
  /** Aktif sürüş yok, sürücü atanmamış. */
  | "idle"
  /** Sürüş var ve taze nabız akıyor. */
  | "live"
  /** Sürüş var ama bileklik bir süredir veri göndermiyor. */
  | "no-signal";

export interface LiveVehicle {
  id: VehicleId;
  slot: number;
  plate: string;
  model: string;
  status: LiveStatus;
  driver: Driver | null;
  sessionStartedAt: number | null;
  bpm: number | null;
  sampleAt: number | null;
  stats: { avg: number | null; min: number | null; max: number | null } | null;
}

export interface LiveSnapshot {
  generatedAt: number;
  /** true: veritabanına ulaşılamadı, son bilinen görüntü gösteriliyor. */
  stale: boolean;
  settings: EventSettings;
  vehicles: LiveVehicle[];
}

/** Nabız göstergesi: "bar" = yatay devir barı, "dial" = yuvarlak devir kadranı. */
export type GaugeStyle = "bar" | "dial";
export const GAUGE_STYLES: readonly GaugeStyle[] = ["bar", "dial"];

/** Canlı ekranda görünen, admin panelden düzenlenen etkinlik ayarları. */
export interface EventSettings {
  title: string;
  subtitle: string;
  tagline: string;
  gauge: GaugeStyle;
}

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  title: "Canlı Nabız Takibi",
  subtitle: "Sürüş performansı, araç başına anlık",
  /** Olduğu gibi gösterilir (CSS büyük harfe çevirmez: tr dilinde "i" → "İ" olurdu). */
  tagline: "TOO HARD TO RESIST",
  gauge: "dial",
};

/** Denetim kaydı: admin panelde yapılan her değişiklik ve her giriş denemesi. */
export type AuditAction =
  | "admin.login"
  | "admin.login_failed"
  | "admin.logout"
  | "driver.assigned"
  | "driver.renamed"
  | "session.ended"
  | "vehicle.updated"
  | "settings.updated";

export interface AuditEntry {
  id: string;
  at: number;
  action: AuditAction;
  /** İnsan okunur tek satır, örn. "34 AMG 006: Ahmet Yılmaz sürüşe başladı". */
  summary: string;
  vehicleId?: VehicleId;
  sessionId?: SessionId;
  /** Değişen alanların önceki ve sonraki değerleri. */
  changes?: Record<string, { from: string | null; to: string | null }>;
}
