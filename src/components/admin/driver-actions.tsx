"use client";

import { FlagCheckeredIcon, PencilSimpleLineIcon, SteeringWheelIcon } from "@phosphor-icons/react";

import { assignDriverAction, endSessionAction, renameDriverAction } from "@/app/admin/actions";
import type { Driver } from "@/domain/types";
import { Field } from "@/components/ui/field";
import { TimeField } from "@/components/ui/time-field";
import { fullName } from "@/lib/format";
import { ActionDialog } from "./action-dialog";

interface DriverActionsProps {
  vehicleId: string;
  plate: string;
  /** Aktif sürüş varsa: sürücü ve sürüş kimliği. */
  session: { id: string; driver: Driver } | null;
  /** Yalnız birincil eylemi göster (genel bakış tablosu gibi dar yerler). */
  compact?: boolean;
}

/** Bir aracın sürücü eylemleri: ata / değiştir, sürüşü bitir, ad düzelt. Her biri denetim kaydına yazılır. */
export function DriverActions({ vehicleId, plate, session, compact = false }: DriverActionsProps) {
  const driver = session?.driver ?? null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ActionDialog
        trigger={
          <>
            <SteeringWheelIcon size={16} aria-hidden />
            {driver ? "Değiştir" : "Sürücü ata"}
          </>
        }
        triggerVariant={driver ? "secondary" : "primary"}
        title={driver ? "Sürücüyü değiştir" : "Sürücü ata"}
        description={
          driver ? (
            <>
              {plate}: <strong className="text-fg">{fullName(driver)}</strong> sürüşü seçilen saatte kapanır, yeni sürücünün kaydı başlar.
            </>
          ) : (
            <>{plate} aracına binen kişi. Nabız kaydı seçilen saatten itibaren bu sürücüye yazılır.</>
          )
        }
        action={assignDriverAction}
        submitLabel="Sürüşü başlat"
        hidden={{ vehicleId }}
      >
        {(state, { openedAt }) => (
          <>
            <NameFields errors={state.errors} />
            <TimeField name="startedAt" label="Biniş saati" now={openedAt} hint="Şimdi başlıyorsa dokunmayın." error={state.errors?.startedAt} />
          </>
        )}
      </ActionDialog>

      {session && !compact && (
        <>
          <ActionDialog
            trigger={
              <>
                <PencilSimpleLineIcon size={16} aria-hidden />
                Adı düzelt
              </>
            }
            triggerVariant="ghost"
            title="Sürücü adını düzelt"
            description="Yazım hatası için: sürüş ve ölçümler aynen kalır, yalnız ad değişir. Başka biri bindiyse 'Değiştir' kullanın."
            action={renameDriverAction}
            submitLabel="Kaydet"
            hidden={{ sessionId: session.id }}
          >
            {(state) => <NameFields errors={state.errors} defaults={session.driver} />}
          </ActionDialog>

          <ActionDialog
            trigger={
              <>
                <FlagCheckeredIcon size={16} aria-hidden />
                Bitir
              </>
            }
            triggerVariant="ghost"
            title="Sürüşü bitir"
            description={
              <>
                {plate}: <strong className="text-fg">{fullName(session.driver)}</strong> sürüşü şimdi kapanır. Kayıt raporda kalır, araç yeni sürücüye hazır olur.
              </>
            }
            action={endSessionAction}
            submitLabel="Sürüşü bitir"
            submitVariant="danger"
            hidden={{ vehicleId }}
          />
        </>
      )}
    </div>
  );
}

function NameFields({ errors, defaults }: { errors?: Record<string, string | undefined>; defaults?: Driver }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Ad" name="firstName" autoComplete="off" required autoFocus defaultValue={defaults?.firstName} error={errors?.firstName} />
      <Field label="Soyad" name="lastName" autoComplete="off" required defaultValue={defaults?.lastName} error={errors?.lastName} />
    </div>
  );
}
