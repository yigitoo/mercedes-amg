import { zoneOf } from "@/domain/heart-rate";
import { isAdminRequest } from "@/server/auth";
import { csvResponse, internalError, jsonError } from "@/server/http";
import { getSessionReadings } from "@/server/services/report-service";
import { formatTimeWithSeconds, fullName } from "@/lib/format";

/** GET /api/admin/sessions/:sessionId/csv — bir sürüşün saniye saniye ham nabız kaydı. */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/sessions/[sessionId]/csv">) {
  if (!(await isAdminRequest(request))) return jsonError(401, "unauthorized");
  const { sessionId } = await ctx.params;
  try {
    const data = await getSessionReadings(sessionId);
    if (!data) return jsonError(404, "session_not_found");
    const { session, readings } = data;
    const driver = fullName(session.driver);
    const rows = readings.map((r) => [formatTimeWithSeconds(r.at), new Date(r.at).toISOString(), session.plate, driver, r.bpm, zoneOf(r.bpm).label]);
    const slug = `${session.plate}-${driver}`.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşıöç]+/g, "-");
    return csvResponse(`amg-nabiz-${slug}.csv`, [["Saat", "Zaman (UTC)", "Plaka", "Sürücü", "BPM", "Bölge"], ...rows]);
  } catch (error) {
    return internalError("session-csv", error);
  }
}
