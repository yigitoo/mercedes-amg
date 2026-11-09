import "server-only";

import { toCsv, type CsvCell } from "@/lib/csv";

import { DomainError } from "./errors";

/** API uç noktalarının ortak yanıt biçimleri: hata gövdesi her zaman `{ error, details? }`. */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonError(status: number, error: string, details?: unknown) {
  return Response.json(details === undefined ? { error } : { error, details }, { status, headers: NO_STORE });
}

/**
 * `X-Device-Key` başlığını sabit zamanlı karşılaştırır. Bileklikler etkinlik boyunca aynıdır;
 * cihazlara tek bir sabit anahtar gömülür, anahtar değişirse yalnız INGEST_KEY güncellenir.
 */
export function hasDeviceKey(request: Request, expected: string): boolean {
  const token = request.headers.get("x-device-key")?.trim() ?? "";
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Beklenmeyen hatayı loglar ve istemciye iç ayrıntı sızdırmadan 500 döner. */
export function internalError(scope: string, error: unknown) {
  if (error instanceof DomainError) return jsonError(422, error.message);
  console.error(`[${scope}]`, error);
  return jsonError(500, "internal_error");
}

export function csvResponse(filename: string, rows: CsvCell[][]) {
  return new Response(toCsv(rows), {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
