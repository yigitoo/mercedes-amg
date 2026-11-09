"use client";

import { memo } from "react";

import { GAUGE_RANGE, REDLINE_BPM, zoneOf } from "@/domain/heart-rate";
import type { GaugeStyle, LiveVehicle } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDuration, formatTimeWithSeconds, fullName } from "@/lib/format";
import { AnimatedNumber } from "./animated-number";
import { Heartbeat } from "./heartbeat";
import { EcgMonitor } from "./ecg-monitor";
import { PulseTrace } from "./pulse-trace";
import { RevBar } from "./rev-bar";
import { RevDial } from "./rev-dial";
import { FinishOverlay, type FinishSummary } from "./finish-overlay";
import { PerimeterTrace } from "./perimeter-trace";
import { useRaceEffects } from "./use-race-effects";

/** Panelin alt izi: EKG monitörü ya da son iki dakikanın nabız grafiği (canlı ekranda H ile değişir). */
export type TraceMode = "ecg" | "chart";

interface VehicleTileProps {
  vehicle: LiveVehicle;
  /** Son nabız değerleri (eskiden yeniye); grafik modunda çizilir. */
  history: number[];
  trace: TraceMode;
  /** Sunucu saati; geçen süre tüm ekranlarda aynı görünsün diye istemci saati kullanılmaz. */
  now: number;
  gauge: GaugeStyle;
  /** Bu araca ekran açıkken yeni sürücü bindiyse varış anı (gelecekte olabilir): kontak animasyonunu tetikler. */
  arrivedAt: number | null;
  /** Bu araçta az önce biten sürüş: bitiş bayrağını tetikler. */
  finished: (FinishSummary & { at: number }) | null;
}

/**
 * Tek aracın telemetri paneli (AMG gösterge paneli diliyle):
 *   üst    sıra no, sürücü, plaka
 *   orta   nabız + sağda sürüş özeti; gösterge admin ayarına göre:
 *            "bar"  büyük rakam + altında yatay devir barı
 *            "dial" yuvarlak devir kadranı, rakam kadranın ortasında
 *   alt    EKG monitörü ya da nabız grafiği, kalan yüksekliği doldurur
 * Kırmızı bölgede panelin üst kenarı ve rakam AMG kırmızısına döner; başka hiçbir yerde kırmızı yok.
 */
