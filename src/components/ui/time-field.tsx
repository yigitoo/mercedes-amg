"use client";

import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { formatDate, formatMinuteOfDay, minuteOfDay } from "@/lib/format";

const DAY = 24 * 60;
const SHORTCUTS = [
  { label: "Şimdi", minutesAgo: 0 },
  { label: "5 dk önce", minutesAgo: 5 },
  { label: "10 dk önce", minutesAgo: 10 },
  { label: "15 dk önce", minutesAgo: 15 },
  { label: "30 dk önce", minutesAgo: 30 },
] as const;

interface TimeFieldProps {
  name: string;
  label: string;
  /** Alanın açıldığı an; varsayılan saat ve kısayollar buna göre hesaplanır. */
  now: number;
  hint?: string;
  error?: string;
}

/**
 * Saat seçici: tarih otomatik (bugün), yalnız saat seçilir. Büyük HH:MM, saat ve dakika için
 * yukarı/aşağı düğmeleri, sık kullanılan "x dk önce" kısayolları. Forma "HH:MM" olarak gider.
 */
export function TimeField({ name, label, now, hint, error }: TimeFieldProps) {
  const current = minuteOfDay(now);
  const [minutes, setMinutes] = useState(current);
  const shift = (delta: number) => setMinutes((m) => (m + delta + DAY) % DAY);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return (
    <fieldset className="grid gap-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-2 text-sm font-bold text-soft">{label}</legend>
      <input type="hidden" name={name} value={formatMinuteOfDay(minutes)} />

      <div className={cn("flex items-center gap-5 rounded-sm border bg-ink px-4 py-3", error ? "border-amg" : "border-line-strong")}>
        <div className="flex items-center gap-1">
          <Stepper label="Saat" value={hours} max={23} onSet={(h) => setMinutes(h * 60 + mins)} onUp={() => shift(60)} onDown={() => shift(-60)} />
          <span className="pb-1 font-title text-4xl font-bold text-muted">:</span>
          <Stepper label="Dakika" value={mins} max={59} onSet={(m) => setMinutes(hours * 60 + m)} onUp={() => shift(1)} onDown={() => shift(-1)} />
        </div>
        <div className="min-w-0 border-l border-line pl-5">
          <p className="font-label text-xs tracking-[0.12em] text-muted uppercase">Tarih</p>
          <p className="mt-0.5 font-title font-bold">Bugün</p>
          <p className="text-sm text-muted">{formatDate(now)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hızlı seçim">
        {SHORTCUTS.map(({ label: text, minutesAgo }) => {
          const target = (current - minutesAgo + DAY) % DAY;
          return (
            <button
              key={text}
              type="button"
              onClick={() => setMinutes(target)}
              aria-pressed={minutes === target}
              className={cn(
                "h-8 cursor-pointer rounded-sm border px-3 text-sm transition-colors",
                minutes === target ? "border-fg bg-fg text-ink" : "border-line-strong text-soft hover:border-soft hover:text-fg",
              )}
            >
              {text}
            </button>
          );
        })}
      </div>

      {error ? (
        <p id={`${name}-error`} role="alert" className="text-sm text-amg-text">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-muted">{hint}</p>
      )}
    </fieldset>
  );
}

interface StepperProps {
  label: string;
  value: number;
  max: number;
  onSet: (value: number) => void;
  onUp: () => void;
  onDown: () => void;
}

/** Yukarı/aşağı düğmeli, elle yazılabilir iki haneli alan. Yazarken serbest, alandan çıkınca geçerli aralığa oturur. */
function Stepper({ label, value, max, onSet, onUp, onDown }: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft != null && draft !== "") onSet(Math.min(max, Math.max(0, Number(draft))));
    setDraft(null);
  };
  return (
    <div className="flex flex-col items-center">
      <StepButton label={`${label} artır`} onClick={onUp}>
        <CaretUpIcon size={16} weight="bold" />
      </StepButton>
      <input
        aria-label={label}
        inputMode="numeric"
        maxLength={2}
        value={draft ?? String(value).padStart(2, "0")}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.currentTarget.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={commit}
        onKeyDown={(e) => {
          const handlers: Record<string, () => void> = { ArrowUp: onUp, ArrowDown: onDown, Enter: () => e.currentTarget.blur() };
          const handler = handlers[e.key];
          if (!handler) return;
          e.preventDefault();
          handler();
        }}
        className="w-[2.6ch] rounded-sm bg-transparent text-center font-title text-4xl leading-none font-bold tabular outline-none focus:bg-raised"
      />
      <StepButton label={`${label} azalt`} onClick={onDown}>
        <CaretDownIcon size={16} weight="bold" />
      </StepButton>
    </div>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid h-7 w-11 cursor-pointer place-items-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-fg active:scale-95">
      {children}
    </button>
  );
}
