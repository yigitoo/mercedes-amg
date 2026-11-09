import "server-only";

import { isAdminRequest } from "./auth";
import { DomainError } from "./errors";
import { internalError, jsonError, NO_STORE } from "./http";

/**
 * Admin REST uç noktalarının ortak kalıbı: yetki → JSON gövde → işlem → yanıt.
 * İş kuralları servislerde; burası yalnız taşıma. Doğrulama hataları 400, iş kuralı hataları 422 döner.
 */
export async function adminJsonRoute(request: Request, scope: string, handle: (body: Record<string, unknown>) => Promise<unknown>) {
  if (!(await isAdminRequest(request))) return jsonError(401, "unauthorized");
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return jsonError(400, "invalid_body");
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError(400, "invalid_json");
  }
  try {
    const result = await handle(body);
    return Response.json(result ?? { ok: true }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ValidationFailure) return jsonError(400, "validation_failed", error.errors);
    if (error instanceof DomainError) return jsonError(422, error.message, error.field ? { field: error.field } : undefined);
    return internalError(`admin-api:${scope}`, error);
  }
}

/** Alan bazlı doğrulama hatası; adminJsonRoute 400'e çevirir. */
export class ValidationFailure extends Error {
  constructor(readonly errors: Record<string, string | undefined>) {
    super("validation_failed");
  }
}

export const str = (body: Record<string, unknown>, key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
