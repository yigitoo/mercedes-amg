import "server-only";

import type { AuditAction, AuditEntry } from "@/domain/types";
import { getRepository } from "../db";

export type AuditInput = Omit<AuditEntry, "id" | "at"> & { at?: number };

/**
 * Denetim kaydı yazar. Kayıt yazılamazsa asıl işlem geri alınmaz (sürücü zaten atanmıştır);
 * hata loglanır. Etkinlik sırasında log altyapısı yüzünden sürücü değişimi durmamalı.
 */
export async function recordAudit({ at = Date.now(), ...entry }: AuditInput): Promise<void> {
  try {
    await (await getRepository()).appendAudit({ at, ...entry });
  } catch (error) {
    console.error("[audit] kayıt yazılamadı", entry.action, error);
  }
}

export async function listAudit(options: { limit: number; before?: number }) {
  return (await getRepository()).listAudit(options);
}

/** İki nesnenin seçili alanlarındaki farkı denetim kaydı biçiminde döner; değişiklik yoksa undefined. */
export function diffFields<T extends object>(before: T, after: T, labels: Partial<Record<keyof T & string, string>>) {
  const changes: NonNullable<AuditEntry["changes"]> = {};
  for (const [key, label] of Object.entries(labels) as [keyof T & string, string][]) {
    const from = before[key] == null ? null : String(before[key]);
    const to = after[key] == null ? null : String(after[key]);
    if (from !== to) changes[label] = { from, to };
  }
  return Object.keys(changes).length ? changes : undefined;
}

export const AUDIT_LABELS: Record<AuditAction, string> = {
  "admin.login": "Giriş",
  "admin.login_failed": "Hatalı giriş",
  "admin.logout": "Çıkış",
  "driver.assigned": "Sürücü atandı",
  "driver.renamed": "Ad düzeltildi",
  "session.ended": "Sürüş bitti",
  "vehicle.updated": "Araç düzenlendi",
  "settings.updated": "Ekran metni",
};
