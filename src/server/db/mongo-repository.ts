import "server-only";
import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId, type Collection, type Db, type Filter } from "mongodb";

import { addToStats, EMPTY_STATS } from "@/domain/heart-rate";
import {
  DEFAULT_EVENT_SETTINGS,
  type AuditEntry,
  type Driver,
  type EventSettings,
  type HeartRateSample,
  type Reading,
  type ReadingRow,
  type Session,
  type SessionId,
  type SessionStats,
  type Vehicle,
  type VehicleId,
} from "@/domain/types";
import type { VehicleInput } from "@/domain/validation";
import type { FleetRepository, NewSession, ReadingQuery, SampleWrite } from "./repository";

type VehicleDoc = Omit<Vehicle, "id"> & { _id: VehicleId };
/**
 * min/max ilk ölçüme kadar belgede hiç yoktur: Mongo'da null her sayıdan küçük sayıldığı için
 * `$min` null alanı asla güncellemez. Okurken eksik alan null'a çevrilir.
 */
type SessionDoc = Omit<Session, "id" | "stats"> & { _id: SessionId; stats: { count: number; sum: number; min?: number; max?: number } };
type ReadingDoc = Reading & { _id?: ObjectId };
type AuditDoc = Omit<AuditEntry, "id"> & { _id: string };
type SettingsDoc = EventSettings & { _id: "event" };

/**
 * MongoDB deposu. Bağlantı süreç başına bir kez açılır ve `globalThis` üzerinde saklanır:
 * Vercel'de sıcak kalan fonksiyon kopyaları ve `next dev`'in yeniden yüklemeleri yeni bağlantı açmaz.
 */
export class MongoFleetRepository implements FleetRepository {
  constructor(private readonly db: Db) {}

  private get vehicles(): Collection<VehicleDoc> {
    return this.db.collection<VehicleDoc>("vehicles");
  }
  private get sessions(): Collection<SessionDoc> {
    return this.db.collection<SessionDoc>("sessions");
  }
  private get readings(): Collection<ReadingDoc> {
    return this.db.collection<ReadingDoc>("readings");
  }
  private get audit(): Collection<AuditDoc> {
    return this.db.collection<AuditDoc>("audit_log");
  }
  private get settings(): Collection<SettingsDoc> {
    return this.db.collection<SettingsDoc>("settings");
  }

  async ensureIndexes() {
    await Promise.all([
      this.vehicles.createIndex({ deviceId: 1 }),
      this.vehicles.createIndex({ plate: 1 }),
      this.sessions.createIndex({ vehicleId: 1, endedAt: 1 }),
      this.sessions.createIndex({ startedAt: -1 }),
      this.readings.createIndex({ sessionId: 1, at: 1 }),
      this.readings.createIndex({ at: 1, _id: 1 }),
      this.readings.createIndex({ vehicleId: 1, at: 1, _id: 1 }),
      this.audit.createIndex({ at: -1 }),
    ]);
  }

  async listVehicles() {
    const docs = await this.vehicles.find().sort({ slot: 1 }).toArray();
    return docs.map(toVehicle);
  }

  async findVehicle(id: VehicleId) {
    return mapOrNull(await this.vehicles.findOne({ _id: id }), toVehicle);
  }

  async findVehicleByDevice(deviceId: string) {
    return mapOrNull(await this.vehicles.findOne({ deviceId }), toVehicle);
  }

  async findVehicleByPlate(plate: string) {
    return mapOrNull(await this.vehicles.findOne({ plate }), toVehicle);
  }

  async seedVehicles(vehicles: Vehicle[]) {
    if ((await this.vehicles.estimatedDocumentCount()) > 0) return;
    // upsert: iki sunucu kopyası aynı anda tohumlasa da çift kayıt oluşmaz.
    await this.vehicles.bulkWrite(
      vehicles.map(({ id, ...rest }) => ({
        updateOne: { filter: { _id: id }, update: { $setOnInsert: rest }, upsert: true },
      })),
    );
  }

