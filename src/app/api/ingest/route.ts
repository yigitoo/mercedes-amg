import { INGEST_MAX_BATCH, parseIngestSample, type IngestSample } from "@/domain/validation";
import { env } from "@/server/env";
import { hasDeviceKey, internalError, jsonError, NO_STORE } from "@/server/http";
import { ingestSamples } from "@/server/services/ingest-service";

/**
 * POST /api/ingest — araçtaki nabız bilekliği ölçtüğü nabzı buraya gönderir.
 *
 *   X-Device-Key: <INGEST_KEY>
 *   { "deviceId": "band-01", "bpm": 112, "at": 1762678800000 }
 *   ya da toplu: { "samples": [ { ... }, { ... } ] }
 *
 * Ayrıntı ve örnekler: /docs (Scalar) ve docs/API.md
 */
export async function POST(request: Request) {
  if (!hasDeviceKey(request, env.ingestKey)) return jsonError(401, "unauthorized");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json");
  }

  const raw = isBatch(body) ? body.samples : [body];
  if (raw.length === 0) return jsonError(400, "empty_batch");
  if (raw.length > INGEST_MAX_BATCH) return jsonError(413, "batch_too_large", { max: INGEST_MAX_BATCH });

  const now = Date.now();
  const valid: IngestSample[] = [];
  const rejected: { index: number; errors: Record<string, string | undefined> }[] = [];
  raw.forEach((item, index) => {
    const result = parseIngestSample(item, now);
    if (result.ok) valid.push(result.value);
    else rejected.push({ index, errors: result.errors });
  });

  try {
    const outcomes = valid.length ? await ingestSamples(valid) : [];
    const count = (o: string) => outcomes.filter((x) => x === o).length;
    return Response.json(
      {
        accepted: valid.length,
        logged: count("logged"),
        noSession: count("no-session"),
        unknownVehicle: count("unknown-vehicle"),
        rejected,
      },
      { status: valid.length ? 202 : 400, headers: NO_STORE },
    );
  } catch (error) {
    return internalError("ingest", error);
  }
}

function isBatch(body: unknown): body is { samples: unknown[] } {
  return typeof body === "object" && body !== null && Array.isArray((body as { samples?: unknown }).samples);
}
