/**
 * Yeni sürücü: panelin çevresinde kırmızı ışık tur atar (pistte dönen araç gibi).
 * SVG dikdörtgen `pathLength=100` ile normalize edilir; kesik çizginin kayması turu oluşturur.
 */
export function PerimeterTrace() {
  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="99"
        height="99"
        pathLength={100}
        fill="none"
        stroke="var(--color-amg)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="16 84"
        vectorEffect="non-scaling-stroke"
        className="motion-safe:animate-[perimeter-run_1.05s_linear_infinite] [filter:drop-shadow(0_0_6px_var(--color-amg))]"
      />
    </svg>
  );
}
