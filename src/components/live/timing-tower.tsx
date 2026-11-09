"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";

import { REDLINE_BPM } from "@/domain/heart-rate";
import type { LiveVehicle, VehicleId } from "@/domain/types";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { shortName } from "@/lib/format";
import { useStoredState } from "@/lib/use-stored-state";

/** Vurgunun yükselen araca geçmesi için gereken en küçük artış (bpm/sn); gürültüde titremesin. */
const RISE_THRESHOLD = 2;

type SortMode = "slot" | "bpm";
const SORT_MODES: readonly SortMode[] = ["slot", "bpm"];
const SORT_OPTIONS = [
  { value: "slot", label: "Araç no" },
  { value: "bpm", label: "Nabız" },
] as const;

/**
 * Yayın tarzı sıralama kulesi. İki görünüm, ekranda seçilir ve o ekranda hatırlanır:
 *   Araç no  8 aracın tamamı sabit sırada; satırlar yer değiştirmez.
 *   Nabız    canlı araçlar nabza göre; sıra değişince satırlar kayar.
 *
 * Kırmızı vurgu "en yüksek nabız"a değil, o an nabzı YÜKSELEN araca gider ve araçlar arasında gezer.
 * Amaç yüksek nabzı ödüllendirmek değil, değişimi göstermek (etkinlik ekibinin isteği).
 */
export function TimingTower({ vehicles, history }: { vehicles: LiveVehicle[]; history: Record<VehicleId, number[]> }) {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useStoredState<SortMode>("amg.tower.sort", "slot", SORT_MODES);

  const live = vehicles.filter((v) => v.status === "live" && v.bpm != null);
  const rows = mode === "bpm" ? [...live].sort((a, b) => b.bpm! - a.bpm! || a.slot - b.slot) : [...vehicles].sort((a, b) => a.slot - b.slot);
  const risingId = mostRising(live, history);
  const waiting = mode === "bpm" ? vehicles.filter((v) => !live.includes(v)) : [];

  return (
    <section aria-label="Araçlar ve anlık nabız" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="font-title text-lg leading-none font-bold">Sıralama</h2>
          <p className="mt-1.5 font-label text-xs tracking-[0.14em] text-muted uppercase tabular">
            {live.length} / {vehicles.length} aktif
          </p>
        </div>
        <Segmented label="Sıralama ölçütü" value={mode} options={SORT_OPTIONS} onChange={setMode} />
      </header>

      <LayoutGroup>
        <ol className="flex-1 overflow-hidden">
          {rows.map((vehicle) => (
            <motion.li
              key={vehicle.id}
              layout={!reduceMotion}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className={cn("grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 border-t border-line px-5 py-2.5", vehicle.status !== "live" && "opacity-45")}
            >
              <span
                className={cn(
                  "grid h-7 -skew-x-[14deg] place-items-center font-title text-sm font-extrabold tabular",
                  vehicle.id === risingId ? "bg-amg text-white" : "bg-raised text-soft",
                )}
              >
                <span className="skew-x-[14deg]">{String(vehicle.slot).padStart(2, "0")}</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate font-title text-[0.95rem] leading-tight font-bold">
                  {vehicle.driver ? shortName(vehicle.driver) : <span className="font-normal text-muted">Boşta</span>}
                </span>
                <span className="block font-label text-[0.7rem] tracking-[0.08em] text-muted uppercase">{vehicle.plate}</span>
              </span>
              <TowerValue vehicle={vehicle} />
            </motion.li>
          ))}
        </ol>
      </LayoutGroup>

      {waiting.length > 0 && (
        <ul className="border-t border-line px-5 py-3">
          {waiting.map((v) => (
            <li key={v.id} className="flex justify-between py-1 font-label text-xs tracking-[0.08em] text-muted uppercase">
              <span>{v.plate}</span>
              <span className={v.status === "no-signal" ? "text-amg-text" : undefined}>{v.status === "no-signal" ? "Sinyal yok" : "Boşta"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TowerValue({ vehicle }: { vehicle: LiveVehicle }) {
  if (vehicle.status === "no-signal") return <span className="font-label text-xs tracking-[0.1em] text-amg-text uppercase">Sinyal yok</span>;
  if (vehicle.bpm == null) return <span className="font-title text-2xl leading-none text-dim">--</span>;
  return (
    <span className={cn("text-right font-title text-2xl leading-none font-extrabold tabular", vehicle.bpm >= REDLINE_BPM ? "text-amg-text" : "text-fg")}>
      {vehicle.bpm}
    </span>
  );
}

/** Son ölçümde nabzı en çok artan canlı araç (eşiğin altındaki artışlar sayılmaz). */
function mostRising(live: LiveVehicle[], history: Record<VehicleId, number[]>): VehicleId | undefined {
  let best: { id: VehicleId; rise: number } | undefined;
  for (const vehicle of live) {
    const points = history[vehicle.id] ?? [];
    const rise = points.length >= 2 ? points.at(-1)! - points.at(-2)! : 0;
    if (rise >= RISE_THRESHOLD && (!best || rise > best.rise)) best = { id: vehicle.id, rise };
  }
  return best?.id;
}
