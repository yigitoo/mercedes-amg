import { cn } from "@/lib/cn";

/** Rapor sayfalarındaki büyük sayı + etiket. */
export function StatTile({ label, value, unit, highlight = false }: { label: string; value: string | number | null; unit?: string; highlight?: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cn("mt-1 font-title text-3xl font-extrabold tabular", highlight && "text-amg-text")}>
        {value ?? "--"}
        {unit && value != null && <span className="ml-1 font-label text-base font-normal text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
