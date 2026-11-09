import { GAUGE_RANGE, gaugeRatio, REDLINE_BPM } from "@/domain/heart-rate";
import { cn } from "@/lib/cn";

const SEGMENTS = 28;
const FIRST_RED = Math.round(gaugeRatio(REDLINE_BPM) * SEGMENTS);
const SCALE = [GAUGE_RANGE.min, 80, 120, REDLINE_BPM, GAUGE_RANGE.max];

/**
 * Devir barı: AMG gösterge panelindeki devir şeridi gibi, nabız yükseldikçe soldan sağa dolar.
 * Segmentler logodaki eğik şeritlerin açısında; kırmızı bölge (160+) AMG kırmızısı. "Gaza basma" okuması buradan gelir.
 */
export function RevBar({ bpm }: { bpm: number | null }) {
  const lit = bpm == null ? 0 : Math.round(gaugeRatio(bpm) * SEGMENTS);
  return (
    <div aria-hidden>
      <div className="flex h-[4.2cqw] min-h-2.5 gap-[0.7cqw]">
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const red = i >= FIRST_RED;
          const on = i < lit;
          return (
            <span
              key={i}
              // Segmentler sırayla yanar: devir yükselirken soldan sağa akan dalga.
              style={{ transitionDelay: `${i * 14}ms` }}
              className={cn(
                "flex-1 -skew-x-[24deg] transition-colors duration-150",
                on ? (red ? "bg-amg" : "bg-fg") : red ? "bg-amg/20" : "bg-white/[0.07]",
              )}
            />
          );
        })}
      </div>
      <div className="relative mt-[1.4cqw] h-[2.6cqw] font-label text-[2.3cqw] text-muted tabular">
        {SCALE.map((tick) => (
          <span
            key={tick}
            className={cn("absolute -translate-x-1/2 leading-none", tick >= REDLINE_BPM && "text-amg-text")}
            style={{ left: `${gaugeRatio(tick) * 100}%` }}
          >
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}
