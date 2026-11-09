import { getLiveSnapshot } from "@/server/services/live-service";

/** Vercel fonksiyonu en fazla bu kadar açık kalır; akış süresi bunun biraz altında tutulur. */
export const maxDuration = 300;

const TICK_MS = 1_000;
/** Bağlantıyı süre dolmadan kendimiz kapatırız; tarayıcının EventSource'u `retry` kadar bekleyip yeniden bağlanır. */
const STREAM_LIFETIME_MS = 280_000;
const RECONNECT_DELAY_MS = 1_000;

/**
 * GET /api/stream — canlı ekran için Server-Sent Events.
 * Her saniye bir `snapshot` olayı gönderir. Veritabanı geçici olarak yanıt vermezse akış kopmaz:
 * snapshot `stale: true` gelir, ekran son bilinen değerlerle kalır ve sonraki saniye yeniden dener.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let busy = false;

      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearTimeout(lifetime);
        controller.close();
      };

      const tick = async () => {
        if (busy || closed) return; // yavaş bir sorgu üst üste binmesin
        busy = true;
        try {
          // getLiveSnapshot hata fırlatmaz; veritabanı yoksa son bilinen görüntüyü `stale` olarak döner.
          send("snapshot", await getLiveSnapshot());
        } finally {
          busy = false;
        }
      };

      controller.enqueue(encoder.encode(`retry: ${RECONNECT_DELAY_MS}\n\n`));
      void tick();
      timer = setInterval(tick, TICK_MS);
      lifetime = setTimeout(close, STREAM_LIFETIME_MS);
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      clearInterval(timer);
      clearTimeout(lifetime);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
