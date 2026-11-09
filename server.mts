/**
 * AMG Pulse sunucusu: Next.js + canlı ekran için WebSocket (/api/ws).
 *
 *   node server.mts                          # geliştirme (pnpm dev)
 *   NODE_ENV=production node server.mts      # üretim (pnpm start, önce pnpm build)
 *
 * Next.js route handler'ları WebSocket kabul edemediği için bağlantıyı bu süreç karşılar. Kaç ekran bağlı olursa olsun
 * sunucu saniyede TEK snapshot üretir (/api/live'ı süreç içinden okur) ve hepsine yayınlar; bağlı ekran yoksa durur.
 *
 * Vercel bu dosyayı çalıştırmaz (orada `next build` çıktısı fonksiyon olarak çalışır): /api/ws yoktur, istemci
 * bağlanamayınca /api/stream (SSE) akışına düşer. Bkz. src/components/live/use-live-feed.ts.
 */
import { createServer } from "node:http";

import next from "next";
import { WebSocket, WebSocketServer } from "ws";

const WS_PATH = "/api/ws";
const TICK_MS = 1_000;
/** Bu aralıkta pong gelmeyen bağlantı (uyuyan TV, kopmuş Wi-Fi) kapatılır. */
const HEARTBEAT_MS = 15_000;

const port = Number.parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

const server = createServer();
const app = next({ dev, hostname: "localhost", port, httpServer: server });
const handle = app.getRequestHandler();

await app.prepare();

server.on("request", (req, res) => void handle(req, res));

// --- WebSocket --------------------------------------------------------------------------------------------------
// Next de bu sunucuya bir `upgrade` dinleyicisi bağlar (geliştirmede HMR için); eşleşmeyen yolları bilinçli olarak
// bize bırakır. Bu yüzden src/app altında /api/ws diye bir route OLMAMALI.

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 4 * 1024 });
const alive = new WeakSet<WebSocket>();

server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname !== WS_PATH) return; // HMR vb. Next'e kalır
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

let last: string | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let busy = false;

wss.on("connection", (ws) => {
  alive.add(ws);
  ws.on("pong", () => alive.add(ws));
  ws.on("error", () => ws.terminate());
  ws.on("close", () => {
    if (wss.clients.size === 0) stopTicker();
  });
  // İstemci şu an mesaj göndermiyor; ileride komut eklenirse burası.
  ws.on("message", () => {});

  if (last) ws.send(last); // yeni ekran bir saniye beklemesin
  startTicker();
});

function startTicker() {
  if (timer) return;
  void tick();
  timer = setInterval(tick, TICK_MS);
}

function stopTicker() {
  clearInterval(timer);
  timer = undefined;
}

/**
 * Snapshot'ı /api/live'dan okur: aynı servis, aynı önbellek, aynı "hata fırlatmaz" kuralı (stale ise 503 + gövde).
 * Sunucuya hiç ulaşılamazsa mesaj gönderilmez; istemcinin bekçisi birkaç saniye sonra "bağlantı yok" der.
 */
async function tick() {
  if (busy) return; // yavaş bir sorgu üst üste binmesin
  busy = true;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/live`, { signal: AbortSignal.timeout(5_000) });
    const snapshot: unknown = await res.json();
    last = JSON.stringify({ type: "snapshot", snapshot });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(last);
    }
  } catch (error) {
    console.error("[ws] snapshot okunamadı", error instanceof Error ? error.message : error);
  } finally {
    busy = false;
  }
}

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, HEARTBEAT_MS);

// --- Başlat / kapat ----------------------------------------------------------------------------------------------

server.listen(port, () => {
  console.log(`> AMG Pulse http://localhost:${port} (${dev ? "geliştirme" : "üretim"}) · WebSocket ${WS_PATH}`);
});

function shutdown() {
  clearInterval(heartbeat);
  stopTicker();
  for (const ws of wss.clients) ws.close(1001, "server shutting down");
  server.close(() => process.exit(0));
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 3_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
