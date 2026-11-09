"use client";

import { useActionState } from "react";

import { updateSettingsAction, type ActionState } from "@/app/admin/actions";
import type { EventSettings, GaugeStyle } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/lib/cn";

const GAUGES: { value: GaugeStyle; title: string; description: string }[] = [
  { value: "bar", title: "Devir barı (varsayılan)", description: "Büyük rakam, altında eğik şeritli bar." },
  { value: "dial", title: "Kadran", description: "Yuvarlak devir göstergesi, rakam ortada." },
];

/** Canlı ekran ayarları formu. Kaydedilince TV ekranı bir sonraki saniyede yeni ayarla çizilir. */
export function DisplayForm({ settings }: { settings: EventSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateSettingsAction, {});
  return (
    <form action={action} className="grid gap-8">
      <fieldset className="grid gap-5">
        <legend className="mb-4 font-title text-lg font-bold">Metinler</legend>
        <Field label="Başlık" name="title" defaultValue={settings.title} required maxLength={48} error={state.errors?.title} />
        <Field label="Alt başlık" name="subtitle" defaultValue={settings.subtitle} maxLength={80} hint="Boş bırakılırsa gösterilmez." error={state.errors?.subtitle} />
        <Field label="Alt bant" name="tagline" defaultValue={settings.tagline} maxLength={48} hint="Ekranın altında, yazıldığı gibi gösterilir." error={state.errors?.tagline} />
      </fieldset>

      <fieldset>
        <legend className="mb-4 font-title text-lg font-bold">Nabız göstergesi</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {GAUGES.map((gauge) => (
            <label
              key={gauge.value}
              className="group relative flex cursor-pointer gap-3 rounded-[var(--radius-card)] border border-line-strong bg-ink p-4 transition-colors has-[:checked]:border-fg"
            >
              <input type="radio" name="gauge" value={gauge.value} defaultChecked={settings.gauge === gauge.value} className="mt-1 accent-[var(--color-amg)]" />
              <span>
                <span className="block font-title font-bold">{gauge.title}</span>
                <span className="block text-sm text-muted">{gauge.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormMessage message={state.message} />
      {state.ok && <FormMessage tone="info" message="Kaydedildi. Canlı ekran güncellendi." />}
      <div className={cn("flex justify-end")}>
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
