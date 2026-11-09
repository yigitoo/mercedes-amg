import { cn } from "@/lib/cn";

const SEGMENTS = 32;

/**
 * Marka yükleme çubuğu: canlı ekrandaki devir barıyla aynı dil (logodaki eğik şeritler).
 * `value` 0..1; null ise belirsiz (toplam bilinmiyor) ve şeritler soldan sağa akar.
 */
export function AmgProgress({ value, label, detail }: { value: number | null; label: string; detail?: string }) {
  const lit = value == null ? 0 : Math.round(Math.min(1, Math.max(0, value)) * SEGMENTS);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value == null ? undefined : Math.round(value * 100)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold">{label}</span>
        <span className="font-title text-sm font-bold tabular">{value == null ? "" : `%${Math.round(value * 100)}`}</span>
      </div>
      <div className="flex h-3 gap-[3px]" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 -skew-x-[24deg] transition-colors duration-200",
              value == null ? "animate-[segment-wave_1.2s_ease-in-out_infinite] bg-white/10" : i < lit ? (i >= SEGMENTS - 4 ? "bg-amg" : "bg-fg") : "bg-white/[0.07]",
            )}
            style={value == null ? { animationDelay: `${i * 35}ms` } : undefined}
          />
        ))}
      </div>
      {detail && <p className="mt-2 text-xs text-muted tabular">{detail}</p>}
    </div>
  );
}
