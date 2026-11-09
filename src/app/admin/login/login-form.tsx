"use client";

import { useActionState } from "react";

import { login, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, {});
  return (
    <form action={action} className="mt-6 grid gap-5">
      <input type="hidden" name="next" value={next} />
      <Field label="Şifre" name="password" type="password" autoComplete="current-password" required autoFocus error={state.errors?.password} />
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? "Kontrol ediliyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
