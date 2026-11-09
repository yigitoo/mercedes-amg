import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/admin/auto-refresh";
import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { REDLINE_BPM } from "@/domain/heart-rate";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration, formatTime, fullName } from "@/lib/format";
import { getFleetReport } from "@/server/services/report-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Biniş kayıtları" };

/** Tüm binişler, en yeni üstte: kim hangi araca ne zaman bindi, ne zaman indi. Satır sürüş raporuna gider. */
export default async function BoardingsPage() {
  const report = await getFleetReport();
  const slotOf = new Map(report.vehicles.map((v) => [v.vehicle.id, v.vehicle.slot]));
  const rows = report.vehicles.flatMap((v) => v.sessions).sort((a, b) => b.session.startedAt - a.session.startedAt);

  return (
    <>
      <AutoRefresh intervalMs={10_000} />
      <PageHeader title="Biniş kayıtları" description={`${rows.length} biniş. Sürücü atandığında kayıt açılır, değiştirildiğinde ya da bitirildiğinde kapanır.`} />
      <Panel>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-muted">Henüz biniş yok. Sürücüler sayfasından ilk sürücüyü atayın.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-normal">Araç</th>
                  <th scope="col" className="px-3 py-3 font-normal">Sürücü</th>
                  <th scope="col" className="px-3 py-3 font-normal">Biniş</th>
                  <th scope="col" className="px-3 py-3 font-normal">İniş</th>
                  <th scope="col" className="px-3 py-3 font-normal">Süre</th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">Ort.</th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">Maks.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ session, durationMs, avg, max }) => (
                  <tr key={session.id} className="border-t border-line transition-colors hover:bg-raised">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="mr-2 font-title text-dim tabular">{String(slotOf.get(session.vehicleId) ?? 0).padStart(2, "0")}</span>
                      <span className="font-label text-xs tracking-[0.06em] text-soft uppercase">{session.plate}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/reports/${session.id}`} className="font-title font-bold hover:underline">
                        {fullName(session.driver)}
                      </Link>
                    </td>
                    <td className="px-3 py-3 tabular" title={formatDateTime(session.startedAt)}>
                      {formatTime(session.startedAt)}
                    </td>
                    <td className="px-3 py-3 tabular">
                      {session.endedAt ? formatTime(session.endedAt) : <span className="font-label text-xs tracking-[0.1em] text-amg-text uppercase">Sürüyor</span>}
                    </td>
                    <td className="px-3 py-3 tabular">{formatDuration(durationMs)}</td>
                    <td className="px-3 py-3 text-right tabular">{avg ?? "--"}</td>
                    <td className={cn("px-5 py-3 text-right font-bold tabular", (max ?? 0) >= REDLINE_BPM && "text-amg-text")}>{max ?? "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
