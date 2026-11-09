import type { Driver } from "@/domain/types";
import { formatDuration, fullName } from "@/lib/format";
import { CheckeredFlag } from "./checkered-flag";
import { FINISH_MS } from "./race-timing";

export interface FinishSummary {
  driver: Driver;
  durationMs: number;
  avg: number | null;
  max: number | null;
}

/**
 * Sürüş bitti: panelin üstüne damalı bayrak iner ve dalgalanır, altında BİTTİ ile sürüşün özeti.
 * Katman kendi yaşam döngüsünü CSS ile oynatır (girer, kalır, söner); süre race-timing'den gelir.
 */
export function FinishOverlay({ summary }: { summary: FinishSummary }) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[3cqw] bg-ink/85 backdrop-blur-[2px] motion-safe:animate-[overlay-life_var(--finish-ms)_ease-in-out_both]"
      style={{ "--finish-ms": `${FINISH_MS}ms` } as React.CSSProperties}
      role="status"
    >
      <CheckeredFlag className="h-[26cqw] w-[52cqw] motion-safe:animate-[flag-drop_0.9s_cubic-bezier(0.16,1,0.3,1)_both]" />

      <div className="flex flex-col items-center motion-safe:animate-[rise-in_0.7s_0.35s_cubic-bezier(0.16,1,0.3,1)_both]">
        <span className="font-title text-[17cqw] leading-[0.85] font-extrabold tracking-[-0.02em]">BİTTİ</span>
        <span className="mt-[1.5cqw] font-title text-[5cqw] leading-tight font-bold">{fullName(summary.driver)}</span>
        <dl className="mt-[2cqw] flex gap-[5cqw] font-label text-[2.8cqw] tracking-[0.12em] text-muted uppercase">
          <FinishStat label="Süre" value={formatDuration(summary.durationMs)} />
          <FinishStat label="Ort." value={summary.avg ?? "--"} />
          <FinishStat label="Maks." value={summary.max ?? "--"} />
        </dl>
      </div>
    </div>
  );
}

function FinishStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <dt>{label}</dt>
      <dd className="font-title text-[4.4cqw] font-bold tracking-normal text-fg tabular">{value}</dd>
    </div>
  );
}
