import "server-only";
import { cookies } from "next/headers";

import { env } from "./env";

/**
 * Admin oturumu: tek bir paylaşılan şifre (etkinlik ekibi) ve HMAC ile imzalı, süreli bir çerez.
 * Kullanıcı tablosu yok, bilerek basit. Web Crypto kullanıldığı için proxy.ts içinde de çalışır.
 */

export const ADMIN_COOKIE = "amg_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // bir etkinlik günü

const encoder = new TextEncoder();

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`amg-pulse:${env.adminPassword}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Buffer.from(signature).toString("base64url");
}

/** Sabit zamanlı karşılaştırma: imzayı tahmin etmeye çalışan biri süre farkından bilgi alamasın. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAdminToken(now = Date.now()): Promise<{ value: string; expires: Date }> {
  const exp = now + SESSION_TTL_MS;
  return { value: `${exp}.${await sign(`admin:${exp}`)}`, expires: new Date(exp) };
}

export async function verifyAdminToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [expRaw, signature] = token.split(".");
  const exp = Number(expRaw);
  if (!signature || !Number.isFinite(exp) || exp < now) return false;
  return safeEqual(signature, await sign(`admin:${exp}`));
}

export async function checkAdminPassword(candidate: string): Promise<boolean> {
  // İki tarafı da imzalayıp karşılaştırmak, uzunluk farkından bilgi sızmasını da önler.
  return safeEqual(await sign(`pw:${candidate}`), await sign(`pw:${env.adminPassword}`));
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * API yetkisi: tarayıcıdan oturum çerezi ya da otomasyondan (promo betiği, entegrasyon) `X-Admin-Key: <ADMIN_PASSWORD>`.
 * Anahtar sabit zamanlı karşılaştırılır (imzalanıp kıyaslanır, uzunluk bilgisi de sızmaz).
 */
export async function isAdminRequest(request: Request): Promise<boolean> {
  const key = request.headers.get("x-admin-key");
  if (key) return checkAdminPassword(key);
  return isAdmin();
}

/** Server action'ların ilk satırı. Proxy zaten yönlendirir; bu ikinci kilit doğrudan POST'lara karşı. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Yetkisiz: önce admin girişi yapın.");
}
