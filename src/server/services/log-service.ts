import "server-only";

import { zoneOf } from "@/domain/heart-rate";
import type { Driver, ReadingRow, Session, VehicleId } from "@/domain/types";
import { formatDateTime, formatTimeWithSeconds, fullName } from "@/lib/format";
import { getRepository } from "../db";
import type { ReadingCursor } from "../db/repository";
import { AUDIT_LABELS } from "./audit-service";

/** Logda bir nabız ölçümü: ham ölçüm + okunur bağlam (araç, sürücü). */
export interface ReadingLogRow extends ReadingRow {
  slot: number;
  plate: string;
  driver: Driver | null;
}

/** Canlı log: en yeni ölçümler (isteğe bağlı tek araç). */
export async function getReadingFeed(options: { limit: number; vehicleId?: VehicleId }): Promise<ReadingLogRow[]> {
  const repo = await getRepository();
  const [rows, vehicles, sessions] = await Promise.all([
    repo.queryReadings({ order: "desc", limit: options.limit, vehicleId: options.vehicleId }),
    repo.listVehicles(),
    repo.listSessions(),
  ]);
  return enrich(rows, vehicles, sessions);
}

function enrich(rows: ReadingRow[], vehicles: { id: string; slot: number }[], sessions: Session[]): ReadingLogRow[] {
  const slotOf = new Map(vehicles.map((v) => [v.id, v.slot]));
  const sessionOf = new Map(sessions.map((s) => [s.id, s]));
  return rows.map((row) => {
    const session = sessionOf.get(row.sessionId);
    return { ...row, slot: slotOf.get(row.vehicleId) ?? 0, plate: session?.plate ?? "", driver: session?.driver ?? null };
  });
}

// ── Dışa aktarma ───────────────────────────────────────────────────────────

export type ExportKind = "readings" | "audit";
export const EXPORT_KINDS: readonly ExportKind[] = ["readings", "audit"];

/** Tek seferde sunucudan istenen satır; istemci büyük veriyi bu boyutta parçalar halinde çeker. */
export const EXPORT_BATCH = 5_000;

export interface ExportPage {
  header: string[];
  rows: (string | number)[][];
  /** Sonraki parça için imleç; null ise bitti. */
  next: string | null;
  /** Toplam satır (ilerleme çubuğu için; tahmini olabilir). */
  total: number;
}

const encodeCursor = (cursor: ReadingCursor) => Buffer.from(JSON.stringify(cursor)).toString("base64url");
function decodeCursor(raw: string | null): ReadingCursor | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString()) as Partial<ReadingCursor>;
    return typeof parsed.at === "number" && typeof parsed.id === "string" ? { at: parsed.at, id: parsed.id } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Dışa aktarmanın bir sayfası. Ölçümler eskiden yeniye (at, id) imleciyle; denetim kaydı yeniden eskiye `at` imleciyle.
 * Toplam yalnız ilk sayfada hesaplanır (istemci saklar), sonraki sayfalar sayım sorgusu yapmaz.
 */
export async function getExportPage(kind: ExportKind, cursor: string | null): Promise<ExportPage> {
  return kind === "readings" ? readingsPage(cursor) : auditPage(cursor);
}

async function readingsPage(cursor: string | null): Promise<ExportPage> {
  const repo = await getRepository();
  const after = decodeCursor(cursor);
  const [rows, vehicles, sessions, total] = await Promise.all([
    repo.queryReadings({ order: "asc", limit: EXPORT_BATCH, after }),
    repo.listVehicles(),
    repo.listSessions(),
    after ? Promise.resolve(-1) : repo.countReadings(),
  ]);
  const enriched = enrich(rows, vehicles, sessions);
  const last = rows.at(-1);
  return {
    header: ["Tarih saat", "Saat", "Zaman (UTC)", "Araç", "Plaka", "Sürücü", "BPM", "Bölge", "Sürüş kimliği"],
    rows: enriched.map((r) => [
      formatDateTime(r.at),
      formatTimeWithSeconds(r.at),
      new Date(r.at).toISOString(),
      r.slot,
      r.plate,
      r.driver ? fullName(r.driver) : "",
      r.bpm,
      zoneOf(r.bpm).label,
      r.sessionId,
    ]),
    next: rows.length === EXPORT_BATCH && last ? encodeCursor({ at: last.at, id: last.id }) : null,
    total,
  };
}

async function auditPage(cursor: string | null): Promise<ExportPage> {
  const repo = await getRepository();
  const before = cursor ? Number(cursor) : undefined;
  const [entries, total] = await Promise.all([
    repo.listAudit({ limit: EXPORT_BATCH, before: Number.isFinite(before) ? before : undefined }),
    cursor ? Promise.resolve(-1) : repo.countAudit(),
  ]);
  const last = entries.at(-1);
  return {
    header: ["Tarih saat", "Zaman (UTC)", "İşlem", "Özet", "Değişiklikler"],
    rows: entries.map((e) => [
      formatDateTime(e.at),
      new Date(e.at).toISOString(),
      AUDIT_LABELS[e.action],
      e.summary,
      e.changes ? Object.entries(e.changes).map(([field, c]) => `${field}: ${c.from ?? "boş"} → ${c.to ?? "boş"}`).join(" | ") : "",
    ]),
    next: entries.length === EXPORT_BATCH && last ? String(last.at) : null,
    total,
  };
}
