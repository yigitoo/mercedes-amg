import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/admin/auto-refresh";
import { DriverActions } from "@/components/admin/driver-actions";
import { LiveBpm } from "@/components/admin/live-bpm";
import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { StatTile } from "@/components/admin/stat-tile";
import { StatusPill } from "@/components/admin/status-pill";
import { REDLINE_BPM } from "@/domain/heart-rate";
import { formatDuration, formatTime, fullName } from "@/lib/format";
import { AUDIT_LABELS, listAudit } from "@/server/services/audit-service";
import { getFleetOverview } from "@/server/services/live-service";
import { getFleetReport } from "@/server/services/report-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Genel bakış" };

/** Etkinliğin tek bakışta durumu: kaç araç sürüşte, sinyal var mı, kim kırmızı bölgede, son yapılanlar. */
export default async function OverviewPage() {
  const [{ generatedAt: now, entries }, report, activity] = await Promise.all([getFleetOverview(), getFleetReport(), listAudit({ limit: 8 })]);
  const driving = entries.filter((e) => e.session).length;
  const noSignal = entries.filter((e) => e.live.status === "no-signal").length;
  const peak = report.vehicles.flatMap((v) => v.sessions).sort((a, b) => (b.max ?? 0) - (a.max ?? 0))[0];

  return (
    <>
      <AutoRefresh />
      <PageHeader title="Genel bakış" description="Araçlar, sürücüler ve nabız akışı. Sayfa kendini 3 saniyede bir tazeler." />

      <dl className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Sürüşteki araç" value={`${driving} / ${entries.length}`} />
        <StatTile label="Sinyal kaybı" value={noSignal} highlight={noSignal > 0} />
        <StatTile label="Toplam sürüş" value={report.totals.sessions} />
        <StatTile label="En yüksek nabız" value={peak?.max ?? null} unit="bpm" highlight={(peak?.max ?? 0) >= REDLINE_BPM} />
      </dl>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel
          title="Araçlar"
          actions={
            <Link href="/admin/drivers" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
              Sürücüler <ArrowRightIcon size={14} aria-hidden />
            </Link>
          }
        >
          <ul>
            {entries.map(({ vehicle, session, live }) => (
              <li key={vehicle.id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 gap-y-3 border-t border-line px-5 py-3.5 first:border-t-0 sm:grid-cols-[2.5rem_1fr_7rem_auto]">
                <span className="font-title text-xl font-light text-dim tabular">{String(vehicle.slot).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <p className="truncate font-title font-bold">{session ? fullName(session.driver) : <span className="font-normal text-muted">Sürücü yok</span>}</p>
                  <p className="truncate font-label text-xs tracking-[0.06em] text-muted uppercase">
                    {vehicle.plate}
                    {session && ` · ${formatTime(session.startedAt)} · ${formatDuration(now - session.startedAt)}`}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <LiveBpm live={live} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden md:inline-flex">
                    <StatusPill status={live.status} />
                  </span>
                  <DriverActions vehicleId={vehicle.id} plate={vehicle.plate} session={session} compact />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Son işlemler"
          actions={
            <Link href="/admin/activity" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
              Tümü <ArrowRightIcon size={14} aria-hidden />
            </Link>
          }
        >
          {activity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Henüz işlem yok.</p>
          ) : (
            <ol>
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
