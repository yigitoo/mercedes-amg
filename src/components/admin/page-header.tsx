import type { ReactNode } from "react";

/** Her admin sayfasının başlığı: başlık + kısa açıklama, sağda sayfa eylemleri. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="min-w-0">
        <h1 className="font-title text-3xl leading-tight font-bold">{title}</h1>
        {description && <p className="mt-1.5 max-w-[65ch] text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
