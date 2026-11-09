import "server-only";

/**
 * Ortam değişkenleri tek yerden okunur. Eksik ya da hatalı yapılandırma, ilk kullanımda anlaşılır bir mesajla
 * yakalanır; kodun geri kalanı `process.env`'e dokunmaz.
 */

const isProduction = process.env.NODE_ENV === "production";

/** Yerel geliştirmede kolay başlangıç için; üretimde asla kullanılmaz. */
const DEV_ADMIN_PASSWORD = "amg-demo";
const DEV_INGEST_KEY = "dev-device-key";

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function secret(name: string, devFallback: string): string {
  const value = optional(name);
  if (value) return value;
  if (isProduction) {
    throw new Error(`${name} tanımlı değil. Vercel'de Settings > Environment Variables'a, sunucuda deploy/.env'e ekleyin.`);
  }
  return devFallback;
}

/**
 * Uygulamanın nerede çalıştığı. Canlı ekranın WebSocket'ini kimin sunacağını belirler:
 *   vercel: src/app/api/ws/route.ts (Vercel Functions WebSocket; her bağlantı kendi fonksiyonunda, 280 sn'de yenilenir)
 *   node:   server.mts (düz Node süreci: pnpm dev / start, deploy/ Docker; tek yayın tüm ekranlara)
 * Boşsa otomatik: Vercel'in kendi koyduğu VERCEL=1 varsa "vercel", değilse "node".
 */
export type DeployTarget = "vercel" | "node";
const DEPLOY_TARGETS: readonly DeployTarget[] = ["vercel", "node"];

function deployTarget(): DeployTarget {
  const value = optional("DEPLOY_TARGET");
  if (!value) return process.env.VERCEL === "1" ? "vercel" : "node";
  if ((DEPLOY_TARGETS as readonly string[]).includes(value)) return value as DeployTarget;
  throw new Error(`DEPLOY_TARGET "${value}" geçersiz: "vercel" ya da "node" olmalı (boş: otomatik).`);
}

export const env = {
  isProduction,

  /** vercel | node; bkz. DeployTarget. */
  get deployTarget() {
    return deployTarget();
  },

  /** Boşsa veriler bellekte tutulur (yalnız tek süreçli yerel geliştirme için). */
  mongodbUri: optional("MONGODB_URI"),
  mongodbDb: optional("MONGODB_DB") ?? "amg_pulse",

  get adminPassword() {
    return secret("ADMIN_PASSWORD", DEV_ADMIN_PASSWORD);
  },
  /** Bilekliklerin `X-Device-Key` başlığında gönderdiği ortak anahtar. */
  get ingestKey() {
    return secret("INGEST_KEY", DEV_INGEST_KEY);
  },

  /** true ise boş veritabanına örnek sürücüler atanır; deneme ve sunum için. */
  seedDemoDrivers: optional("DEMO_SEED") === "true",
};

export type StorageKind = "mongodb" | "memory";
export const storageKind: StorageKind = env.mongodbUri ? "mongodb" : "memory";