export const VehicleTile = memo(function VehicleTile({ vehicle, history, trace, now, gauge, arrivedAt, finished }: VehicleTileProps) {
  const { status, driver } = vehicle;
  const { ignition, perimeter, finish } = useRaceEffects(arrivedAt, finished?.at ?? null);
  // Kontak taraması: gösterge bir an sonuna kadar çıkar, sonra gerçek nabza iner.
  const bpm = ignition === "sweep" ? GAUGE_RANGE.max : vehicle.bpm;
  const redline = bpm != null && bpm >= REDLINE_BPM;
  const idle = status === "idle";
  const live = status === "live" || ignition === "sweep";

  return (
    <article
      aria-label={`${vehicle.slot}. araç, ${vehicle.plate}${driver ? `, ${fullName(driver)}` : ""}`}
      className={cn("@container relative flex min-h-[22rem] flex-col overflow-hidden bg-surface xl:min-h-0", idle && "checkered [--checkered-opacity:0.035]")}
    >
      {/* Kırmızı bölge göstergesi: panelin üst kenarı */}
      <span className={cn("absolute inset-x-0 top-0 h-[3px] transition-colors duration-300", redline ? "bg-amg" : "bg-transparent")} aria-hidden />

      {/* Yeni sürücü: çerçeve parlar ve söner */}
      <span
        className={cn(
          "pointer-events-none absolute inset-0 z-10 transition-[box-shadow] duration-[1500ms]",
          ignition ? "shadow-[inset_0_0_0_2px_var(--color-amg),inset_0_0_60px_-10px_var(--color-amg)]" : "shadow-[inset_0_0_0_0_transparent]",
        )}
        aria-hidden
      />
      {perimeter && <PerimeterTrace />}
      {finish && finished && <FinishOverlay summary={finished} />}

      {/* Kontak: logodaki beş şerit panelin üstünden geçer */}
      {ignition === "sweep" && (
        <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-[45%] gap-[3%] motion-safe:animate-[stripe-sweep_1.1s_cubic-bezier(0.65,0,0.35,1)_both]" aria-hidden>
          {[1, 0.8, 0.6, 0.4, 0.22].map((opacity, i) => (
            <span key={i} className="h-full flex-1 -skew-x-[24deg] bg-amg" style={{ opacity }} />
          ))}
        </span>
      )}

      <header className="flex items-start gap-[3cqw] px-[5cqw] pt-[4.5cqw]">
        <span className="font-title text-[9cqw] leading-[0.8] font-light text-dim tabular">{String(vehicle.slot).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          {/* Ad, sürücü değişince aşağıdan yükselir (anahtar: sürüş başlangıcı) */}
          <span className="block overflow-hidden">
            <span
              key={vehicle.sessionStartedAt ?? "idle"}
              className={cn("block truncate font-title text-[5.6cqw] leading-tight", driver ? "font-bold text-fg" : "text-muted", ignition && "motion-safe:animate-[rise-in_0.7s_cubic-bezier(0.16,1,0.3,1)_both]")}
            >
              {driver ? fullName(driver) : "Sürücü bekleniyor"}
            </span>
          </span>
          <p className="mt-[0.6cqw] truncate font-label text-[3cqw] tracking-[0.08em] text-muted uppercase">
            {vehicle.plate}
            <span className="mx-[1.5cqw] text-dim">/</span>
            {vehicle.model}
          </p>
        </div>
        {ignition ? <NewDriverTag /> : <StatusTag vehicle={vehicle} />}
      </header>

      <div
        className={cn(
          "mt-[4cqw] grid grid-cols-[1fr_auto] gap-[4cqw] px-[5cqw] transition-opacity duration-300",
          gauge === "dial" ? "items-center xl:min-h-0 xl:flex-[5]" : "items-end",
          !live && "opacity-35",
        )}
      >
        {gauge === "dial" ? (
          <div className="flex h-[62cqw] min-h-0 justify-center xl:h-full">
            <RevDial bpm={bpm}>
              <Readout bpm={bpm} redline={redline} size="dial" sweeping={ignition === "sweep"} />
            </RevDial>
          </div>
        ) : (
          <Readout bpm={bpm} redline={redline} size="bar" sweeping={ignition === "sweep"} />
        )}
        <SessionStats vehicle={vehicle} now={now} hidden={idle} />
      </div>

      {gauge === "bar" && (
        <div className={cn("mt-[4.5cqw] px-[5cqw] transition-opacity duration-300", !live && "opacity-35")}>
          <RevBar bpm={bpm} />
        </div>
      )}

      <div className={cn("relative mt-[3cqw] h-[24cqw] xl:h-auto xl:min-h-[10cqw]", gauge === "dial" ? "xl:flex-[1.2]" : "xl:flex-1")}>{!idle &&
          (trace === "ecg" ? (
            <EcgMonitor bpm={status === "live" ? vehicle.bpm : null} redline={redline} />
          ) : (
            <PulseTrace values={history} redline={redline} />
          ))}</div>
    </article>
  );
});

/** Bölge etiketi + nabız rakamı. Bar modunda kahraman boyutta, kadranda kadranın içine sığacak boyutta. */
function Readout({ bpm, redline, size, sweeping }: { bpm: number | null; redline: boolean; size: "bar" | "dial"; sweeping: boolean }) {
  const dial = size === "dial";
  return (
    <div className={cn(dial && "flex flex-col items-center")}>
      <div className={cn("flex items-center gap-[1.6cqw] font-label tracking-[0.12em] uppercase", dial ? "text-[4.6cqw]" : "text-[3cqw]")}>
        <Heartbeat bpm={bpm} className={dial ? "size-[5cqw]" : "size-[3.6cqw]"} />
        <span className={redline ? "text-amg-text" : "text-soft"}>{sweeping ? "Kontak" : bpm != null ? zoneOf(bpm).label : "Nabız"}</span>
      </div>
      <p className={cn("flex items-baseline", dial ? "mt-[2cqw] flex-col items-center" : "mt-[1cqw] gap-[2cqw]")}>
        <span
          className={cn(
            "font-title leading-[0.78] font-extrabold tracking-[-0.03em] tabular",
            dial ? "text-[28cqw]" : "text-[25cqw]",
            redline ? "text-amg-text" : "text-fg",
          )}
        >
          {bpm != null ? <AnimatedNumber value={bpm} /> : "--"}
        </span>
        <span className={cn("font-label tracking-[0.1em] text-muted uppercase", dial ? "mt-[2.5cqw] text-[4.2cqw]" : "text-[3.4cqw]")}>bpm</span>
      </p>
    </div>
  );
}

function SessionStats({ vehicle, now, hidden }: { vehicle: LiveVehicle; now: number; hidden: boolean }) {
  return (
    <dl className={cn("grid gap-[2.2cqw] border-l border-line pl-[4cqw] text-right", hidden && "invisible")} aria-hidden={hidden}>
      <Stat label="Süre" value={vehicle.sessionStartedAt ? formatDuration(now - vehicle.sessionStartedAt) : "--"} />
      <Stat label="Ort." value={vehicle.stats?.avg ?? "--"} />
      <Stat label="Maks." value={vehicle.stats?.max ?? "--"} highlight={(vehicle.stats?.max ?? 0) >= REDLINE_BPM} />
    </dl>
  );
}

function NewDriverTag() {
  return (
    <span className="flex items-center gap-[1.2cqw] rounded-sm bg-amg px-[1.8cqw] py-[0.8cqw] font-label text-[2.6cqw] font-bold tracking-[0.14em] text-white uppercase">
      <span className="size-[1.4cqw] animate-live-dot rounded-full bg-white" aria-hidden />
      Yeni sürücü
    </span>
  );
}

function StatusTag({ vehicle }: { vehicle: LiveVehicle }) {
  if (vehicle.status === "live") {
    return (
      <span className="flex items-center gap-[1.4cqw] pt-[0.6cqw] font-label text-[2.8cqw] tracking-[0.14em] text-soft uppercase">
        <span className="size-[1.6cqw] animate-live-dot rounded-full bg-amg" aria-hidden />
        Canlı
      </span>
    );
  }
  if (vehicle.status === "no-signal") {
    return (
      <span className="pt-[0.6cqw] text-right font-label text-[2.8cqw] leading-snug tracking-[0.1em] text-amg-text uppercase">
        Sinyal yok
        {vehicle.sampleAt && <span className="block tracking-normal text-muted normal-case tabular">son {formatTimeWithSeconds(vehicle.sampleAt)}</span>}
      </span>
    );
  }
  return <span className="pt-[0.6cqw] font-label text-[2.8cqw] tracking-[0.14em] text-muted uppercase">Boşta</span>;
}

function Stat({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <dt className="font-label text-[2.6cqw] tracking-[0.12em] text-muted uppercase">{label}</dt>
      <dd className={cn("font-title text-[5cqw] leading-none font-bold tabular", highlight ? "text-amg-text" : "text-fg")}>{value}</dd>
    </div>
  );
}