  async updateVehicle(id: VehicleId, input: VehicleInput) {
    await this.vehicles.updateOne({ _id: id }, { $set: input });
  }

  async listActiveSessions() {
    return (await this.sessions.find({ endedAt: null }).toArray()).map(toSession);
  }

  async findActiveSession(vehicleId: VehicleId) {
    return mapOrNull(await this.sessions.findOne({ vehicleId, endedAt: null }), toSession);
  }

  async findSession(id: SessionId) {
    return mapOrNull(await this.sessions.findOne({ _id: id }), toSession);
  }

  async listSessions(filter: { vehicleId?: VehicleId } = {}) {
    const query = filter.vehicleId ? { vehicleId: filter.vehicleId } : {};
    return (await this.sessions.find(query).sort({ startedAt: -1 }).toArray()).map(toSession);
  }

  async createSession(input: NewSession) {
    const doc: SessionDoc = { _id: randomUUID(), ...input, endedAt: null, stats: { count: 0, sum: 0 } };
    await this.sessions.insertOne(doc);
    return toSession(doc);
  }

  async endSession(id: SessionId, endedAt: number) {
    await this.sessions.updateOne({ _id: id, endedAt: null }, { $set: { endedAt } });
  }

  /** En fazla 3 toplu istek (paralel): ölçümler, sürüş istatistikleri, araçların son değeri. */
  async renameSessionDriver(id: SessionId, driver: Driver) {
    await this.sessions.updateOne({ _id: id }, { $set: { driver } });
  }

  async getSettings(): Promise<EventSettings> {
    const doc = await this.settings.findOne({ _id: "event" });
    // Eksik alan (eski belge) varsayılanla tamamlanır; yeni ayar eklemek göç gerektirmez.
    if (!doc) return { ...DEFAULT_EVENT_SETTINGS };
    const { title, subtitle, tagline, gauge } = { ...DEFAULT_EVENT_SETTINGS, ...doc };
    return { title, subtitle, tagline, gauge };
  }

  async saveSettings(settings: EventSettings) {
    await this.settings.updateOne({ _id: "event" }, { $set: settings }, { upsert: true });
  }

  async appendAudit(entry: Omit<AuditEntry, "id">) {
    await this.audit.insertOne({ _id: randomUUID(), ...entry });
  }

  async listAudit({ limit, before }: { limit: number; before?: number }) {
    const docs = await this.audit
      .find(before == null ? {} : { at: { $lt: before } })
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  }

  async recordSamples(samples: SampleWrite[]) {
    const readings: ReadingDoc[] = [];
    const statsBySession = new Map<SessionId, SessionStats>();
    const latestByVehicle = new Map<VehicleId, HeartRateSample>();

    for (const { vehicleId, sessionId, bpm, at } of samples) {
      const latest = latestByVehicle.get(vehicleId);
      if (!latest || latest.at <= at) latestByVehicle.set(vehicleId, { bpm, at });
      if (!sessionId) continue;
      readings.push({ sessionId, vehicleId, bpm, at });
      statsBySession.set(sessionId, addToStats(statsBySession.get(sessionId) ?? EMPTY_STATS, bpm));
    }

    await Promise.all([
      readings.length ? this.readings.insertMany(readings, { ordered: false }) : null,
      statsBySession.size
        ? this.sessions.bulkWrite(
            [...statsBySession].map(([id, s]) => ({
              updateOne: {
                filter: { _id: id },
                update: { $inc: { "stats.count": s.count, "stats.sum": s.sum }, $min: { "stats.min": s.min! }, $max: { "stats.max": s.max! } },
              },
            })),
            { ordered: false },
          )
        : null,
      latestByVehicle.size
        ? this.vehicles.bulkWrite(
            [...latestByVehicle].map(([id, sample]) => ({
              // Geç gelen eski bir ölçüm, daha yenisinin üzerine yazmasın.
              updateOne: {
                filter: { _id: id, $or: [{ lastSample: null }, { "lastSample.at": { $lte: sample.at } }] },
                update: { $set: { lastSample: sample } },
              },
            })),
            { ordered: false },
          )
        : null,
    ]);
  }

