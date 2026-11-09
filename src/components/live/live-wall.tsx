"use client";

import { SidebarSimpleIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { HeartRateSample, LiveSnapshot, VehicleId } from "@/domain/types";
import { AmgLogo, MercedesBenzLockup } from "@/components/brand/logos";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import { useStoredState } from "@/lib/use-stored-state";
import { LaunchIntro, OVERLAY_FADE } from "./launch-intro";
import { RaceBanner } from "./race-banner";
import { FINISH_MS } from "./race-timing";
import { FullscreenToggle } from "./fullscreen";
import { TimingTower } from "./timing-tower";
import { useLiveFeed, type FeedStatus, type Transport } from "./use-live-feed";
import { VehicleTile, type TraceMode } from "./vehicle-tile";

/**
 * Canlı ekran (65" TV ve paylaşılan web linki).
 *   TV / masaüstü (xl+): 4×2 araç ızgarası + sağda sıralama kulesi, tek ekrana sığar, kaydırma yok.
 *   Tablet: 2 sütun, mobil: tek sütun; sıralama kulesi gizlenir (kartlar zaten görünür).
 */
export function LiveWall({ initial, initialHistory }: { initial: LiveSnapshot; initialHistory: Record<VehicleId, HeartRateSample[]> }) {
  // Akış modu tercihi (M ile değişir): WebSocket açılamazsa ekran kendiliğinden SSE'ye geçer.
  const [feedMode, setFeedMode] = useStoredState<Transport>("amg.feed.mode", "ws", ["ws", "sse"]);
  const { snapshot, history, status, arrivals, departures, samplesPerMinute, tick, transport } = useLiveFeed(initial, initialHistory, feedMode);
  // Lansman açılışı bitmeden ekran görünmez; yıldız büyürken yumuşakça netleşerek gelir.
  const [revealed, setRevealed] = useState(false);
  const reduceMotion = useReducedMotion();
  // Araç başına son biten sürüş (bitiş bayrağı) ve şu anki sürüşe ait varış anı.
  const finishedBy = new Map(departures.map((d) => [d.vehicleId, d]));
  // Bitiş bayrağı sürerken gelen biniş (sürücü değişimi), bayrak bitince başlar; ikisi üst üste binmez.
  const arrivedAt = new Map(
    arrivals.map((a) => {
      const finish = finishedBy.get(a.vehicleId);
      const overlaps = finish != null && a.at >= finish.at && a.at < finish.at + FINISH_MS;
      return [a.key, overlaps ? finish.at + FINISH_MS : a.at];
    }),
  );
  const [tower, setTower] = useStoredState<"open" | "closed">("amg.tower.visible", "open", ["open", "closed"]);
  const towerOpen = tower === "open";
  const toggleTower = () => setTower(towerOpen ? "closed" : "open");

  const [trace, setTrace] = useStoredState<TraceMode>("amg.trace.mode", "ecg", ["ecg", "chart"]);

  // Kısayollar (TV'de klavye/kumanda ile): S sıralama kulesi, H iz modu (EKG / grafik), M akış modu (WebSocket / SSE).
  // Ref, dinleyiciyi her değişimde yeniden kurmamak için.
  const modesRef = useRef({ tower, trace, feedMode });
  useEffect(() => {
    modesRef.current = { tower, trace, feedMode };
  }, [tower, trace, feedMode]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      if (key === "s") setTower(modesRef.current.tower === "open" ? "closed" : "open");
      else if (key === "h") setTrace(modesRef.current.trace === "ecg" ? "chart" : "ecg");
      else if (key === "m") setFeedMode(modesRef.current.feedMode === "ws" ? "sse" : "ws");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTower, setTrace, setFeedMode]);

  return (
    <div className="live-screen carbon relative min-h-[100dvh] xl:h-[100dvh] [--carbon-opacity:0.025]">
      <motion.div
        className="flex min-h-[100dvh] flex-col gap-4 p-4 xl:h-full xl:gap-5 xl:p-6"
        initial={false}
        animate={revealed ? { opacity: 1, scale: 1, filter: "blur(0px)" } : { opacity: 0, scale: reduceMotion ? 1 : 0.97, filter: reduceMotion ? "blur(0px)" : "blur(12px)" }}
        // Açılış kaplamasıyla aynı anda başlar, biraz daha uzun sürer: ekran kaplamanın altından netleşerek çıkar.
        transition={{ duration: 1.8, delay: revealed ? OVERLAY_FADE.delayMs / 1000 : 0, ease: [0.4, 0, 0.2, 1] }}
      >
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <MercedesBenzLockup className="text-lg xl:text-xl" />
          <span className="hidden h-10 w-px bg-line-strong sm:block" aria-hidden />
          <div className="mr-auto">
            <h1 className="font-title text-xl leading-none font-bold xl:text-2xl">{snapshot.settings.title}</h1>
            {snapshot.settings.subtitle && <p className="mt-1.5 text-sm text-muted">{snapshot.settings.subtitle}</p>}
          </div>
          <FeedIndicator status={status} samplesPerMinute={samplesPerMinute} tick={tick} mode={feedMode} transport={transport} />
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
                trace={trace}
                now={snapshot.generatedAt}
                gauge={snapshot.settings.gauge}
                arrivedAt={arrivedAt.get(`${vehicle.id}:${vehicle.sessionStartedAt}`) ?? null}
                finished={finishedBy.get(vehicle.id) ?? null}
              />
            ))}
          </div>
          <div className={cn("hidden min-h-0 overflow-hidden transition-opacity duration-300 xl:flex xl:flex-col", !towerOpen && "opacity-0")} aria-hidden={!towerOpen}>
            <TimingTower vehicles={snapshot.vehicles} history={history} />
          </div>
        </main>



        <footer className="flex items-center justify-between gap-6">
          <span className="font-title text-sm font-bold tracking-[0.16em] text-soft">{snapshot.settings.tagline}</span>
          <AmgLogo className="h-4 w-auto text-fg xl:h-5" />
        </footer>
      </motion.div>

      <RaceBanner arrivals={arrivals} departures={departures} />
      <LaunchIntro onReveal={() => setRevealed(true)} />
    </div>
  );
}

