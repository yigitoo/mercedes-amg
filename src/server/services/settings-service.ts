import "server-only";

import type { EventSettings } from "@/domain/types";
import { getRepository } from "../db";
import { diffFields, recordAudit } from "./audit-service";

export async function getEventSettings(): Promise<EventSettings> {
  return (await getRepository()).getSettings();
}

/** Canlı ekran başlıklarını günceller; ekran bir sonraki saniyede yeni metni gösterir. */
export async function updateEventSettings(next: EventSettings): Promise<void> {
  const repo = await getRepository();
  const before = await repo.getSettings();
  const changes = diffFields(before, next, { title: "Başlık", subtitle: "Alt başlık", tagline: "Alt bant", gauge: "Gösterge" });
  if (!changes) return;
  await repo.saveSettings(next);
  await recordAudit({ action: "settings.updated", summary: "Canlı ekran metinleri güncellendi", changes });
}
