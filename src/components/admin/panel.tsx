import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Admin içerik kutusu: hafif yuvarlatılmış, başlıklı ya da başlıksız. */
export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-title text-base font-bold">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
