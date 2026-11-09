#!/usr/bin/env node
/**
 * Promo senaryosu: canlı ekran kaydedilirken arkada admin işlemlerini sırayla oynatır.
 * Her adım gerçek admin API'si üzerinden yapılır (paneldeki işlemlerle aynı servisler, kayıtlara da düşer).
 *
 *   ./mercedesctl promo                 # yerel sunucu
 *   node scripts/promo.mts --url https://… --admin-key <ADMIN_PASSWORD> --ingest-key <INGEST_KEY>
 *
 * Kayıt için: canlı ekranı tam ekran aç (F), kayda başla, sonra bu betiği çalıştır. Süre ~95 sn.
 */
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    "admin-key": { type: "string" },
    "ingest-key": { type: "string" },
    countdown: { type: "string", default: "5" },
  },
});

// Boş değer (ör. .env.local'da "ADMIN_PASSWORD=") tanımsız sayılır ve sunucunun yerel varsayılanına düşer.
const pick = (...values: (string | undefined)[]) => values.find((v) => v != null && v.trim() !== "");
const BASE = (pick(args.url, process.env.AMG_URL) ?? "http://localhost:3000").replace(/\/+$/, "");
const ADMIN_KEY = pick(args["admin-key"], process.env.ADMIN_PASSWORD) ?? "amg-demo";
const INGEST_KEY = pick(args["ingest-key"], process.env.INGEST_KEY) ?? "dev-device-key";
const COUNTDOWN = Number(args.countdown);

// ── Senaryo ────────────────────────────────────────────────────────────────

type Step = { at: number; label: string; run: () => Promise<void> };

/** Sahne: saniye cinsinden zaman kodu (kayıt başından), açıklama, işlem. */
const SCENE: Step[] = [
  { at: 0, label: "Sahne hazırlığı: başlıklar, devir barı", run: () => settings({ title: "Canlı Nabız Takibi", subtitle: "Mercedes-AMG Araba Lansmanı · Test sürüşü", gauge: "bar" }) },
  { at: 4, label: "6. araç: sürüş bitti (bitiş bayrağı)", run: () => endSession("v6") },
  { at: 11, label: "8. araç: sürüş bitti (bitiş bayrağı)", run: () => endSession("v8") },
  { at: 18, label: "6. araca Emre Cansever biniyor (yarışçı tanıtımı)", run: () => assign("v6", "Emre", "Cansever") },
  { at: 26, label: "8. araca Yiğit Gümüş biniyor", run: () => assign("v8", "Yiğit", "Gümüş") },
  { at: 34, label: "4. araç kırmızı bölgede (8 sn nabız 170-188)", run: () => redline("band-04", 8_000) },
  { at: 46, label: "2. araçta sürücü değişiyor: önce bitiş, sonra Mira Tekin", run: () => assign("v2", "Mira", "Tekin") },
  { at: 60, label: "Gösterge: kadran", run: () => settings({ gauge: "dial" }) },
  { at: 72, label: "Gösterge: devir barı", run: () => settings({ gauge: "bar" }) },
  { at: 78, label: "5. araç: sürüş bitti", run: () => endSession("v5") },
  { at: 85, label: "5. araca Arda Yalçın biniyor (final)", run: () => assign("v5", "Arda", "Yalçın") },
  { at: 95, label: "Kayıt bitebilir", run: async () => undefined },
];

// ── Admin işlemleri ────────────────────────────────────────────────────────

async function api(method: string, path: string, body: unknown, headers: Record<string, string>) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
  return response.json();
}

const admin = (method: string, path: string, body: unknown) => api(method, path, body, { "X-Admin-Key": ADMIN_KEY });
const settings = (body: Record<string, string>) => admin("PUT", "/api/admin/settings", body).then(() => undefined);
const assign = (vehicleId: string, firstName: string, lastName: string) => admin("POST", "/api/admin/drivers", { vehicleId, firstName, lastName }).then(() => undefined);

/** Araçta sürüş yoksa sessizce geçer (senaryo her başlangıç durumunda çalışsın). */
async function endSession(vehicleId: string) {
  try {
    await admin("POST", "/api/admin/sessions/end", { vehicleId });
  } catch (error) {
    if (!String(error).includes("422")) throw error;
    info("  (araçta sürüş yoktu, geçildi)");
  }
}

/** Bileklik gibi saniyede 3 kez yüksek nabız gönderir; simülatörün 1 Hz değerlerini bastırır. */
async function redline(deviceId: string, durationMs: number) {
  const end = Date.now() + durationMs;
  let bpm = 166;
  while (Date.now() < end) {
    bpm = Math.min(188, bpm + 2 + Math.round(Math.random() * 2));
    await api("POST", "/api/ingest", { deviceId, bpm }, { "X-Device-Key": INGEST_KEY });
    await sleep(330);
  }
}

// ── Oynatıcı ───────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tc = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const info = (text: string) => console.log(`\x1b[2m${text}\x1b[0m`);

async function main() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error(`${BASE} yanıt vermiyor; önce: ./mercedesctl up`);
  // Yetkiyi baştan dene: kayıt ortasında 401 ile durmasın.
  await admin("PUT", "/api/admin/settings", {}).catch((error: unknown) => {
    if (String(error).includes("401")) throw new Error("Admin anahtarı reddedildi: .env.local ADMIN_PASSWORD sunucudakiyle aynı mı? (boşsa yerelde amg-demo)");
    throw error;
  });

  console.log(`\x1b[1m/////AMG promo\x1b[0m → ${BASE}  (${SCENE.at(-1)!.at} sn)`);
  for (let i = COUNTDOWN; i > 0; i--) {
    process.stdout.write(`\r  kayıt başlıyor: ${i} `);
    await sleep(1_000);
  }
  process.stdout.write("\r\x1b[K");

  const start = Date.now();
  for (const step of SCENE) {
    const wait = start + step.at * 1_000 - Date.now();
    if (wait > 0) await sleep(wait);
    console.log(`\x1b[31m▸\x1b[0m ${tc(step.at)}  ${step.label}`);
    try {
      await step.run();
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log("\x1b[1m✓ senaryo bitti\x1b[0m");
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
