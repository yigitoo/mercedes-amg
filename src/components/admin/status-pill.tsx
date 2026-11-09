import type { LiveStatus } from "@/domain/types";
import { cn } from "@/lib/cn";

const LABEL: Record<LiveStatus, string> = { live: "Canlı", "no-signal": "Sinyal yok", idle: "Boşta" };

/** Aracın canlı durumu; renk tek başına anlam taşımaz, her zaman etiketle birlikte. */
export function StatusPill({ status }: { status: LiveStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-label text-[0.7rem] tracking-[0.1em] whitespace-nowrap uppercase",
        status === "live" && "border-line-strong text-fg",
        status === "no-signal" && "border-amg/60 text-amg-text",
        status === "idle" && "border-line text-muted",
      )}
    >
      <span className={cn("size-1.5 rounded-full", status === "live" ? "animate-live-dot bg-amg" : status === "no-signal" ? "bg-amg" : "bg-dim")} aria-hidden />
      {LABEL[status]}
    </span>
  );
}
