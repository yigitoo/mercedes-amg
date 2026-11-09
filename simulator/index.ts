#!/usr/bin/env node
/**
 * AMG Pulse simülatörü: 8 araçtaki nabız bilekliğini taklit eder ve /api/ingest'e gerçek
 * cihazlarla aynı biçimde nabız gönderir. Sunucu tarafında "sahte veri" modu yoktur; ekranda görülen her
 * değer bu istemciden ya da gerçek bilekliklerden gelir.
 *
 *   node simulator/index.ts                         # yerel: http://localhost:3000
 *   node simulator/index.ts --url https://amg.example.com --key <INGEST_KEY>
 *   node simulator/index.ts --devices 4 --dropout 0 --seed 7
 *
 * Seçenekler ve ortam değişkenleri: node simulator/index.ts --help
 */
import { parseArgs } from "node:util";

import { createRandom, HeartModel, randomProfile } from "./heart-model.ts";
import { Band } from "./band.ts";

const HELP = `AMG Pulse simülatörü

Kullanım: node simulator/index.ts [seçenekler]

  --url <adres>        Sunucu (varsayılan: $AMG_URL ya da http://localhost:3000)
  --key <anahtar>      X-Device-Key (varsayılan: $INGEST_KEY ya da yerel geliştirme anahtarı)
  --devices <1-8>      Kaç bileklik (varsayılan: 8 → band-01 … band-08)
  --interval <sn>      Gönderim aralığı (varsayılan: 1)
  --dropout <oran>     Bilekliğin dakikada kopma olasılığı (varsayılan: 0.04, kapatmak için 0)
  --seed <sayı>        Aynı tohum aynı sürüşü üretir (varsayılan: zamana göre)
  --quiet              Yalnız hataları yaz
  -h, --help           Bu yardım
`;

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    key: { type: "string" },
    devices: { type: "string", default: "8" },
    interval: { type: "string", default: "1" },
    dropout: { type: "string", default: "0.04" },
    seed: { type: "string" },
    quiet: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (args.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const baseUrl = (args.url ?? process.env.AMG_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const deviceKey = args.key ?? process.env.INGEST_KEY ?? "dev-device-key";
const deviceCount = clampInt(args.devices, 1, 8, "--devices");
const intervalSeconds = clampNumber(args.interval, 0.2, 60, "--interval");
const dropoutPerMinute = clampNumber(args.dropout, 0, 1, "--dropout");
const seed = args.seed ? clampInt(args.seed, 1, 2 ** 31, "--seed") : Date.now() % 2 ** 31;

const endpoint = `${baseUrl}/api/ingest`;
const random = createRandom(seed);
const bands = Array.from({ length: deviceCount }, (_, i) => {
  const deviceRandom = createRandom(seed + (i + 1) * 7919);
  return new Band({
    deviceId: `band-${String(i + 1).padStart(2, "0")}`,
    model: new HeartModel(randomProfile(random), deviceRandom),
    random: deviceRandom,
    dropoutChance: dropoutPerMinute / 60,
  });
});

log(`→ ${endpoint}  ·  ${deviceCount} bileklik  ·  ${intervalSeconds} sn  ·  tohum ${seed}`);

let running = true;
let lastFailure = "";
// İlk istek veritabanı bağlantısını açar (soğuk başlangıç); kısa zaman aşımı gereksiz yeniden deneme yaratır.
const timeoutMs = Math.max(5_000, intervalSeconds * 1000 * 3);

async function tick() {
  for (const band of bands) band.measure(intervalSeconds);
  const results = await Promise.all(bands.map((p) => p.flush(endpoint, deviceKey, timeoutMs)));

  const failure = results.find((r) => !r.ok);
  if (failure && !failure.ok) {
    // Aynı hatayı her saniye basma; değişince ya da düzelince yaz.
    if (failure.reason !== lastFailure) console.error(`✗ gönderilemedi (${failure.reason}), ölçümler kuyrukta bekliyor`);
    lastFailure = failure.reason;
    return;
  }
  if (lastFailure) log("✓ bağlantı geri geldi, kuyruk gönderildi");
  lastFailure = "";
  if (!args.quiet) printStatus();
}

function printStatus() {
  const line = bands.map((p) => `${p.deviceId.slice(-2)}:${p.bandConnected ? String(p.lastBpm ?? "--").padStart(3) : "  ✗"}`).join("  ");
  if (process.stdout.isTTY) process.stdout.write(`\r${line}`);
  else log(line);
}

async function loop() {
  while (running) {
    const started = Date.now();
    await tick();
    const wait = intervalSeconds * 1000 - (Date.now() - started);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    running = false;
    process.stdout.write("\n");
    log("simülatör durdu");
    process.exit(0);
  });
}

void loop();

// ── yardımcılar ───────────────────────────────────────────────────────────

function log(message: string) {
  console.log(`[${new Date().toLocaleTimeString("tr-TR")}] ${message}`);
}

function clampNumber(raw: string | undefined, min: number, max: number, flag: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    console.error(`${flag} ${min} ile ${max} arasında olmalı (verilen: ${raw})`);
    process.exit(2);
  }
  return value;
}

function clampInt(raw: string | undefined, min: number, max: number, flag: string): number {
  return Math.round(clampNumber(raw, min, max, flag));
}
