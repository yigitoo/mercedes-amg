import "server-only";

import { isFresh, summarize } from "@/domain/heart-rate";
import { DEFAULT_EVENT_SETTINGS, type EventSettings, type HeartRateSample, type LiveSnapshot, type LiveStatus, type LiveVehicle } from "@/domain/types";
import { defaultFleet } from "../fleet-defaults";
import { getRepository } from "../db";
import { getFleet, type FleetEntry } from "./fleet-service";
import { getEventSettings } from "./settings-service";

/**
 * Canlı ekranın tek veri kaynağı (sayfa, SSE akışı ve JSON uç noktası).
 *
 * Dayanıklılık kuralı: bu fonksiyon HİÇBİR ZAMAN hata fırlatmaz. TV ekranı hata sayfasına düşmemeli.
 *   - Veritabanı yanıt vermezse son başarılı görüntü `stale: true` ile döner; ekran "veri gecikiyor" der.
 *   - Hiç başarılı görüntü yoksa (sunucu yeni açıldı) 8 araç "boşta" olarak gösterilir.
 *   - Ayarlar okunamazsa son bilinen ya da varsayılan metinler kullanılır; araç verisi etkilenmez.
 */
export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const [fleet, settings] = await Promise.allSettled([getFleetOverview(), getEventSettings()]);
  const cache = liveCache();

  if (settings.status === "fulfilled") cache.settings = settings.value;
  else console.error("[live] ayarlar okunamadı", settings.reason);

  if (fleet.status === "rejected") {
    console.error("[live] filo okunamadı, son bilinen görüntü gösteriliyor", fleet.reason);
    return { ...(cache.snapshot ?? emptySnapshot()), settings: cache.settings, stale: true };
  }

  const snapshot: LiveSnapshot = {
    generatedAt: fleet.value.generatedAt,
    stale: false,
    settings: cache.settings,
    vehicles: fleet.value.entries.map((e) => e.live),
  };
  cache.snapshot = snapshot;
  return snapshot;
}

/** Admin filo ekranı: araç + aktif sürüş + canlı durum, tek zaman damgasıyla. */
export async function getFleetOverview() {
  const fleet = await getFleet();
  const generatedAt = Date.now();
  return { generatedAt, entries: fleet.map((entry) => ({ ...entry, live: toLiveVehicle(entry, generatedAt) })) };
}

function toLiveVehicle({ vehicle, session }: FleetEntry, now: number): LiveVehicle {
  const sample = vehicle.lastSample;
  // Sürüş başlamadan önce gelen ölçüm o sürücüye ait değildir.
  const belongsToSession = session != null && sample != null && sample.at >= session.startedAt;
  const fresh = belongsToSession && isFresh(sample.at, now);

  const status: LiveStatus = !session ? "idle" : fresh ? "live" : "no-signal";

  return {
    id: vehicle.id,
    slot: vehicle.slot,
    plate: vehicle.plate,
    model: vehicle.model,
    status,
    driver: session?.driver ?? null,
    sessionStartedAt: session?.startedAt ?? null,
    bpm: fresh ? sample.bpm : null,
    sampleAt: belongsToSession ? sample.at : null,
    stats: session ? summarize(session.stats) : null,
  };
}

function emptySnapshot(): LiveSnapshot {
  const now = Date.now();
  return {
    generatedAt: now,
    stale: true,
    settings: DEFAULT_EVENT_SETTINGS,
    vehicles: defaultFleet().map((vehicle) => toLiveVehicle({ vehicle, session: null }, now)),
  };
}

function liveCache(): { snapshot: LiveSnapshot | null; settings: EventSettings } {
  const g = globalThis as unknown as { __amgLiveCache?: { snapshot: LiveSnapshot | null; settings: EventSettings } };
  return (g.__amgLiveCache ??= { snapshot: null, settings: DEFAULT_EVENT_SETTINGS });
}

/** Açılışta iz boş başlamasın: aktif sürüşlerin son ölçümleri (araç başına). Hata olursa boş döner. */
export async function getRecentHistory(snapshot: LiveSnapshot, windowMs = 120_000): Promise<Record<string, HeartRateSample[]>> {
  try {
    const repo = await getRepository();
    const since = snapshot.generatedAt - windowMs;
    const sessions = (await repo.listActiveSessions()).filter((s) => snapshot.vehicles.some((v) => v.id === s.vehicleId && v.sessionStartedAt === s.startedAt));
    const entries = await Promise.all(
      sessions.map(async (s) => [s.vehicleId, (await repo.listReadings(s.id, since)).map(({ bpm, at }) => ({ bpm, at }))] as const),
    );
    return Object.fromEntries(entries);
  } catch (error) {
    console.error("[live] açılış izi okunamadı", error);
    return {};
  }
}
