import { isAdminRequest } from "@/server/auth";
import { internalError, jsonError, NO_STORE } from "@/server/http";
import { EXPORT_KINDS, getExportPage, type ExportKind } from "@/server/services/log-service";

/**
 * GET /api/admin/export?kind=readings|audit&cursor=<imleç>
 * Dışa aktarmanın bir parçası (5.000 satır). İstemci `next` null olana kadar ister, CSV'yi tarayıcıda birleştirir;
 * böylece tek bir istek büyük veride zaman aşımına düşmez ve ilerleme gösterilebilir.
 */
export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return jsonError(401, "unauthorized");
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as ExportKind;
  if (!EXPORT_KINDS.includes(kind)) return jsonError(400, "invalid_kind", { allowed: EXPORT_KINDS });
  try {
    return Response.json(await getExportPage(kind, url.searchParams.get("cursor")), { headers: NO_STORE });
  } catch (error) {
    return internalError("export", error);
  }
}
