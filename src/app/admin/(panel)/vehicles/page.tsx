import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { VehicleActions } from "@/components/admin/vehicle-actions";
import { LicensePlate } from "@/components/brand/license-plate";
import { formatTimeWithSeconds } from "@/lib/format";
import { getFleet } from "@/server/services/fleet-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Araçlar" };

/** 8 aracın plaka ve modeli. Bileklik eşleşmesi sabittir (N. araç = band-0N), burada gösterilmez. */
export default async function VehiclesPage() {
  const fleet = await getFleet();
  return (
    <>
      <PageHeader title="Araçlar" description="Plaka ve model canlı ekranda, admin panelinde ve raporlarda kullanılır." />
      <Panel>
        <ul>
          {fleet.map(({ vehicle }) => (
            <li key={vehicle.id} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 border-t border-line px-5 py-4 first:border-t-0 sm:grid-cols-[3rem_auto_1fr_auto]">
              <span className="font-title text-3xl font-light text-dim tabular">{String(vehicle.slot).padStart(2, "0")}</span>
              <LicensePlate plate={vehicle.plate} className="justify-self-start text-sm" />
              <div className="col-span-3 min-w-0 sm:col-span-1">
                <p className="font-title font-bold">{vehicle.model || "Model girilmedi"}</p>
                <p className="text-sm text-muted">{vehicle.lastSample ? `Son nabız verisi ${formatTimeWithSeconds(vehicle.lastSample.at)}` : "Henüz nabız verisi gelmedi"}</p>
              </div>
              <div className="col-start-3 row-start-1 sm:col-start-4">
                <VehicleActions vehicle={vehicle} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
