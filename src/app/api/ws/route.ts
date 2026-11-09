import { upgradeWebSocket } from "@vercel/functions";
import { connection } from "next/server";

import { env } from "@/server/env";
import { jsonError } from "@/server/http";
import { getLiveSnapshot } from "@/server/services/live-service";

/** Vercel fonksiyonu en fazla bu kadar açık kalır; bağlantı süresi bunun biraz altında tutulur. */
export const maxDuration = 300;

const TICK_MS = 1_000;
/** Bağlantıyı süre dolmadan kendimiz kapatırız; ekran 1 sn sonra yeniden bağlanır (bkz. use-live-feed). */
const CONNECTION_LIFETIME_MS = 280_000;

/**
 * WS /api/ws — Vercel'de canlı ekran için WebSocket (Vercel Functions WebSocket desteği, @vercel/functions).
 * Her saniye `{"type":"snapshot","snapshot":...}` gönderir; mesaj biçimi server.mts'deki yayınla aynıdır.
 *
 * Yalnız DEPLOY_TARGET=vercel iken çalışır (bkz. env.deployTarget). Düz Node altyapısında (server.mts: pnpm dev /
 * start, deploy/) /api/ws upgrade'ini server.mts karşılar, bu route'a hiç gelinmez. Başka her durumda 404 döner,
 * el sıkışma başarısız olur ve ekran /api/stream (SSE) yedeğine geçer.
 */
export async function GET(request: Request) {
  await connection(); // statik ön-render'dan çık: upgrade yalnız istek anında
  if (env.deployTarget !== "vercel") return jsonError(404, "ws_unavailable");
  // Düz GET (tarayıcı adres çubuğu, izleme): upgradeWebSocket() hata fırlatmasın, ne beklendiğini söyle.
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket bekleniyor", { status: 426, headers: { Upgrade: "websocket", "Cache-Control": "no-store" } });
  }

  return upgradeWebSocket(
    (ws) => {
      let busy = false;
      const tick = async () => {
        if (busy || ws.readyState !== ws.OPEN) return; // yavaş bir sorgu üst üste binmesin
        busy = true;
        try {
          // getLiveSnapshot hata fırlatmaz; veritabanı yoksa son bilinen görüntüyü `stale` olarak döner.
          const snapshot = await getLiveSnapshot();
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "snapshot", snapshot }));
        } finally {
          busy = false;
        }
      };

      void tick();
      const timer = setInterval(tick, TICK_MS);
      // 1012: "service restart" — istemci kopma olarak görür ve yeniden bağlanır.
      const lifetime = setTimeout(() => ws.close(1012, "reconnect"), CONNECTION_LIFETIME_MS);
      ws.on("close", () => {
        clearInterval(timer);
        clearTimeout(lifetime);
      });
      ws.on("error", () => ws.terminate());
    },
    { maxPayload: 4 * 1024 }, // istemciden mesaj beklenmez
  );
}
