import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/admin/auto-refresh";
import { ExportButton } from "@/components/admin/export-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { REDLINE_BPM, zoneOf } from "@/domain/heart-rate";
import { cn } from "@/lib/cn";
import { formatTime, formatTimeWithSeconds, fullName } from "@/lib/format";
import { AUDIT_LABELS, listAudit } from "@/server/services/audit-service";
import { getFleet } from "@/server/services/fleet-service";
import { getReadingFeed } from "@/server/services/log-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tüm loglar" };

const FEED_SIZE = 150;

/**
 * Her şeyin tek ekranda göründüğü log: solda bileklikten gelen her nabız ölçümü (saniye saniye akar),
 * sağda paneldeki işlemler. Araç filtresi `?v=v3`. Tamamı "Dışa aktar" ile CSV olarak indirilir.
 */
export default async function LogsPage({ searchParams }: PageProps<"/admin/logs">) {
  const { v } = await searchParams;
  const fleet = await getFleet();
  const vehicleId = typeof v === "string" && fleet.some((e) => e.vehicle.id === v) ? v : undefined;
  const [readings, activity] = await Promise.all([getReadingFeed({ limit: FEED_SIZE, vehicleId }), listAudit({ limit: 30 })]);

  return (
    <>
      <AutoRefresh intervalMs={2_000} />
      <PageHeader
        title="Tüm loglar"
        description="Anlık nabız ölçümleri ve paneldeki işlemler. Sayfa 2 saniyede bir tazelenir; tamamı CSV olarak indirilebilir."
        actions={<ExportButton variant="primary" />}
      />

      <nav aria-label="Araç filtresi" className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip href="/admin/logs" active={!vehicleId} label="Tüm araçlar" />
        {fleet.map(({ vehicle }) => (
          <FilterChip key={vehicle.id} href={`/admin/logs?v=${vehicle.id}`} active={vehicleId === vehicle.id} label={`${String(vehicle.slot).padStart(2, "0")} · ${vehicle.plate}`} />
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel title={`Nabız akışı · son ${FEED_SIZE} ölçüm`}>
          {readings.length === 0 ? (
            <p className="px-5 py-8 text-muted">Henüz ölçüm yok. Bileklik veri gönderdiğinde burada saniye saniye akar.</p>
          ) : (
            <div className="max-h-[70dvh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-normal">Saat</th>
                    <th scope="col" className="px-3 py-2.5 font-normal">Araç</th>
                    <th scope="col" className="px-3 py-2.5 font-normal">Sürücü</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-normal">BPM</th>
                    <th scope="col" className="px-5 py-2.5 font-normal">Bölge</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.id} className="border-t border-line/70">
                      <td className="px-5 py-1.5 text-muted tabular">{formatTimeWithSeconds(r.at)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="mr-2 font-title text-dim tabular">{String(r.slot).padStart(2, "0")}</span>
                        <span className="font-label text-xs tracking-[0.06em] text-soft uppercase">{r.plate}</span>
                      </td>
                      <td className="px-3 py-1.5">{r.driver ? fullName(r.driver) : "--"}</td>
                      <td className={cn("px-3 py-1.5 text-right font-title font-bold tabular", r.bpm >= REDLINE_BPM && "text-amg-text")}>{r.bpm}</td>
                      <td className="px-5 py-1.5 text-muted">{zoneOf(r.bpm).label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="İşlemler"
          actions={
            <Link href="/admin/activity" className="text-sm text-muted hover:text-fg">
              Tümü
            </Link>
          }
        >
          {activity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Henüz işlem yok.</p>
          ) : (
            <ol className="max-h-[70dvh] overflow-y-auto">
              {activity.map((entry) => (
                <li key={entry.id} className="border-t border-line px-5 py-3 first:border-t-0">
                  <p className="flex justify-between gap-3 font-label text-xs tracking-[0.06em] text-muted uppercase">
                    <span>{AUDIT_LABELS[entry.action]}</span>
                    <span className="tabular">{formatTime(entry.at)}</span>
                  </p>
                  <p className="mt-0.5 text-sm">{entry.summary}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "h-8 rounded-sm border px-3 font-label text-xs leading-8 tracking-[0.06em] whitespace-nowrap uppercase transition-colors",
        active ? "border-fg bg-fg text-ink" : "border-line-strong text-soft hover:border-soft hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}
