"use client";

import { useSyncExternalStore } from "react";

import type { HeartRateSample, LiveSnapshot, VehicleId } from "@/domain/types";
import { AmgLogo, MercedesBenzLockup } from "@/components/brand/logos";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import { TimingTower } from "./timing-tower";
import { useLiveFeed, type FeedStatus } from "./use-live-feed";
import { VehicleTile } from "./vehicle-tile";

/**
 * Canlı ekran (65" TV ve paylaşılan web linki).
 *   TV / masaüstü (xl+): 4×2 araç ızgarası + sağda sıralama kulesi, tek ekrana sığar, kaydırma yok.
 *   Tablet: 2 sütun, mobil: tek sütun; sıralama kulesi gizlenir (kartlar zaten görünür).
 */
export function LiveWall({ initial, initialHistory }: { initial: LiveSnapshot; initialHistory: Record<VehicleId, HeartRateSample[]> }) {
  const { snapshot, history, status } = useLiveFeed(initial, initialHistory);

  return (
    <div className="carbon flex min-h-[100dvh] flex-col gap-4 p-4 xl:h-[100dvh] xl:gap-5 xl:p-6 [--carbon-opacity:0.025]">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <MercedesBenzLockup className="text-lg xl:text-xl" />
        <span className="hidden h-10 w-px bg-line-strong sm:block" aria-hidden />
        <div className="mr-auto">
          <h1 className="font-title text-xl leading-none font-bold xl:text-2xl">{snapshot.settings.title}</h1>
          {snapshot.settings.subtitle && <p className="mt-1.5 text-sm text-muted">{snapshot.settings.subtitle}</p>}
        </div>
        <FeedIndicator status={status} />
        <Clock />
      </header>

      <main className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1fr_20rem] xl:gap-5 2xl:grid-cols-[1fr_22rem]">
        {/* Kokpit ızgarası: paneller arası 1px saç çizgisi (zemin rengi boşluktan görünür). */}
        <div className="grid min-h-0 grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2">
          {snapshot.vehicles.map((vehicle) => (
            <VehicleTile key={vehicle.id} vehicle={vehicle} history={history[vehicle.id] ?? []} now={snapshot.generatedAt} gauge={snapshot.settings.gauge} />
          ))}
        </div>
        <div className="hidden min-h-0 xl:flex xl:flex-col">
          <TimingTower vehicles={snapshot.vehicles} />
        </div>
      </main>

      <footer className="flex items-center justify-between gap-6">
        <span className="font-title text-sm font-bold tracking-[0.16em] text-soft">{snapshot.settings.tagline}</span>
        <AmgLogo className="h-4 w-auto text-fg xl:h-5" />
      </footer>
    </div>
  );
}

const FEED_LABEL: Record<FeedStatus, string> = {
  connecting: "Bağlanıyor",
  live: "Canlı",
  degraded: "Veri gecikiyor",
  offline: "Bağlantı yok",
};

function FeedIndicator({ status }: { status: FeedStatus }) {
  return (
    <span
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-sm border px-3 py-1.5 font-label text-sm tracking-wider uppercase",
        status === "live" ? "border-line-strong text-fg" : "border-amg text-amg-text",
      )}
    >
      <span className={cn("size-2 rounded-full bg-amg", status === "live" && "animate-live-dot")} aria-hidden />
      {FEED_LABEL[status]}
    </span>
  );
}

/** Saniyede bir değişen saat kaynağı; sunucuda null döner, böylece hidrasyon uyuşmazlığı olmaz. */
function subscribeClock(onChange: () => void) {
  const timer = setInterval(onChange, 1_000);
  return () => clearInterval(timer);
}
const readClock = () => Math.floor(Date.now() / 1_000) * 1_000;
const readServerClock = () => null;

/** İstanbul saatiyle duvar saati. */
function Clock() {
  const now = useSyncExternalStore(subscribeClock, readClock, readServerClock);

  return (
    <div className="text-right">
      <p className="font-title text-2xl leading-none font-bold tabular xl:text-3xl">{now ? formatTime(now) : "--:--"}</p>
      <p className="mt-1 text-xs text-muted">{now ? formatDate(now) : " "}</p>
    </div>
  );
}
