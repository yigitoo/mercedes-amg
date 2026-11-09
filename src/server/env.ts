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
  if (isProduction) throw new Error(`${name} tanımlı değil. Vercel > Settings > Environment Variables'a ekleyin.`);
  return devFallback;
}

export const env = {
  isProduction,

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
