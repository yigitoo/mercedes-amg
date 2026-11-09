"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Sunucu bileşenli sayfayı belirli aralıkla tazeler (admin'de canlı nabız ve süre).
 * Açık bir diyalog varken tazelemez; kullanıcının yazdığı form bozulmasın.
 */
export function AutoRefresh({ intervalMs = 3_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !document.querySelector("dialog[open]")) router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
