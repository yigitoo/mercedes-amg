"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";

import type { ActionState } from "@/app/admin/actions";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";

type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

interface ActionDialogProps {
  trigger: ReactNode;
  triggerVariant?: ButtonProps["variant"];
  title: string;
  description?: ReactNode;
  action: FormAction;
  submitLabel: string;
  submitVariant?: ButtonProps["variant"];
  /** Forma gizli alan olarak eklenir (örn. vehicleId). */
  hidden?: Record<string, string>;
  /** Form alanları. `openedAt`: diyaloğun açıldığı an (varsayılan saat alanları için). */
  children?: (state: ActionState, context: { openedAt: number }) => ReactNode;
}

/**
 * Admin'deki tüm düzenleme akışlarının ortak kalıbı: düğme → diyalog → form → server action.
 * Başarılı olunca diyalog kapanır ve form sıfırlanır; hata varsa diyalog açık kalır, alanlar altına yazılır.
 */
export function ActionDialog(props: ActionDialogProps) {
  const [open, setOpen] = useState(false);
  // Her açılışta yeni form: önceki denemenin hataları ve değerleri taşınmasın.
  const [openedAt, setOpenedAt] = useState(0);

  return (
    <>
      <Button
        variant={props.triggerVariant ?? "secondary"}
        size="sm"
        onClick={() => {
          setOpenedAt(Date.now());
          setOpen(true);
        }}
      >
        {props.trigger}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={props.title} description={props.description}>
        {open && <ActionForm key={openedAt} {...props} openedAt={openedAt} onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function ActionForm({ action, hidden, submitLabel, submitVariant, children, openedAt, onDone }: ActionDialogProps & { openedAt: number; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="grid gap-5">
      {hidden && Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children?.(state, { openedAt })}
      <FormMessage message={state.message} />
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Vazgeç
        </Button>
        <Button type="submit" variant={submitVariant ?? "primary"} disabled={pending} aria-busy={pending}>
          {pending ? "Kaydediliyor…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
