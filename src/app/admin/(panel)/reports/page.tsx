import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { LicensePlate } from "@/components/brand/license-plate";
import { buttonClasses } from "@/components/ui/button";
import { REDLINE_BPM } from "@/domain/heart-rate";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration, formatTime, fullName } from "@/lib/format";
import { getFleetReport } from "@/server/services/report-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Raporlar" };

/** İş bitimi toplam rapor: her plaka altında o araçtaki sürüşler ve nabız özetleri. */
export default async function ReportsPage() {
  const report = await getFleetReport();
  const { totals } = report;

  return (
    <>
      <PageHeader
        title="Raporlar"
        description={`Plaka bazında tüm sürüşler. Hazırlanma: ${formatDateTime(report.generatedAt)}`}
        actions={
          <a href="/api/admin/reports/csv" className={buttonClasses({ variant: "primary" })}>
            <DownloadSimpleIcon size={18} aria-hidden />
            Toplam rapor (CSV)
          </a>
        }
      />

      <dl className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Sürüş" value={totals.sessions} />
        <StatTile label="Sürücü" value={totals.drivers} />
        <StatTile label="Toplam sürüş süresi" value={formatDuration(totals.durationMs)} />
        <StatTile label="Nabız ölçümü" value={totals.readings.toLocaleString("tr-TR")} />
      </dl>

      <div className="grid gap-6">
        {report.vehicles.map(({ vehicle, sessions, totalDurationMs, avg, max }) => (
          <section key={vehicle.id} aria-labelledby={`plate-${vehicle.id}`} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-4">
              <h2 id={`plate-${vehicle.id}`}>
                <LicensePlate plate={vehicle.plate} className="text-sm" />
              </h2>
              <span className="text-sm text-soft">{vehicle.model}</span>
              <span className="ml-auto text-sm text-muted tabular">
                {sessions.length} sürüş · {formatDuration(totalDurationMs)} · ort. {avg ?? "--"} · maks. {max ?? "--"} bpm
              </span>
            </header>

            {sessions.length === 0 ? (
              <p className="px-5 py-6 text-muted">Bu araçta henüz sürüş yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-normal">Sürücü</th>
                      <th scope="col" className="px-3 py-3 font-normal">Zaman</th>
                      <th scope="col" className="px-3 py-3 font-normal">Süre</th>
                      <th scope="col" className="px-3 py-3 text-right font-normal">Ort.</th>
                      <th scope="col" className="px-3 py-3 text-right font-normal">Min</th>
                      <th scope="col" className="px-5 py-3 text-right font-normal">Maks.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(({ session, durationMs, avg: sAvg, min, max: sMax }) => (
                      <tr key={session.id} className="border-t border-line/70 transition-colors hover:bg-raised">
                        <td className="px-5 py-3">
                          <Link href={`/admin/reports/${session.id}`} className="font-title font-bold hover:underline">
                            {fullName(session.driver)}
                          </Link>
                          {!session.endedAt && <span className="ml-2 font-label text-xs tracking-wide text-amg-text uppercase">sürüyor</span>}
                        </td>
                        <td className="px-3 py-3 text-soft tabular">
                          {formatDateTime(session.startedAt)}
                          {session.endedAt && ` - ${formatTime(session.endedAt)}`}
                        </td>
                        <td className="px-3 py-3 tabular">{formatDuration(durationMs)}</td>
                        <td className="px-3 py-3 text-right tabular">{sAvg ?? "--"}</td>
                        <td className="px-3 py-3 text-right tabular">{min ?? "--"}</td>
                        <td className={cn("px-5 py-3 text-right font-bold tabular", (sMax ?? 0) >= REDLINE_BPM && "text-amg-text")}>{sMax ?? "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
