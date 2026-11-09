import type { Metadata } from "next";

import { AutoRefresh } from "@/components/admin/auto-refresh";
import { DriverActions } from "@/components/admin/driver-actions";
import { LiveBpm } from "@/components/admin/live-bpm";
import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { StatusPill } from "@/components/admin/status-pill";
import { formatDuration, formatTime, fullName } from "@/lib/format";
import { getFleetOverview } from "@/server/services/live-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sürücüler" };

/**
 * Sürücü değişiminin yapıldığı ekran. Araca biri bindiğinde "Sürücü ata", inen biri yerine başkası bindiğinde
 * "Değiştir" (önceki sürüş o saatte kapanır), yanlış yazılan ad için "Adı düzelt".
 */
export default async function DriversPage() {
  const { generatedAt: now, entries } = await getFleetOverview();
  return (
    <>
      <AutoRefresh />
      <PageHeader title="Sürücüler" description="Araca binen kişiyi atayın. Değişiklik canlı ekrana 1 saniye içinde yansır ve kayıtlara yazılır." />
      <Panel>
        <ul>
          {entries.map(({ vehicle, session, live }) => (
            <li key={vehicle.id} className="grid gap-4 border-t border-line px-5 py-5 first:border-t-0 md:grid-cols-[3rem_1.4fr_1fr_auto] md:items-center">
              <span className="font-title text-3xl font-light text-dim tabular">{String(vehicle.slot).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="truncate font-title text-xl font-bold">{session ? fullName(session.driver) : <span className="font-normal text-muted">Sürücü atanmadı</span>}</p>
                <p className="mt-1 font-label text-xs tracking-[0.08em] text-muted uppercase">
                  {vehicle.plate} · {vehicle.model}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <StatusPill status={live.status} />
                <LiveBpm live={live} />
                {session && (
                  <span className="text-sm text-muted tabular">
                    {formatTime(session.startedAt)} · {formatDuration(now - session.startedAt)}
                  </span>
                )}
              </div>
              <DriverActions vehicleId={vehicle.id} plate={vehicle.plate} session={session} />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
