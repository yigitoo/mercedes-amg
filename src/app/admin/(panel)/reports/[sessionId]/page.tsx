import { ArrowLeftIcon, DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/admin/print-button";
import { SessionChart } from "@/components/admin/session-chart";
import { StatTile } from "@/components/admin/stat-tile";
import { ZoneBreakdown } from "@/components/admin/zone-breakdown";
import { LicensePlate } from "@/components/brand/license-plate";
import { buttonClasses } from "@/components/ui/button";
import { REDLINE_BPM } from "@/domain/heart-rate";
import { formatDate, formatDuration, formatTime, fullName } from "@/lib/format";
import { getSessionReport } from "@/server/services/report-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sürüş raporu" };

export default async function SessionReportPage({ params }: PageProps<"/admin/reports/[sessionId]">) {
  const { sessionId } = await params;
  const report = await getSessionReport(sessionId);
  if (!report) notFound();

  const { session, vehicle, series, zones, durationMs, avg, min, max } = report;
  const end = session.endedAt ?? report.generatedAt;

  return (
    <article>
      <Link href="/admin/reports" className="no-print mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeftIcon size={16} aria-hidden /> Raporlar
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <LicensePlate plate={session.plate} className="text-sm" />
            {vehicle?.model && <span className="text-sm text-soft">{vehicle.model}</span>}
          </div>
          <h1 className="mt-4 font-title text-4xl font-bold">{fullName(session.driver)}</h1>
          <p className="mt-2 text-muted tabular">
            {formatDate(session.startedAt)}, {formatTime(session.startedAt)} - {session.endedAt ? formatTime(session.endedAt) : "devam ediyor"}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <PrintButton />
          <a href={`/api/admin/sessions/${session.id}/csv`} className={buttonClasses({ variant: "primary" })}>
            <DownloadSimpleIcon size={18} aria-hidden />
            Ham veri (CSV)
          </a>
        </div>
      </header>

      <dl className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Süre" value={formatDuration(durationMs)} />
        <StatTile label="Ortalama" value={avg} unit="bpm" />
        <StatTile label="En düşük" value={min} unit="bpm" />
        <StatTile label="En yüksek" value={max} unit="bpm" highlight={(max ?? 0) >= REDLINE_BPM} />
        <StatTile label="Ölçüm" value={report.readingCount.toLocaleString("tr-TR")} />
      </dl>

      <section className="mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-4 font-title text-lg font-bold">Nabız</h2>
        <SessionChart series={series} from={session.startedAt} to={end} />
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-4 font-title text-lg font-bold">Bölgelerde geçen süre</h2>
        <ZoneBreakdown zones={zones} />
      </section>
    </article>
  );
}
