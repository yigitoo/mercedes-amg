import { storageKind } from "@/server/env";
import { getRepository } from "@/server/db";
import { NO_STORE } from "@/server/http";

/** GET /api/health — mercedesctl ve izleme için: uygulama ayakta mı, veritabanına ulaşıyor mu? */
export async function GET() {
  const startedAt = Date.now();
  try {
    const vehicles = await (await getRepository()).listVehicles();
    return Response.json(
      { ok: true, storage: storageKind, vehicles: vehicles.length, latencyMs: Date.now() - startedAt },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[health]", error);
    return Response.json({ ok: false, storage: storageKind, error: "storage_unreachable" }, { status: 503, headers: NO_STORE });
  }
}
