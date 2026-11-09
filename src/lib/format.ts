/**
 * Görüntüleme biçimleri. Saatler her zaman İstanbul saatiyle gösterilir:
 * Vercel sunucuları UTC'de çalışır, saat dilimini açıkça vermezsek raporlar 3 saat kayar.
 */
import type { Driver } from "@/domain/types";

export const TIME_ZONE = "Europe/Istanbul";
const LOCALE = "tr-TR";

const timeFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const timeWithSecondsFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatTime = (at: number) => timeFormat.format(at);
export const formatTimeWithSeconds = (at: number) => timeWithSecondsFormat.format(at);
export const formatDate = (at: number) => dateFormat.format(at);
export const formatDateTime = (at: number) => dateTimeFormat.format(at);

export const fullName = (driver: Driver) => `${driver.firstName} ${driver.lastName}`;

/** "Ahmet Yılmaz" → "Ahmet Y." (dar alanlar: sıralama kulesi, grafik etiketi). */
export const shortName = (driver: Driver) => `${driver.firstName} ${driver.lastName.charAt(0)}.`;

/** 1 saat 4 dk 9 sn → "1:04:09", 4 dk 9 sn → "04:09". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** `<input type="datetime-local">` için İstanbul saatine göre "YYYY-MM-DDTHH:mm". */
export function toDateTimeLocalValue(at: number): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** İstanbul saatiyle girilen "YYYY-MM-DDTHH:mm" değerini epoch ms'e çevirir (Türkiye yıl boyu UTC+3). */
export function fromDateTimeLocalValue(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const at = Date.parse(`${value}:00+03:00`);
  return Number.isFinite(at) ? at : null;
}

/** Epoch ms → İstanbul saatiyle dakika cinsinden gün içi konum (0..1439). */
export function minuteOfDay(at: number): number {
  const [h, m] = toDateTimeLocalValue(at).slice(11).split(":").map(Number);
  return h! * 60 + m!;
}

export const formatMinuteOfDay = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * "HH:MM" (İstanbul) → bugünün o saati, epoch ms. Tarih her zaman otomatik: bugün.
 * Gece yarısını geçen durumda (00:05'te "23:58" girilirse) gelecekte kalan saat dünkü sayılır.
 */
export function fromTimeOfDay(value: string, now: number): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  if (h! > 23 || m! > 59) return null;
  const today = fromDateTimeLocalValue(`${toDateTimeLocalValue(now).slice(0, 10)}T${value}`);
  if (today == null) return null;
  return today > now + 60_000 ? today - 24 * 60 * 60_000 : today;
}
