import { NO_STORE } from "@/server/http";
import { getLiveSnapshot } from "@/server/services/live-service";

/** GET /api/live — canlı ekranın anlık görüntüsü (JSON). SSE kullanamayan istemciler için. */
export async function GET() {
  const snapshot = await getLiveSnapshot(); // hata fırlatmaz, bkz. live-service
  return Response.json(snapshot, { status: snapshot.stale ? 503 : 200, headers: NO_STORE });
}
