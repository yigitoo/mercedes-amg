import { useId } from "react";

import { REDLINE_BPM } from "@/domain/heart-rate";

const W = 300;
const H = 100;
/** Ekranda tutulan pencere (ölçüm sayısı, 1 Hz'de 2 dk). */
const WINDOW = 120;
const MIN = 50;
const MAX = 190;

const y = (bpm: number) => H - ((Math.min(MAX, Math.max(MIN, bpm)) - MIN) / (MAX - MIN)) * H;

/**
 * Son iki dakikanın nabız izi, panelin altını boydan boya doldurur. Yayın grafiği gibi sağdan akar;
 * kırmızı bölge eşiği kesik çizgi. Değerler küçük bir alana sıkışmasın diye dikey eksen 50-190.
 */
export function PulseTrace({ values, redline }: { values: number[]; redline: boolean }) {
  const step = W / (WINDOW - 1);
  const offset = WINDOW - values.length;
  const points = values.map((v, i) => [(offset + i) * step, y(v)] as const);
  const line = points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = points.length > 1 ? `M ${points[0]![0]},${H} L ${line.replaceAll(" ", " L ")} L ${W},${H} Z` : "";
  const stroke = redline ? "var(--color-amg)" : "var(--color-fg)";
  const fillId = useId();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.14" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[100, 130].map((bpm) => (
        <line key={bpm} x1={0} x2={W} y1={y(bpm)} y2={y(bpm)} stroke="white" strokeOpacity={0.06} vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={0} x2={W} y1={y(REDLINE_BPM)} y2={y(REDLINE_BPM)} stroke="var(--color-amg)" strokeOpacity={0.6} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      {area && <path d={area} fill={`url(#${fillId})`} />}
      {points.length > 1 && <polyline points={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