  async listReadings(sessionId: SessionId, since?: number) {
    const query = since == null ? { sessionId } : { sessionId, at: { $gte: since } };
    const docs = await this.readings.find(query, { projection: { _id: 0 } }).sort({ at: 1 }).toArray();
    return docs.map(({ sessionId: sid, vehicleId, bpm, at }) => ({ sessionId: sid, vehicleId, bpm, at }));
  }

  async queryReadings({ order, limit, after, vehicleId }: ReadingQuery): Promise<ReadingRow[]> {
    const dir = order === "asc" ? 1 : -1;
    const op = dir === 1 ? "$gt" : "$lt";
    const filter: Filter<ReadingDoc> = {};
    if (vehicleId) filter.vehicleId = vehicleId;
    if (after && ObjectId.isValid(after.id)) {
      // (at, _id) imleci: aynı milisaniyedeki ölçümler _id ile ayrılır, hiçbiri atlanmaz ya da tekrarlanmaz.
      filter.$or = [{ at: { [op]: after.at } }, { at: after.at, _id: { [op]: new ObjectId(after.id) } }];
    }
    const docs = await this.readings.find(filter).sort({ at: dir, _id: dir }).limit(limit).toArray();
    return docs.map(({ _id, sessionId, vehicleId: vid, bpm, at }) => ({ id: _id!.toHexString(), sessionId, vehicleId: vid, bpm, at }));
  }

  countReadings() {
    return this.readings.estimatedDocumentCount();
  }

  countAudit() {
    return this.audit.countDocuments();
  }
}

function toVehicle({ _id, ...rest }: VehicleDoc): Vehicle {
  return { id: _id, ...rest, lastSample: rest.lastSample ?? null };
}

function toSession({ _id, stats, ...rest }: SessionDoc): Session {
  const normalized: SessionStats = { count: stats.count, sum: stats.sum, min: stats.min ?? null, max: stats.max ?? null };
  return { id: _id, ...rest, stats: normalized };
}

function mapOrNull<T, R>(doc: T | null, map: (doc: T) => R): R | null {
  return doc ? map(doc) : null;
}

// ── Bağlantı ───────────────────────────────────────────────────────────────

/**
 * Bağlantı istemcisi süreç boyunca bir kez açılır. Depo nesnesi ise sınıfın kendisine bağlanır:
 * `next dev` kodu yeniden yüklediğinde eski sınıftan kalan örnek yeni metotları bilmez, yenisi kurulur.
 */
const globalForMongo = globalThis as unknown as {
  __amgMongoClient?: Promise<MongoClient>;
  __amgMongoRepo?: { owner: unknown; repository: Promise<MongoFleetRepository> };
};

export function connectMongoRepository(uri: string, dbName: string): Promise<MongoFleetRepository> {
  const cached = globalForMongo.__amgMongoRepo;
  if (cached?.owner === MongoFleetRepository) return cached.repository;

  const repository = connectClient(uri).then(async (client) => {
    const repo = new MongoFleetRepository(client.db(dbName));
    await repo.ensureIndexes();
    return repo;
  });
  globalForMongo.__amgMongoRepo = { owner: MongoFleetRepository, repository };
  repository.catch(() => {
    // Başarısız bağlantı önbellekte kalmasın; bir sonraki istek yeniden denesin.
    if (globalForMongo.__amgMongoRepo?.repository === repository) globalForMongo.__amgMongoRepo = undefined;
  });
  return repository;
}

function connectClient(uri: string): Promise<MongoClient> {
  globalForMongo.__amgMongoClient ??= (async () => {
    const client = new MongoClient(uri, {
      appName: "amg-pulse",
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 8_000,
    });
    await client.connect();
    return client;
  })().catch((error: unknown) => {
    globalForMongo.__amgMongoClient = undefined;
    throw error;
  });
  return globalForMongo.__amgMongoClient;
}
