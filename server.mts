/**
 * AMG Pulse sunucusu: Next.js + canlı ekran için WebSocket (/api/ws).
 *
 *   node server.mts                          # geliştirme (pnpm dev)
 *   NODE_ENV=production node server.mts      # üretim (pnpm start, önce pnpm build)
 *
 * Next.js'in kendi sunucusu (next dev / next start) WebSocket upgrade'ini route'a iletmez; bu süreç /api/ws'i kendisi
 * karşılar. Kaç ekran bağlı olursa olsun saniyede TEK snapshot üretir (/api/live'ı süreç içinden okur) ve hepsine
 * yayınlar; bağlı ekran yoksa durur.
 *
 * Vercel bu dosyayı çalıştırmaz; orada /api/ws, src/app/api/ws/route.ts (Vercel Functions WebSocket) ile sunulur.
 * İkisi de olmazsa ekran /api/stream (SSE) yedeğine geçer. İstemci tarafı: src/components/live/use-live-feed.ts.
 */
import { EventEmitter } from "node:events";
import { createServer, type Server } from "node:http";

import next from "next";
import { WebSocket, WebSocketServer } from "ws";

const WS_PATH = "/api/ws";
const TICK_MS = 1_000;
/** Bu aralıkta pong gelmeyen bağlantı (uyuyan TV, kopmuş Wi-Fi) kapatılır. */
const HEARTBEAT_MS = 15_000;

const port = Number.parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

const server = createServer();
// Next, `httpServer`'a kendi `upgrade` dinleyicisini bağlar (HMR). Gerçek sunucuyu verseydik /api/ws upgrade'ini de
// görür, orada bir route (Vercel için) olduğundan soketi kapatırdı. Ona yalnız bizim ilettiğimiz upgrade'leri gören
// sahte bir yayıcı veriyoruz.
const nextUpgrades = new EventEmitter();
const app = next({ dev, hostname: "localhost", port, httpServer: nextUpgrades as unknown as Server });
const handle = app.getRequestHandler();

await app.prepare();

server.on("request", (req, res) => void handle(req, res));

// --- WebSocket --------------------------------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 4 * 1024 });
const alive = new WeakSet<WebSocket>();

server.on("upgrade", (req, socket, head) => {
  // URL.parse hata fırlatmaz: bozuk istek hedefi (ör. `//[`) süreci düşürmesin.
  const pathname = URL.parse(req.url ?? "/", "http://localhost")?.pathname;
  if (pathname == null) return void socket.destroy();
  if (pathname !== WS_PATH) return void nextUpgrades.emit("upgrade", req, socket, head); // HMR vb. Next'e
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
  last = null; // ekran yokken veri eskir; sonraki ekrana eski görüntü gönderilmesin
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
  // .env dosyaları app.prepare() ile yüklendi. Bu sunucu düz Node altyapısıdır; "vercel" burada bir yanlışlıktır.
  if (process.env.DEPLOY_TARGET?.trim() === "vercel") {
    console.warn("[ws] DEPLOY_TARGET=vercel ama server.mts çalışıyor: WebSocket'i yine bu süreç sunar. Burada node yazın ya da boş bırakın.");
  }
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
