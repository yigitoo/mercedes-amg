import { ZONES, zoneRangeLabel, type ZoneId } from "@/domain/heart-rate";
import type { ZoneShare } from "@/domain/series";
import { cn } from "@/lib/cn";

/** Sürüşte her nabız bölgesinde geçen sürenin oranı; renk yerine ton + etiket, kırmızı yalnız kırmızı bölgede. */
export function ZoneBreakdown({ zones }: { zones: ZoneShare }) {
  const tone: Record<ZoneId, string> = { calm: "bg-line-strong", focus: "bg-dim", intense: "bg-soft", redline: "bg-amg" };
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-sm" aria-hidden>
        {ZONES.map((z) => (
          <span key={z.id} className={tone[z.id]} style={{ width: `${zones[z.id] * 100}%` }} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ZONES.map((z) => (
            <div key={z.id}>
              <dt className="flex items-center gap-2 text-sm text-muted">
                <span className={cn("size-2.5 rounded-sm", tone[z.id])} aria-hidden />
                {z.label} <span className="tabular">({zoneRangeLabel(z)})</span>
              </dt>
              <dd className={cn("mt-1 font-title text-2xl font-bold tabular", z.id === "redline" && zones.redline > 0 && "text-amg-text")}>
                %{Math.round(zones[z.id] * 100)}
              </dd>
            </div>
        ))}
      </dl>
    </div>
  );
}
