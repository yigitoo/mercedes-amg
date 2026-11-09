"use client";

import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/** Küçük seçim anahtarı (radyo grubu). Klavye ile ok tuşlarıyla gezilir. */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-sm border border-line-strong p-0.5", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 cursor-pointer rounded-sm px-2.5 font-label text-[0.7rem] tracking-[0.1em] uppercase transition-colors",
              selected ? "bg-fg text-ink" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
