import "server-only";

import { BPM_RANGE, SIGNAL_TIMEOUT_MS, ZONES, zoneRangeLabel } from "@/domain/heart-rate";
import { GAUGE_STYLES } from "@/domain/types";
import { INGEST_MAX_BATCH, MAX_CLOCK_SKEW_MS } from "@/domain/validation";
import { EXPORT_BATCH } from "./services/log-service";

/**
 * OpenAPI 3.1 sözleşmesi. /docs (Scalar) ve /api/openapi.json buradan beslenir.
 * Sınırlar ve kurallar koddaki sabitlerden okunur: kural değişince doküman kendiliğinden güncel kalır.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, example?: unknown) => ({ "application/json": { schema, ...(example === undefined ? {} : { example }) } });
const error = (description: string, code: string) => ({ description, content: json(ref("Error"), { error: code }) });

const zoneTable = ZONES.map((z) => `| ${z.label} | ${zoneRangeLabel(z)} |`).join("\n");

const DESCRIPTION = `
![Mercedes-AMG](/brand/logos/mercedes-amg-lockup.svg)

**Mercedes-AMG Araba Lansmanı**: test sürüşündeki 8 aracın sürücü nabzını canlı ekrana taşıyan sistemin API'si.
Araçtaki nabız bilekliği ölçümü \`POST /api/ingest\`'e gönderir; canlı ekran \`GET /api/stream\` ile saniyede bir günceller.

## Akış

1. Admin panelinde araca sürücü atanır (sürüş başlar).
2. Bileklik (\`band-01\` … \`band-08\`, N. araç = \`band-0N\`) ölçümleri gönderir.
3. Ölçüm aktif sürüşe yazılır, canlı ekrana 1 saniye içinde düşer.
4. İş bitiminde admin panelinden plaka bazında rapor ve tüm loglar CSV olarak alınır.

## Nabız bölgeleri

| Bölge | bpm |
| --- | --- |
${zoneTable}

Geçerli ölçüm aralığı ${BPM_RANGE.min}-${BPM_RANGE.max} bpm. ${SIGNAL_TIMEOUT_MS / 1000} sn veri gelmezse araç "sinyal yok" olur.

## Cihaz için öneri

Her ölçümü zaman damgasıyla kuyruğa ekleyin, saniyede bir kuyruğun tamamını gönderin, yalnız \`2xx\` yanıtta silin.
Bağlantı koparsa kuyruk birikir ve tek istekte (en fazla ${INGEST_MAX_BATCH}) gönderilir; veri kaybolmaz.
`;

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Mercedes-AMG Araba Lansmanı API",
      version: "1.0.0",
      description: DESCRIPTION.trim(),
    },
    servers: [{ url: "/", description: "Bu sunucu" }],
    tags: [
      { name: "Bileklik", description: "Araçtaki nabız bilekliğinin veri gönderdiği uç nokta." },
      { name: "Canlı ekran", description: "TV ekranı ve paylaşılan linkin okuduğu akış." },
      { name: "Admin", description: "Oturum çerezi gerektirir (admin paneline giriş)." },
      { name: "Sistem", description: "İzleme ve sağlık kontrolü." },
    ],
    paths: {
      "/api/ingest": {
        post: {
          tags: ["Bileklik"],
          summary: "Nabız ölçümü gönder",
          description: `Tek ölçüm ya da toplu gönderim (en fazla ${INGEST_MAX_BATCH}). Her ölçümün sonucu ayrı değerlendirilir; biri hatalıysa diğerleri yine yazılır. Cihaz saati ${MAX_CLOCK_SKEW_MS / 60_000} dakikadan fazla saparsa sunucu saati kullanılır.`,
          security: [{ deviceKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { oneOf: [ref("IngestSample"), ref("IngestBatch")] },
                examples: {
                  tek: { summary: "Tek ölçüm", value: { deviceId: "band-01", bpm: 118, at: 1794212400000 } },
                  toplu: {
                    summary: "Toplu (bağlantı koptuktan sonra)",
                    value: { samples: [{ deviceId: "band-01", bpm: 118, at: 1794212400000 }, { deviceId: "band-01", bpm: 121, at: 1794212401000 }] },
                  },
                },
              },
            },
          },
          responses: {
            "202": { description: "Kabul edildi", content: json(ref("IngestResult"), { accepted: 2, logged: 2, noSession: 0, unknownVehicle: 0, rejected: [] }) },
            "400": error("Geçersiz JSON, boş gönderim ya da hiçbir ölçüm geçerli değil", "invalid_json"),
            "401": error("X-Device-Key yanlış ya da yok", "unauthorized"),
            "413": error(`Toplu gönderim ${INGEST_MAX_BATCH} ölçümü aşıyor`, "batch_too_large"),
          },
        },
      },
      "/api/stream": {
        get: {
          tags: ["Canlı ekran"],
          summary: "Canlı akış (Server-Sent Events)",
          description:
            "Saniyede bir `snapshot` olayı. Veritabanına ulaşılamazsa akış kopmaz, `stale: true` ile son bilinen görüntü gelir. Akış 280 sn'de kapanır; `retry: 1000` ile tarayıcı yeniden bağlanır.",
          responses: {
            "200": {
              description: "`event: snapshot` + `data: <LiveSnapshot JSON>`",
              content: { "text/event-stream": { schema: { type: "string" }, example: 'event: snapshot\ndata: {"generatedAt":1794212400000,"stale":false,...}\n\n' } },
            },
          },
        },
      },
      "/api/live": {
        get: {
          tags: ["Canlı ekran"],
          summary: "Anlık görüntü (JSON)",
          description: "Akışla aynı veri, tek seferlik. SSE kullanamayan istemciler için.",
          responses: {
            "200": { description: "Güncel görüntü", content: json(ref("LiveSnapshot")) },
            "503": { description: "Veritabanına ulaşılamadı; son bilinen görüntü (`stale: true`)", content: json(ref("LiveSnapshot")) },
          },
        },
      },
      "/api/health": {
        get: {
          tags: ["Sistem"],
          summary: "Sağlık kontrolü",
          responses: {
            "200": { description: "Çalışıyor", content: json(ref("Health"), { ok: true, storage: "mongodb", vehicles: 8, latencyMs: 42 }) },
            "503": { description: "Veritabanına ulaşılamıyor", content: json(ref("Health"), { ok: false, storage: "mongodb", error: "storage_unreachable" }) },
          },
        },
      },
      "/api/admin/export": {
        get: {
          tags: ["Admin"],
          summary: "Tüm loglar, parça parça",
          description: `Dışa aktarmanın bir parçası (${EXPORT_BATCH.toLocaleString("tr-TR")} satır). \`next\` null olana kadar \`cursor\` ile istenir; toplam yalnız ilk parçada döner.`,
          security: [{ adminSession: [] }],
          parameters: [
            { name: "kind", in: "query", required: true, schema: { type: "string", enum: ["readings", "audit"] } },
            { name: "cursor", in: "query", required: false, schema: { type: "string" }, description: "Önceki parçanın `next` değeri." },
          ],
          responses: {
            "200": { description: "Bir parça", content: json(ref("ExportPage")) },
            "400": error("Geçersiz `kind`", "invalid_kind"),
            "401": error("Admin oturumu yok", "unauthorized"),
          },
        },
      },
      "/api/admin/reports/csv": {
        get: {
          tags: ["Admin"],
          summary: "Toplam rapor (CSV)",
          description: "Plaka başına tüm sürüşler: sürücü, başlangıç, bitiş, süre, ölçüm, ortalama, en düşük, en yüksek nabız. `;` ayırıcılı, Excel uyumlu UTF-8.",
          security: [{ adminSession: [] }],
          responses: { "200": { description: "CSV dosyası", content: { "text/csv": { schema: { type: "string" } } } }, "401": error("Admin oturumu yok", "unauthorized") },
        },
      },
      "/api/admin/sessions/{sessionId}/csv": {
        get: {
          tags: ["Admin"],
          summary: "Bir sürüşün ham nabız kaydı (CSV)",
          security: [{ adminSession: [] }],
          parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "CSV dosyası", content: { "text/csv": { schema: { type: "string" } } } },
            "401": error("Admin oturumu yok", "unauthorized"),
            "404": error("Sürüş bulunamadı", "session_not_found"),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        deviceKey: { type: "apiKey", in: "header", name: "X-Device-Key", description: "Tüm bilekliklerde aynı anahtar (`INGEST_KEY`)." },
        adminSession: { type: "apiKey", in: "cookie", name: "amg_admin", description: "Admin paneline girişte verilen imzalı oturum çerezi." },
      },
      schemas: {
        IngestSample: {
          type: "object",
          required: ["bpm"],
          properties: {
            deviceId: { type: "string", examples: ["band-01"], description: "Bileklik kimliği. `deviceId` ya da `plate` gerekli." },
            plate: { type: "string", examples: ["34 AMG 001"], description: "Plakayla eşleştirme (`34amg001` biçimi de kabul edilir)." },
            bpm: { type: "integer", minimum: BPM_RANGE.min, maximum: BPM_RANGE.max },
            at: { oneOf: [{ type: "integer", description: "epoch ms" }, { type: "string", format: "date-time" }], description: "Ölçüm zamanı; yoksa sunucu saati." },
          },
        },
        IngestBatch: { type: "object", required: ["samples"], properties: { samples: { type: "array", maxItems: INGEST_MAX_BATCH, items: ref("IngestSample") } } },
        IngestResult: {
          type: "object",
          properties: {
            accepted: { type: "integer", description: "Geçerli ölçüm sayısı" },
            logged: { type: "integer", description: "Aktif sürüşe yazılan" },
            noSession: { type: "integer", description: "Araçta sürücü yok: canlı değer güncellendi, rapora yazılmadı" },
            unknownVehicle: { type: "integer", description: "Hiçbir araçla eşleşmeyen" },
            rejected: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, errors: { type: "object", additionalProperties: { type: "string" } } } } },
          },
        },
        Driver: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" } } },
        EventSettings: {
          type: "object",
          properties: { title: { type: "string" }, subtitle: { type: "string" }, tagline: { type: "string" }, gauge: { type: "string", enum: [...GAUGE_STYLES] } },
        },
        LiveVehicle: {
          type: "object",
          properties: {
            id: { type: "string", examples: ["v1"] },
            slot: { type: "integer", minimum: 1, maximum: 8 },
            plate: { type: "string" },
            model: { type: "string" },
            status: { type: "string", enum: ["live", "no-signal", "idle"] },
            driver: { oneOf: [ref("Driver"), { type: "null" }] },
            sessionStartedAt: { type: ["integer", "null"] },
            bpm: { type: ["integer", "null"] },
            sampleAt: { type: ["integer", "null"] },
            stats: { type: ["object", "null"], properties: { avg: { type: ["integer", "null"] }, min: { type: ["integer", "null"] }, max: { type: ["integer", "null"] } } },
          },
        },
        LiveSnapshot: {
          type: "object",
          properties: { generatedAt: { type: "integer" }, stale: { type: "boolean" }, settings: ref("EventSettings"), vehicles: { type: "array", items: ref("LiveVehicle") } },
        },
        ExportPage: {
          type: "object",
          properties: {
            header: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: ["string", "number"] } } },
            next: { type: ["string", "null"] },
            total: { type: "integer", description: "İlk parçada toplam satır; sonrakilerde -1" },
          },
        },
        Health: { type: "object", properties: { ok: { type: "boolean" }, storage: { type: "string", enum: ["mongodb", "memory"] }, vehicles: { type: "integer" }, latencyMs: { type: "integer" }, error: { type: "string" } } },
        Error: { type: "object", required: ["error"], properties: { error: { type: "string" }, details: {} } },
      },
    },
  };
}
