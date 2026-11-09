import type { Metadata } from "next";

import { LiveWall } from "@/components/live/live-wall";
import { getLiveSnapshot, getRecentHistory } from "@/server/services/live-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Canlı Nabız" };

/** Canlı ekran. İlk görüntü sunucuda hazırlanır, sonrası /api/ws (WebSocket) ile saniyede bir güncellenir. */
export default async function LivePage() {
  const snapshot = await getLiveSnapshot(); // hata fırlatmaz: veritabanı yoksa son bilinen görüntü
  return <LiveWall initial={snapshot} initialHistory={await getRecentHistory(snapshot)} />;
}
