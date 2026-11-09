import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  hint?: string;
  error?: string;
}

/** Etiket üstte, yardım ve hata metni altta; hata ekran okuyucuya da bağlanır. */
export function Field({ label, name, hint, error, className, id = name, ...props }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="text-sm font-bold text-soft">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 rounded-sm border bg-ink px-3 text-base text-fg placeholder:text-dim focus:border-soft focus:outline-none",
          error ? "border-amg" : "border-line-strong",
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-amg-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
