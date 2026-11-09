"use client";

import { HeartIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/cn";

/** Kalp ikonu gerçek nabız hızında atar: animasyon süresi 60/bpm saniye. */
export function Heartbeat({ bpm, className }: { bpm: number | null; className?: string }) {
  const beating = bpm != null;
  return (
    <HeartIcon
      weight="fill"
      aria-hidden
      className={cn(beating ? "text-amg-text" : "text-dim", beating && "motion-safe:animate-heartbeat", className)}
      style={beating ? ({ "--beat": `${(60 / bpm).toFixed(3)}s` } as React.CSSProperties) : undefined}
    />
  );
}
