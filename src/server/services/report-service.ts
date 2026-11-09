import "server-only";

import { mergeStats, summarize } from "@/domain/heart-rate";
import { bucketAverage, bucketSizeFor, zoneShare, type ZoneShare } from "@/domain/series";
import type { HeartRateSample, Session, SessionId, Vehicle } from "@/domain/types";
import { getRepository } from "../db";

/** Grafikte gösterilecek en fazla nokta. */
const CHART_POINTS = 600;

export interface SessionSummary {
  session: Session;
  durationMs: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface VehicleReport {
  vehicle: Vehicle;
  sessions: SessionSummary[];
  totalDurationMs: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface FleetReport {
  generatedAt: number;
  vehicles: VehicleReport[];
  totals: { sessions: number; drivers: number; durationMs: number; readings: number };
}

export interface SessionReport extends SessionSummary {
  generatedAt: number;
  vehicle: Vehicle | null;
  series: HeartRateSample[];
  zones: ZoneShare;
  readingCount: number;
}

/** İş bitimindeki toplam rapor: her plaka altında o araçtaki tüm sürüşler. */
export async function getFleetReport(): Promise<FleetReport> {
  const repo = await getRepository();
  const now = Date.now();
  const [vehicles, sessions] = await Promise.all([repo.listVehicles(), repo.listSessions()]);

  const reports = vehicles.map((vehicle) => {
    const own = sessions.filter((s) => s.vehicleId === vehicle.id).map((s) => summarizeSession(s, now));
    const merged = mergeStats(own.map((s) => s.session.stats));
    return {
      vehicle,
      sessions: own,
      totalDurationMs: own.reduce((sum, s) => sum + s.durationMs, 0),
      ...summarize(merged),
    };
  });

  const drivers = new Set(sessions.map((s) => `${s.driver.firstName} ${s.driver.lastName}`.toLocaleLowerCase("tr-TR")));
  return {
    generatedAt: now,
    vehicles: reports,
    totals: {
      sessions: sessions.length,
      drivers: drivers.size,
      durationMs: reports.reduce((sum, r) => sum + r.totalDurationMs, 0),
      readings: sessions.reduce((sum, s) => sum + s.stats.count, 0),
    },
  };
}

export async function getSessionReport(id: SessionId): Promise<SessionReport | null> {
  const repo = await getRepository();
  const session = await repo.findSession(id);
  if (!session) return null;

  const [vehicle, readings] = await Promise.all([repo.findVehicle(session.vehicleId), repo.listReadings(id)]);
  const generatedAt = Date.now();
  return {
    ...summarizeSession(session, generatedAt),
    generatedAt,
    vehicle,
    series: bucketAverage(readings, bucketSizeFor(readings, CHART_POINTS)),
    zones: zoneShare(readings),
    readingCount: readings.length,
  };
}

export async function getSessionReadings(id: SessionId) {
  const repo = await getRepository();
  const session = await repo.findSession(id);
  return session ? { session, readings: await repo.listReadings(id) } : null;
}

function summarizeSession(session: Session, now: number): SessionSummary {
  return { session, durationMs: (session.endedAt ?? now) - session.startedAt, ...summarize(session.stats) };
}
