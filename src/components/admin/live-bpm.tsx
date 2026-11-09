import { REDLINE_BPM, zoneOf } from "@/domain/heart-rate";
import type { LiveVehicle } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatTimeWithSeconds } from "@/lib/format";

/** Admin tablolarında aracın anlık nabzı (ya da neden yok). */
export function LiveBpm({ live }: { live: LiveVehicle }) {
  if (live.status === "idle") return <span className="text-dim">--</span>;
  if (live.bpm == null) {
    return <span className="text-sm text-amg-text">{live.sampleAt ? `son ${formatTimeWithSeconds(live.sampleAt)}` : "veri yok"}</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={cn("font-title text-2xl leading-none font-extrabold tabular", live.bpm >= REDLINE_BPM ? "text-amg-text" : "text-fg")}>{live.bpm}</span>
      <span className="text-xs text-muted">{zoneOf(live.bpm).label}</span>
    </span>
  );
}
