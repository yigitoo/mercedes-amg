import "server-only";
import { randomUUID } from "node:crypto";

import { addToStats, EMPTY_STATS } from "@/domain/heart-rate";
import { DEFAULT_EVENT_SETTINGS, type AuditEntry, type Driver, type EventSettings, type ReadingRow, type Session, type SessionId, type Vehicle, type VehicleId } from "@/domain/types";
import type { VehicleInput } from "@/domain/validation";
import type { FleetRepository, NewSession, ReadingQuery, SampleWrite } from "./repository";

/** Uzun bir demo belleği şişirmesin diye sürüş başına tutulan en fazla ölçüm (1 Hz'de ~5,5 saat). */
const MAX_READINGS_PER_SESSION = 20_000;

/**
 * Bellek içi depo. `MONGODB_URI` yokken kullanılır: kurulum gerektirmez ama süreç kapanınca veri gider ve
 * birden fazla sunucu kopyası arasında paylaşılmaz. Bu yüzden yalnız yerel geliştirme ve deneme içindir.
 */
export class MemoryFleetRepository implements FleetRepository {
  private vehicles = new Map<VehicleId, Vehicle>();
  private sessions = new Map<SessionId, Session>();
  private readings = new Map<SessionId, ReadingRow[]>();
  private nextReadingId = 0;
  private settings: EventSettings = { ...DEFAULT_EVENT_SETTINGS };
  private audit: AuditEntry[] = [];

  async listVehicles() {
    return [...this.vehicles.values()].sort((a, b) => a.slot - b.slot).map(clone);
  }

  async findVehicle(id: VehicleId) {
    return cloneOrNull(this.vehicles.get(id));
  }

  async findVehicleByDevice(deviceId: string) {
    return cloneOrNull([...this.vehicles.values()].find((v) => v.deviceId === deviceId));
  }

  async findVehicleByPlate(plate: string) {
    return cloneOrNull([...this.vehicles.values()].find((v) => v.plate === plate));
  }

  async seedVehicles(vehicles: Vehicle[]) {
    if (this.vehicles.size > 0) return;
    for (const vehicle of vehicles) this.vehicles.set(vehicle.id, clone(vehicle));
  }

  async updateVehicle(id: VehicleId, input: VehicleInput) {
    const vehicle = this.vehicles.get(id);
    if (vehicle) Object.assign(vehicle, input);
  }

  async listActiveSessions() {
    return [...this.sessions.values()].filter((s) => s.endedAt === null).map(clone);
  }

  async findActiveSession(vehicleId: VehicleId) {
    return cloneOrNull([...this.sessions.values()].find((s) => s.vehicleId === vehicleId && s.endedAt === null));
  }

  async findSession(id: SessionId) {
    return cloneOrNull(this.sessions.get(id));
  }

  async listSessions(filter: { vehicleId?: VehicleId } = {}) {
    return [...this.sessions.values()]
      .filter((s) => !filter.vehicleId || s.vehicleId === filter.vehicleId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(clone);
  }

  async createSession(input: NewSession) {
    const session: Session = { id: randomUUID(), ...input, endedAt: null, stats: { ...EMPTY_STATS } };
    this.sessions.set(session.id, session);
    this.readings.set(session.id, []);
    return clone(session);
  }

  async endSession(id: SessionId, endedAt: number) {
    const session = this.sessions.get(id);
    if (session && session.endedAt === null) session.endedAt = endedAt;
  }

  async renameSessionDriver(id: SessionId, driver: Driver) {
    const session = this.sessions.get(id);
    if (session) session.driver = { ...driver };
  }

  async getSettings() {
    return clone(this.settings);
  }

  async saveSettings(settings: EventSettings) {
    this.settings = clone(settings);
  }

  async appendAudit(entry: Omit<AuditEntry, "id">) {
    this.audit.push({ id: randomUUID(), ...clone(entry) });
  }

  async listAudit({ limit, before }: { limit: number; before?: number }) {
    return this.audit
      .filter((e) => before == null || e.at < before)
      .sort((a, b) => b.at - a.at)
      .slice(0, limit)
      .map(clone);
  }

  async recordSamples(samples: SampleWrite[]) {
    for (const { vehicleId, sessionId, bpm, at } of samples) {
      const vehicle = this.vehicles.get(vehicleId);
      if (vehicle && (!vehicle.lastSample || vehicle.lastSample.at <= at)) vehicle.lastSample = { bpm, at };

      const session = sessionId ? this.sessions.get(sessionId) : undefined;
      if (!session || !sessionId) continue;
      const list = this.readings.get(sessionId) ?? [];
      list.push({ id: String(++this.nextReadingId).padStart(12, "0"), sessionId, vehicleId, bpm, at });
      if (list.length > MAX_READINGS_PER_SESSION) list.shift();
      this.readings.set(sessionId, list);
      session.stats = addToStats(session.stats, bpm);
    }
  }

  async listReadings(sessionId: SessionId, since = 0) {
    return (this.readings.get(sessionId) ?? [])
      .filter((r) => r.at >= since)
      .sort((a, b) => a.at - b.at)
      .map(({ sessionId: s, vehicleId, bpm, at }) => ({ sessionId: s, vehicleId, bpm, at }));
  }

  async queryReadings({ order, limit, after, vehicleId }: ReadingQuery) {
    const dir = order === "asc" ? 1 : -1;
    const compare = (a: ReadingRow, b: { at: number; id: string }) => (a.at - b.at || a.id.localeCompare(b.id)) * dir;
    return [...this.readings.values()]
      .flat()
      .filter((r) => (!vehicleId || r.vehicleId === vehicleId) && (!after || compare(r, after) > 0))
      .sort((a, b) => compare(a, b))
      .slice(0, limit)
      .map(clone);
  }

  async countReadings() {
    return [...this.readings.values()].reduce((sum, list) => sum + list.length, 0);
  }

  async countAudit() {
    return this.audit.length;
  }
}

/** Dışarıya kopya verilir; çağıran nesneyi değiştirse de depo bozulmaz (Mongo davranışıyla aynı). */
function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneOrNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}
