import "server-only";

import type { Driver, Session, SessionId, Vehicle, VehicleId } from "@/domain/types";
import type { VehicleInput } from "@/domain/validation";
import { fullName } from "@/lib/format";
import { getRepository, type FleetRepository } from "../db";
import { DomainError } from "../errors";
import { diffFields, recordAudit } from "./audit-service";

export interface FleetEntry {
  vehicle: Vehicle;
  session: Session | null;
}

/** Araç başına en yeni aktif sürüş. Aynı anda iki atama yarışırsa bile ekran tutarlı kalır. */
export function latestActiveByVehicle(sessions: Session[]): Map<VehicleId, Session> {
  const byVehicle = new Map<VehicleId, Session>();
  for (const session of sessions) {
    const current = byVehicle.get(session.vehicleId);
    if (!current || session.startedAt > current.startedAt) byVehicle.set(session.vehicleId, session);
  }
  return byVehicle;
}

export async function getFleet(): Promise<FleetEntry[]> {
  const repo = await getRepository();
  const [vehicles, sessions] = await Promise.all([repo.listVehicles(), repo.listActiveSessions()]);
  const active = latestActiveByVehicle(sessions);
  return vehicles.map((vehicle) => ({ vehicle, session: active.get(vehicle.id) ?? null }));
}

/**
 * Araca sürücü atar. Araçta süren bir sürüş varsa önce o kapatılır: "sürücü değişti" = eski sürüş biter,
 * yenisi aynı anda başlar. Böylece her ölçüm tek bir sürücüye ait olur ve rapor karışmaz.
 */
export async function assignDriver(vehicleId: VehicleId, driver: Driver, startedAt: number): Promise<Session> {
  const repo = await getRepository();
  const vehicle = await requireVehicle(repo, vehicleId);

  const now = Date.now();
  if (startedAt > now + 60_000) throw new DomainError("Başlangıç saati gelecekte olamaz.", "startedAt");

  const running = (await repo.listActiveSessions()).filter((s) => s.vehicleId === vehicleId);
  const latestStart = Math.max(0, ...running.map((s) => s.startedAt));
  if (startedAt < latestStart) {
    throw new DomainError("Başlangıç saati, devam eden sürüşün başlangıcından önce olamaz.", "startedAt");
  }

  // Önce yeni sürüş açılır, sonra eskisi kapanır: arada okuyan canlı ekran aracı hiçbir an "boş" görmez
  // (aynı anda iki aktif sürüş görülürse en yenisi seçilir, bkz. latestActiveByVehicle).
  const session = await repo.createSession({ vehicleId, plate: vehicle.plate, driver, startedAt });
  await Promise.all(running.map((s) => repo.endSession(s.id, startedAt)));

  const previous = running.map((s) => fullName(s.driver)).join(", ");
  await recordAudit({
    action: "driver.assigned",
    summary: `${vehicle.plate}: ${fullName(driver)} sürüşe başladı${previous ? ` (önceki: ${previous})` : ""}`,
    vehicleId,
    sessionId: session.id,
    changes: { Sürücü: { from: previous || null, to: fullName(driver) } },
  });
  return session;
}

/** Devam eden ya da biten bir sürüşte sürücü adındaki yazım hatasını düzeltir; ölçümler yerinde kalır. */
export async function renameDriver(sessionId: SessionId, driver: Driver): Promise<void> {
  const repo = await getRepository();
  const session = await repo.findSession(sessionId);
  if (!session) throw new DomainError("Sürüş bulunamadı.");
  const before = fullName(session.driver);
  if (before === fullName(driver)) return;

  await repo.renameSessionDriver(sessionId, driver);
  await recordAudit({
    action: "driver.renamed",
    summary: `${session.plate}: "${before}" adı "${fullName(driver)}" olarak düzeltildi`,
    vehicleId: session.vehicleId,
    sessionId,
    changes: { Sürücü: { from: before, to: fullName(driver) } },
  });
}

export async function endActiveSession(vehicleId: VehicleId): Promise<void> {
  const repo = await getRepository();
  const running = (await repo.listActiveSessions()).filter((s) => s.vehicleId === vehicleId);
  if (running.length === 0) throw new DomainError("Bu araçta devam eden sürüş yok.");
  const endedAt = Date.now();
  await Promise.all(running.map((s) => repo.endSession(s.id, endedAt)));
  for (const s of running) {
    await recordAudit({ action: "session.ended", summary: `${s.plate}: ${fullName(s.driver)} sürüşü bitti`, vehicleId, sessionId: s.id });
  }
}

export async function updateVehicle(vehicleId: VehicleId, input: VehicleInput): Promise<void> {
  const repo = await getRepository();
  const vehicle = await requireVehicle(repo, vehicleId);

  const byPlate = await repo.findVehicleByPlate(input.plate);
  if (byPlate && byPlate.id !== vehicleId) throw new DomainError(`Bu plaka ${byPlate.slot}. araçta kayıtlı.`, "plate");

  const changes = diffFields(vehicle, { ...vehicle, ...input }, { plate: "Plaka", model: "Model" });
  if (!changes) return;
  await repo.updateVehicle(vehicleId, input);
  await recordAudit({ action: "vehicle.updated", summary: `${vehicle.slot}. araç güncellendi (${input.plate})`, vehicleId, changes });
}

async function requireVehicle(repo: FleetRepository, vehicleId: VehicleId): Promise<Vehicle> {
  const vehicle = await repo.findVehicle(vehicleId);
  if (!vehicle) throw new DomainError("Araç bulunamadı.");
  return vehicle;
}
