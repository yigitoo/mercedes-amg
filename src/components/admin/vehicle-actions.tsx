"use client";

import { PencilSimpleIcon } from "@phosphor-icons/react";

import { updateVehicleAction } from "@/app/admin/actions";
import { Field } from "@/components/ui/field";
import { ActionDialog } from "./action-dialog";

/** Plaka ve model düzenleme. Değişiklik canlı ekrana 1 saniyede yansır ve denetim kaydına yazılır. */
export function VehicleActions({ vehicle }: { vehicle: { id: string; slot: number; plate: string; model: string } }) {
  return (
    <ActionDialog
      trigger={
        <>
          <PencilSimpleIcon size={16} aria-hidden />
          Düzenle
        </>
      }
      triggerVariant="secondary"
      title={`${String(vehicle.slot).padStart(2, "0")}. araç`}
      description="Plaka ve model canlı ekranda ve raporlarda görünür. Devam eden sürüşün raporunda başlangıçtaki plaka korunur."
      action={updateVehicleAction}
      submitLabel="Kaydet"
      hidden={{ vehicleId: vehicle.id }}
    >
      {(state) => (
        <>
          <Field label="Plaka" name="plate" defaultValue={vehicle.plate} required autoComplete="off" autoFocus hint="Örnek: 34 AMG 001" error={state.errors?.plate} />
          <Field label="Model" name="model" defaultValue={vehicle.model} autoComplete="off" hint="Örnek: AMG GT 63" error={state.errors?.model} />
        </>
      )}
    </ActionDialog>
  );
}
