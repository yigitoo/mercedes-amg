"use client";

import { SidebarSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import type { HeartRateSample, LiveSnapshot, VehicleId } from "@/domain/types";
import { AmgLogo, MercedesBenzLockup } from "@/components/brand/logos";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import { useStoredState } from "@/lib/use-stored-state";
import { ArrivalBanner } from "./arrival-banner";
import { FullscreenToggle } from "./fullscreen";
import { TimingTower } from "./timing-tower";
import { useLiveFeed, type FeedStatus } from "./use-live-feed";
import { VehicleTile } from "./vehicle-tile";

/**
 * Canlı ekran (65" TV ve paylaşılan web linki).
 *   TV / masaüstü (xl+): 4×2 araç ızgarası + sağda sıralama kulesi, tek ekrana sığar, kaydırma yok.
 *   Tablet: 2 sütun, mobil: tek sütun; sıralama kulesi gizlenir (kartlar zaten görünür).
 */
export function LiveWall({ initial, initialHistory }: { initial: LiveSnapshot; initialHistory: Record<VehicleId, HeartRateSample[]> }) {
  const { snapshot, history, status, arrivals, samplesPerMinute, tick } = useLiveFeed(initial, initialHistory);
  // Araç başına, şu anki sürüşe ait varış anı (sürücü değişince yenisi geçerli olur).
  const arrivedAt = new Map(arrivals.map((a) => [a.key, a.at]));
  const [tower, setTower] = useStoredState<"open" | "closed">("amg.tower.visible", "open", ["open", "closed"]);
  const towerOpen = tower === "open";
  const toggleTower = () => setTower(towerOpen ? "closed" : "open");

  // S: sıralama kulesini aç/kapa (TV'de klavye/kumanda ile). Ref, dinleyiciyi her değişimde yeniden kurmamak için.
  const towerRef = useRef(tower);
  useEffect(() => {
    towerRef.current = tower;
  }, [tower]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || event.metaKey || event.ctrlKey || event.target instanceof HTMLInputElement) return;
      setTower(towerRef.current === "open" ? "closed" : "open");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTower]);

  return (
    <div className="live-screen carbon flex min-h-[100dvh] flex-col gap-4 p-4 xl:h-[100dvh] xl:gap-5 xl:p-6 [--carbon-opacity:0.025]">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <MercedesBenzLockup className="text-lg xl:text-xl" />
        <span className="hidden h-10 w-px bg-line-strong sm:block" aria-hidden />
        <div className="mr-auto">
          <h1 className="font-title text-xl leading-none font-bold xl:text-2xl">{snapshot.settings.title}</h1>
          {snapshot.settings.subtitle && <p className="mt-1.5 text-sm text-muted">{snapshot.settings.subtitle}</p>}
        </div>
        <FeedIndicator status={status} samplesPerMinute={samplesPerMinute} tick={tick} />
        <button
          type="button"
          onClick={toggleTower}
          aria-pressed={towerOpen}
          aria-label={towerOpen ? "Sıralamayı gizle (S)" : "Sıralamayı göster (S)"}
          title={towerOpen ? "Sıralamayı gizle (S)" : "Sıralamayı göster (S)"}
          className={cn(
            "hidden size-9 cursor-pointer place-items-center rounded-sm border transition-colors xl:grid",
            towerOpen ? "border-line-strong text-soft hover:border-soft hover:text-fg" : "border-fg bg-fg text-ink",
          )}
        >
          <SidebarSimpleIcon size={18} mirrored />
        </button>
        <FullscreenToggle />
        <Clock />
      </header>

      {/* Kule kapanınca sütunu sıfıra iner, panel ızgarası tüm genişliğe büyür (geçiş animasyonlu). */}
      <main
        className={cn(
          "grid min-h-0 flex-1 gap-4 transition-[grid-template-columns,column-gap] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] xl:gap-5",
          towerOpen ? "xl:grid-cols-[1fr_20rem] 2xl:grid-cols-[1fr_22rem]" : "xl:grid-cols-[1fr_0rem] xl:gap-x-0",
        )}
      >
        {/* Kokpit ızgarası: paneller arası 1px saç çizgisi (zemin rengi boşluktan görünür). */}
        <div className="grid min-h-0 grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2">
          {snapshot.vehicles.map((vehicle) => (
            <VehicleTile
              key={vehicle.id}
              vehicle={vehicle}
              history={history[vehicle.id] ?? []}
              now={snapshot.generatedAt}
              gauge={snapshot.settings.gauge}
              arrivedAt={arrivedAt.get(`${vehicle.id}:${vehicle.sessionStartedAt}`) ?? null}
            />
          ))}
        </div>
        <div className={cn("hidden min-h-0 overflow-hidden transition-opacity duration-300 xl:flex xl:flex-col", !towerOpen && "opacity-0")} aria-hidden={!towerOpen}>
          <TimingTower vehicles={snapshot.vehicles} />
        </div>
      </main>

      <ArrivalBanner arrivals={arrivals} />

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

/**
 * Akış göstergesi: bağlantı durumu + verinin aktığını gösteren sinyal şeritleri (her snapshot'ta bir adım
 * ilerler) ve son bir dakikadaki ölçüm sayısı.
 */
function FeedIndicator({ status, samplesPerMinute, tick }: { status: FeedStatus; samplesPerMinute: number; tick: number }) {
  const live = status === "live";
  return (
    <span
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-sm border px-3 py-1.5 font-label text-sm tracking-wider uppercase",
        live ? "border-line-strong text-fg" : "border-amg text-amg-text",
      )}
    >
      <span className={cn("size-2 rounded-full bg-amg", live && "animate-live-dot")} aria-hidden />
      {FEED_LABEL[status]}
      {live && (
        <>
          <span className="flex h-3.5 gap-[3px]" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("w-[5px] -skew-x-[24deg] transition-colors duration-300", tick % 5 === i ? "bg-amg" : "bg-white/15")} />
            ))}
          </span>
          <span className="text-muted normal-case tabular">{samplesPerMinute.toLocaleString("tr-TR")} ölçüm/dk</span>
        </>
      )}
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
