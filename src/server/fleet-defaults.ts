import "server-only";

import type { Driver, Vehicle } from "@/domain/types";
import { vehicleIdForSlot } from "./db/repository";

/** Kurgu: 8 araç, her araçta sürücünün taktığı bir nabız bilekliği. Plakalar ve modeller admin panelden değiştirilir. */
export const FLEET_SIZE = 8;

/** Bileklik kimlikleri araç numarasından türetilir (simülatörle aynı): band-01 … band-08. */
export const deviceIdForSlot = (slot: number) => `band-${String(slot).padStart(2, "0")}`;

const DEFAULT_MODELS = [
  "AMG GT 63",
  "AMG C 63 S E",
  "AMG SL 63",
  "AMG E 53",
  "AMG GLE 63 S",
  "AMG CLE 53",
  "AMG G 63",
  "AMG GT 43",
] as const;

export function defaultFleet(): Vehicle[] {
  return Array.from({ length: FLEET_SIZE }, (_, i) => {
    const slot = i + 1;
    return {
      id: vehicleIdForSlot(slot),
      slot,
      plate: `34 AMG ${String(slot).padStart(3, "0")}`,
      deviceId: deviceIdForSlot(slot),
      model: DEFAULT_MODELS[i] ?? "",
      lastSample: null,
    };
  });
}

/** `DEMO_SEED=true` iken boş filoya atanan örnek sürücüler; iki araç bilerek boş bırakılır. */
export const DEMO_DRIVERS: (Driver | null)[] = [
  { firstName: "Deniz", lastName: "Karaca" },
  { firstName: "Elif", lastName: "Aydemir" },
  { firstName: "Mert", lastName: "Bozkurt" },
  { firstName: "Selin", lastName: "Ergün" },
  { firstName: "Kaan", lastName: "Tunalı" },
  null,
  { firstName: "Zeynep", lastName: "Ilgaz" },
  null,
];
