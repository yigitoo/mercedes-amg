"use client";

import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { gaugeRatio, REDLINE_BPM } from "@/domain/heart-rate";

/**
 * Yuvarlak devir kadranı (RevBar'ın alternatifi; admin > Etkinlik > Gösterge'den seçilir).
 * İbre yay fiziğiyle döner, kırmızı bölge (160+) AMG kırmızısı. Ortadaki boşluğa nabız rakamı gelir.
 */

const SWEEP = 250;
const START = 90 + (360 - SWEEP) / 2;
const CX = 100;
const CY = 100;
const R = 82;
const TICKS = [40, 60, 80, 100, 120, 140, 160, 180, 200];
const SPRING = { stiffness: 140, damping: 18, mass: 0.6 } as const;
const INSTANT = { duration: 0 } as const;
/** Etiketler yayın dışında: viewBox kenar payı onlara yer açar, rakamla çakışmaz. */
const PAD = 14;
const VIEWBOX = `${-PAD} ${-PAD} ${200 + PAD * 2} ${200 + PAD * 2}`;

/** 2 haneye yuvarlama: sunucu ve tarayıcı Math.cos'u son basamakta farklı hesaplayabilir (hydration uyuşmazlığı). */
const round = (n: number) => Math.round(n * 100) / 100;

function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: round(CX + radius * Math.cos(a)), y: round(CY + radius * Math.sin(a)) };
}

function arc(from: number, to: number, radius = R) {
  const a0 = START + from * SWEEP;
  const a1 = START + to * SWEEP;
  const p0 = polar(a0, radius);
  const p1 = polar(a1, radius);
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}

const TRACK = arc(0, 1);
const INNER_RING = arc(0, 1, R - 13);
const REDLINE_TRACK = arc(gaugeRatio(REDLINE_BPM), 1);

export function RevDial({ bpm, children }: { bpm: number | null; children?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const ratio = useSpring(0, reduceMotion ? INSTANT : SPRING);
  useEffect(() => ratio.set(bpm == null ? 0 : gaugeRatio(bpm)), [bpm, ratio]);

  const angle = useTransform(ratio, (r) => START + r * SWEEP);
  const pointerX1 = useTransform(angle, (a) => polar(a, R - 11).x);
  const pointerY1 = useTransform(angle, (a) => polar(a, R - 11).y);
  const pointerX2 = useTransform(angle, (a) => polar(a, R + 5).x);
  const pointerY2 = useTransform(angle, (a) => polar(a, R + 5).y);
  const progress = useTransform(ratio, (r) => Math.max(0.001, r));
  const redline = bpm != null && bpm >= REDLINE_BPM;
  const accent = redline ? "var(--color-amg)" : "var(--color-fg)";

  return (
    <div className="@container relative aspect-square h-full max-h-full w-auto max-w-full">
      <svg viewBox={VIEWBOX} className="absolute inset-0 h-full w-full" aria-hidden>
        {/* İç halka: derinlik için çok soluk */}
        <path d={INNER_RING} fill="none" stroke="white" strokeOpacity={0.05} strokeWidth={1} />
        {/* Yay: boş iz, kırmızı bölge, dolan kısım */}
        <path d={TRACK} fill="none" stroke="white" strokeOpacity={0.08} strokeWidth={8} />
        <path d={REDLINE_TRACK} fill="none" stroke="var(--color-amg)" strokeOpacity={0.3} strokeWidth={8} />
        <motion.path d={TRACK} fill="none" stroke={accent} strokeWidth={8} style={{ pathLength: progress }} />

        {/* Çentik ve rakamlar yayın dışında */}
        {TICKS.map((tick) => {
          const angle = START + gaugeRatio(tick) * SWEEP;
          const major = tick % 40 === 0;
          const inner = polar(angle, R + 6);
          const outer = polar(angle, R + (major ? 12 : 9));
          const label = polar(angle, R + 21);
          const red = tick >= REDLINE_BPM;
          const color = red ? "var(--color-amg-text)" : "var(--color-muted)";
          return (
            <g key={tick}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={color} strokeWidth={major ? 1.6 : 1} />
              {major && (
                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={9} className="font-label tabular" fill={color}>
                  {tick}
                </text>
              )}
            </g>
          );
        })}

        {/* İşaretçi: yayın üstünde kısa, kalın çentik; rakamın üstünden geçmez */}
        {/* İşaretçi: uç noktaları açıdan hesaplanır (CSS dönüşümü yok, tarayıcıdan bağımsız). */}
        <motion.line x1={pointerX1} y1={pointerY1} x2={pointerX2} y2={pointerY2} stroke={accent} strokeWidth={3.5} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
