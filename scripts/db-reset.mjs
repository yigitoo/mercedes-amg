#!/usr/bin/env node
/**
 * Etkinlik veritabanını sıfırlar: sürüşler, ölçümler, denetim kaydı, ayarlar ve araçlar silinir.
 * Uygulama bir sonraki istekte 8 aracı yeniden tohumlar (DEMO_SEED=true ise örnek sürücülerle).
 * `./mercedesctl db:reset` üzerinden çağrılır (onay ister); bağlantı .env.local'dan okunur.
 */
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);

const uri = process.env.MONGODB_URI || env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || env.MONGODB_DB || "amg_pulse";
if (!uri) {
  console.error("MONGODB_URI yok: bellek modunda sıfırlamak için sunucuyu yeniden başlatmak yeterli (mercedesctl restart).");
  process.exit(2);
}

const COLLECTIONS = ["readings", "sessions", "audit_log", "settings", "vehicles"];
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
try {
  await client.connect();
  const db = client.db(dbName);
  for (const name of COLLECTIONS) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`  ${name.padEnd(10)} ${deletedCount} kayıt silindi`);
  }
  console.log(`✓ ${dbName} sıfırlandı`);
} finally {
  await client.close();
}
