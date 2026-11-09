/**
 * Girdi doğrulama. Admin formları ve ingest API'si aynı kuralları kullanır.
 * Sonuç her zaman `Result`: hata fırlatmak yerine alan bazlı mesaj döner, formlar bunu doğrudan gösterir.
 */
import { isValidBpm } from "./heart-rate";
import { GAUGE_STYLES, type Driver, type EventSettings, type GaugeStyle } from "./types";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type Result<T, K extends string = string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K> };

const NAME_MAX = 40;
const PLATE_PATTERN = /^[0-9]{2} ?[A-ZÇĞİÖŞÜ]{1,3} ?[0-9]{2,4}$/;

/** "ahmet  yılmaz" → "Ahmet Yılmaz" (Türkçe büyük/küçük harf kurallarıyla). */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1).toLocaleLowerCase("tr-TR"))
    .join(" ");
}

/** "34amg001" → "34 AMG 001" */
export function normalizePlate(raw: string): string {
  const compact = raw.toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
  const match = compact.match(/^([0-9]{2})([A-ZÇĞİÖŞÜ]{1,3})([0-9]{2,4})$/);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : raw.trim().toLocaleUpperCase("tr-TR");
}

export function validateDriver(input: { firstName: string; lastName: string }): Result<Driver, keyof Driver> {
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  const errors: FieldErrors<keyof Driver> = {};

  if (!firstName) errors.firstName = "Ad gerekli.";
  else if (firstName.length > NAME_MAX) errors.firstName = `En fazla ${NAME_MAX} karakter.`;
  if (!lastName) errors.lastName = "Soyad gerekli.";
  else if (lastName.length > NAME_MAX) errors.lastName = `En fazla ${NAME_MAX} karakter.`;

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { firstName, lastName } };
}

/** Admin'den düzenlenen araç alanları. Bileklik eşleşmesi sabittir (N. araç = band-0N), arayüzde gösterilmez. */
export interface VehicleInput {
  plate: string;
  model: string;
}

export function validateVehicle(input: VehicleInput): Result<VehicleInput, keyof VehicleInput> {
  const plate = normalizePlate(input.plate);
  const model = input.model.trim().replace(/\s+/g, " ");
  const errors: FieldErrors<keyof VehicleInput> = {};

  if (!PLATE_PATTERN.test(plate)) errors.plate = "Plaka biçimi: 34 AMG 001";
  if (model.length > 40) errors.model = "En fazla 40 karakter.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { plate, model } };
}

/** Ingest API'ye gelen tek ölçüm. Aracı bulmak için deviceId ya da plaka yeterli. */
export interface IngestSample {
  deviceId?: string;
  plate?: string;
  bpm: number;
  at: number;
}

/** Cihaz saati bu kadar saparsa ölçüm zamanı sunucu saatine çekilir. */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;

/** Tek ingest isteğinde en fazla ölçüm: bileklik 5 dk bağlantısız kalıp biriktirse bile sığar. */
export const INGEST_MAX_BATCH = 500;

/** Cihazın saati kaymış olabilir: gelecekteki ya da çok eski zaman damgaları sunucu saatine çekilir. */
export function parseIngestSample(raw: unknown, now: number): Result<IngestSample> {
  if (typeof raw !== "object" || raw === null) return { ok: false, errors: { body: "Nesne bekleniyordu." } };
  const r = raw as Record<string, unknown>;

  const deviceId = typeof r.deviceId === "string" ? r.deviceId.trim() : undefined;
  const plate = typeof r.plate === "string" ? normalizePlate(r.plate) : undefined;
  if (!deviceId && !plate) return { ok: false, errors: { deviceId: "deviceId ya da plate gerekli." } };

  const bpm = typeof r.bpm === "string" ? Number(r.bpm) : r.bpm;
  if (!isValidBpm(bpm)) return { ok: false, errors: { bpm: "bpm 30-230 arasında bir sayı olmalı." } };

  const rawAt = typeof r.at === "number" ? r.at : typeof r.at === "string" ? Date.parse(r.at) : NaN;
  const at = Number.isFinite(rawAt) && Math.abs(now - rawAt) <= MAX_CLOCK_SKEW_MS ? rawAt : now;

  return { ok: true, value: { deviceId, plate, bpm: Math.round(bpm), at } };
}

type TextSetting = "title" | "subtitle" | "tagline";
const TEXT_LIMITS: Record<TextSetting, number> = { title: 48, subtitle: 80, tagline: 48 };

export const isGaugeStyle = (value: unknown): value is GaugeStyle => GAUGE_STYLES.includes(value as GaugeStyle);

export function validateSettings(input: Record<keyof EventSettings, string>): Result<EventSettings, keyof EventSettings> {
  const clean = (s: string) => s.trim().replace(/\s+/g, " ");
  const errors: FieldErrors<keyof EventSettings> = {};
  const text = { title: clean(input.title), subtitle: clean(input.subtitle), tagline: clean(input.tagline) };

  if (!text.title) errors.title = "Başlık gerekli.";
  for (const key of Object.keys(TEXT_LIMITS) as TextSetting[]) {
    if (text[key].length > TEXT_LIMITS[key]) errors[key] = `En fazla ${TEXT_LIMITS[key]} karakter.`;
  }
  if (!isGaugeStyle(input.gauge)) errors.gauge = "Geçersiz gösterge.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { ...text, gauge: input.gauge as GaugeStyle } };
}
