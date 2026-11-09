import { NO_STORE } from "@/server/http";
import { buildOpenApiDocument } from "@/server/openapi";

/** GET /api/openapi.json — OpenAPI 3.1 sözleşmesi (Scalar /docs ve dış araçlar için). */
export function GET() {
  return Response.json(buildOpenApiDocument(), { headers: NO_STORE });
}