const FEED_LABEL: Record<FeedStatus, string> = {
  connecting: "Bağlanıyor",
  live: "Canlı",
  degraded: "Veri gecikiyor",
  offline: "Bağlantı yok",
};

const TRANSPORT_LABEL: Record<Transport, string> = { ws: "WS", sse: "SSE" };

/**
 * Akış göstergesi: bağlantı durumu + verinin aktığını gösteren sinyal şeritleri (her snapshot'ta bir adım
 * ilerler), son bir dakikadaki ölçüm sayısı ve kullanılan taşıma (WS / SSE; M ile değişir).
 */
function FeedIndicator({
  status,
  samplesPerMinute,
  tick,
  mode,
  transport,
}: {
  status: FeedStatus;
  samplesPerMinute: number;
  tick: number;
  mode: Transport;
  transport: Transport;
}) {
  const live = status === "live";
  // WebSocket seçili ama sunucuda yok (ör. Vercel): SSE yedeğiyle akıyor.
  const fallback = mode === "ws" && transport === "sse";
  const transportTitle = fallback
    ? "WebSocket bu sunucuda yok, SSE yedeği kullanılıyor (M: akış modu)"
    : `Akış: ${transport === "ws" ? "WebSocket" : "Server-Sent Events"} (M: akış modu)`;
  return (
    <span
      role="status"
      title={transportTitle}
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
      <span className="border-l border-line-strong pl-3 text-xs text-muted" aria-label={transportTitle}>
        {TRANSPORT_LABEL[transport]}
        {fallback && <span className="text-dim"> · yedek</span>}
      </span>
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
