import "server-only";

import type { Session, Vehicle, VehicleId } from "@/domain/types";
import type { IngestSample } from "@/domain/validation";
import { getRepository } from "../db";
import { deviceIdForSlot } from "../fleet-defaults";
import { latestActiveByVehicle } from "./fleet-service";

/**
 * Bileklik eşleşmesi araç numarasından türetilir (N. araç = band-0N). Kayıtlı eski kimlik (ör. ilk sürümün
 * phone-0N değerleri) de kabul edilir; veritabanı göçü gerekmez.
 */
const matchesDevice = (vehicle: Vehicle, deviceId: string) => deviceId === deviceIdForSlot(vehicle.slot) || deviceId === vehicle.deviceId;

export type IngestOutcome =
  /** Aktif sürüşe kaydedildi. */
  | "logged"
  /** Araç bulundu ama sürücü atanmamış: canlı değer güncellendi, rapora yazılmadı. */
  | "no-session"
  /** deviceId/plaka hiçbir araçla eşleşmedi. */
  | "unknown-vehicle";

interface Plan {
  sample: IngestSample;
  vehicle: Vehicle | null;
  sessionId: string | null;
}

/**
 * Bilekliklerden gelen ölçümleri işler. Bir istekte birden fazla araç ve ölçüm olabilir (bağlantı
 * koptuğunda biriktirip toplu gönderir); her ölçümün sonucu ayrı döner, biri eşleşmese de diğerleri yazılır.
 */
export async function ingestSamples(samples: IngestSample[]): Promise<IngestOutcome[]> {
  const repo = await getRepository();
  const [vehicles, sessions] = await Promise.all([repo.listVehicles(), repo.listActiveSessions()]);
  const active = latestActiveByVehicle(sessions);
  const plans = samples.map((sample) => plan(sample, vehicles, active));

  const writes = plans.flatMap(({ sample: { bpm, at }, vehicle, sessionId }) => (vehicle ? [{ vehicleId: vehicle.id, sessionId, bpm, at }] : []));
  if (writes.length) await repo.recordSamples(writes);

  return plans.map(({ vehicle, sessionId }) => (!vehicle ? "unknown-vehicle" : sessionId ? "logged" : "no-session"));
}

function plan(sample: IngestSample, vehicles: Vehicle[], active: Map<VehicleId, Session>): Plan {
  const vehicle = vehicles.find((v) => (sample.deviceId ? matchesDevice(v, sample.deviceId) : v.plate === sample.plate)) ?? null;
  const session = vehicle ? active.get(vehicle.id) : undefined;
  // Sürüş başlamadan önce ölçülen değer önceki sürücüye aittir; yeni sürücünün raporuna yazılmaz.
  const sessionId = session && sample.at >= session.startedAt ? session.id : null;
  return { sample, vehicle, sessionId };
}
