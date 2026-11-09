import { GAUGE_RANGE, REDLINE_BPM, ZONES } from "@/domain/heart-rate";
import type { HeartRateSample } from "@/domain/types";
import { formatTime } from "@/lib/format";

const W = 960;
const H = 280;
const PAD = { top: 12, right: 12, bottom: 28, left: 40 };
const X_TICKS = 6;

/**
 * Sürüşün nabız grafiği (sunucuda çizilen SVG; yazdırılabilir, JS gerektirmez).
 * Yatay çizgiler bölge eşikleri, üst bant kırmızı bölge.
 */
export function SessionChart({ series, from, to }: { series: HeartRateSample[]; from: number; to: number }) {
  if (series.length < 2) {
    return <p className="grid h-48 place-items-center rounded-sm border border-line text-muted">Bu sürüşte grafik için yeterli ölçüm yok.</p>;
  }

  const span = Math.max(1, to - from);
  const x = (at: number) => PAD.left + ((at - from) / span) * (W - PAD.left - PAD.right);
  const y = (bpm: number) => {
    const { min, max } = GAUGE_RANGE;
    const c = Math.min(max, Math.max(min, bpm));
    return PAD.top + (1 - (c - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  };
  const line = series.map((p) => `${x(p.at).toFixed(1)},${y(p.bpm).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: X_TICKS }, (_, i) => from + (span * i) / (X_TICKS - 1));

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Sürüş boyunca nabız grafiği">
        <rect x={PAD.left} y={y(GAUGE_RANGE.max)} width={W - PAD.left - PAD.right} height={y(REDLINE_BPM) - y(GAUGE_RANGE.max)} fill="var(--color-amg)" opacity={0.12} />
        {ZONES.filter((z) => z.from > 0).map((z) => (
          <g key={z.id}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(z.from)} y2={y(z.from)} stroke="var(--color-line-strong)" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={y(z.from)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--color-muted)" className="tabular">
              {z.from}
            </text>
          </g>
        ))}
        {ticks.map((at) => (
          <text key={at} x={x(at)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)" className="tabular">
            {formatTime(at)}
          </text>
        ))}
        <polyline points={line} fill="none" stroke="var(--color-fg)" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  );
}
