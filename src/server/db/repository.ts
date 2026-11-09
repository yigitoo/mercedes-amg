/**
 * Veri erişim sözleşmesi. Servisler yalnız bu arayüzü bilir (Dependency Inversion);
 * MongoDB ve bellek uygulamaları birbirinin yerine geçebilir, yeni bir depo eklemek için tek dosya yazılır.
 */
import type { AuditEntry, Driver, EventSettings, Reading, ReadingRow, Session, SessionId, Vehicle, VehicleId } from "@/domain/types";
import type { VehicleInput } from "@/domain/validation";

export interface NewSession {
  vehicleId: VehicleId;
  plate: string;
  driver: Session["driver"];
  startedAt: number;
}

/** Tek bir ölçümün yazılacağı yer: aracın son değeri her zaman, sürüş kaydı yalnız aktif sürüş varsa. */
export interface SampleWrite {
  vehicleId: VehicleId;
  sessionId: SessionId | null;
  bpm: number;
  at: number;
}

/** Sayfalama imleci: (zaman, kimlik) çifti. Aynı milisaniyede birden fazla ölçüm olsa da kayıt atlanmaz. */
export interface ReadingCursor {
  at: number;
  id: string;
}

export interface ReadingQuery {
  /** "asc": dışa aktarma (eskiden yeniye), "desc": canlı log (yeniden eskiye). */
  order: "asc" | "desc";
  limit: number;
  /** Bu imleçten sonrası (sıralama yönünde). */
  after?: ReadingCursor;
  vehicleId?: VehicleId;
}

export interface FleetRepository {
  // Araçlar
  listVehicles(): Promise<Vehicle[]>;
  findVehicle(id: VehicleId): Promise<Vehicle | null>;
  findVehicleByDevice(deviceId: string): Promise<Vehicle | null>;
  findVehicleByPlate(plate: string): Promise<Vehicle | null>;
  /** Boş depoya ilk araçları yazar; araç varsa hiçbir şey yapmaz. */
  seedVehicles(vehicles: Vehicle[]): Promise<void>;
  updateVehicle(id: VehicleId, input: VehicleInput): Promise<void>;

  // Sürüşler
  listActiveSessions(): Promise<Session[]>;
  findActiveSession(vehicleId: VehicleId): Promise<Session | null>;
  findSession(id: SessionId): Promise<Session | null>;
  /** En yeni önce. */
  listSessions(filter?: { vehicleId?: VehicleId }): Promise<Session[]>;
  createSession(input: NewSession): Promise<Session>;
  endSession(id: SessionId, endedAt: number): Promise<void>;
  /** Yazım hatası düzeltme: sürüş ve ölçümler aynı kalır, yalnız ad değişir. */
  renameSessionDriver(id: SessionId, driver: Driver): Promise<void>;

  // Etkinlik ayarları (tek belge)
  getSettings(): Promise<EventSettings>;
  saveSettings(settings: EventSettings): Promise<void>;

  // Denetim kaydı (yalnız ekleme; silinmez, değiştirilmez)
  appendAudit(entry: Omit<AuditEntry, "id">): Promise<void>;
  /** En yeni önce; `before` verilirse o zamandan eskiler (sayfalama). */
  listAudit(options: { limit: number; before?: number }): Promise<AuditEntry[]>;

  // Ölçümler
  /**
   * Bir grup ölçümü toplu yazar: araçların son değeri, sürüş kayıtları ve sürüş istatistikleri.
   * Kaç ölçüm olursa olsun depoya sabit sayıda gidiş-dönüş yapılmalı (bileklik kuyruğu yüzlerce ölçüm getirebilir).
   */
  recordSamples(samples: SampleWrite[]): Promise<void>;
  /** Zaman sırasıyla; `since` verilirse o andan sonrakiler (canlı ekranın açılış izi). */
  listReadings(sessionId: SessionId, since?: number): Promise<Reading[]>;
  /** Tüm sürüşlerin ölçümleri, sayfalı (log ve dışa aktarma). */
  queryReadings(query: ReadingQuery): Promise<ReadingRow[]>;
  countReadings(): Promise<number>;
  countAudit(): Promise<number>;
}

/** Bir vehicle'ı plaka/cihaz değişse bile kalıcı tutan kimlik: "v1".."v8". */
export const vehicleIdForSlot = (slot: number): VehicleId => `v${slot}`;
