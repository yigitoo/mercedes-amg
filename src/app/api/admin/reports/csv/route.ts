import { isAdminRequest } from "@/server/auth";
import { csvResponse, internalError, jsonError } from "@/server/http";
import { getFleetReport } from "@/server/services/report-service";
import { formatDateTime, formatDuration, fullName } from "@/lib/format";

/** GET /api/admin/reports/csv — iş bitimi toplam rapor: plaka başına tüm sürüşler, tek tablo. */
export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError(401, "unauthorized");
  try {
    const report = await getFleetReport();
    const header = ["Araç", "Plaka", "Model", "Sürücü", "Başlangıç", "Bitiş", "Süre", "Ölçüm", "Ort. BPM", "Min BPM", "Maks BPM"];
    const rows = report.vehicles.flatMap(({ vehicle, sessions }) =>
      sessions.map(({ session, durationMs, avg, min, max }) => [
        vehicle.slot,
        session.plate,
        vehicle.model,
        fullName(session.driver),
        formatDateTime(session.startedAt),
        session.endedAt ? formatDateTime(session.endedAt) : "devam ediyor",
        formatDuration(durationMs),
        session.stats.count,
        avg,
        min,
        max,
      ]),
    );
    return csvResponse(`amg-nabiz-rapor-${new Date(report.generatedAt).toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  } catch (error) {
    return internalError("reports-csv", error);
  }
}
