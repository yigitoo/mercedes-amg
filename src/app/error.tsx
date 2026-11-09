"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Beklenmeyen hata: ekran boş kalmasın, tek tuşla yeniden denenebilsin (TV başında klavye olmayabilir, 15 sn'de kendisi dener). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    const retry = setTimeout(reset, 15_000);
    return () => clearTimeout(retry);
  }, [error, reset]);

  return (
    <main className="carbon grid min-h-[100dvh] place-items-center p-6 text-center">
      <div>
        <p className="font-title text-2xl font-bold">Veriye şu an ulaşılamıyor</p>
        <p className="mt-2 text-muted">Ekran 15 saniye içinde kendini yeniden deneyecek.</p>
        <Button variant="primary" className="mt-6" onClick={reset}>
          Şimdi dene
        </Button>
      </div>
    </main>
  );
}
