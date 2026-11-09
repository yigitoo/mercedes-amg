import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTime, formatTimeWithSeconds } from "@/lib/format";
import { AUDIT_LABELS, listAudit } from "@/server/services/audit-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kayıtlar" };

const PAGE_SIZE = 50;

/** Denetim kaydı: panelde yapılan her değişiklik, önceki ve sonraki değerleriyle. Kayıtlar silinmez. */
export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const { before } = await searchParams;
  const beforeAt = typeof before === "string" && Number.isFinite(Number(before)) ? Number(before) : undefined;
  const entries = await listAudit({ limit: PAGE_SIZE, before: beforeAt });
  const oldest = entries.at(-1)?.at;

  return (
    <>
      <PageHeader title="Kayıtlar" description="Sürücü atamaları, ad düzeltmeleri, araç ve ekran değişiklikleri, girişler. Veritabanına yazılır, silinmez." />
      <Panel>
        {entries.length === 0 ? (
          <p className="px-5 py-8 text-muted">Kayıt yok.</p>
        ) : (
          <ol>
            {entries.map((entry) => (
              <li key={entry.id} className="grid gap-1 border-t border-line px-5 py-4 first:border-t-0 sm:grid-cols-[9rem_10rem_1fr] sm:gap-4">
                <span className="text-sm text-muted tabular" title={formatDateTime(entry.at)}>
                  {formatTimeWithSeconds(entry.at)}
                </span>
                <span className={entry.action === "admin.login_failed" ? "text-sm font-bold text-amg-text" : "text-sm font-bold"}>{AUDIT_LABELS[entry.action]}</span>
                <div>
                  <p>{entry.summary}</p>
                  {entry.changes && (
                    <dl className="mt-1.5 grid gap-0.5 text-sm">
                      {Object.entries(entry.changes).map(([field, change]) => (
                        <div key={field} className="flex flex-wrap gap-x-2">
                          <dt className="text-muted">{field}:</dt>
                          <dd>
                            <span className="text-muted line-through">{change.from ?? "boş"}</span> → {change.to ?? "boş"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <div className="mt-4 flex justify-end gap-2">
        {beforeAt && (
          <Link href="/admin/activity" className={buttonClasses({ variant: "ghost" })}>
            En yeniye dön
          </Link>
        )}
        {entries.length === PAGE_SIZE && oldest && (
          <Link href={`/admin/activity?before=${oldest}`} className={buttonClasses({ variant: "secondary" })}>
            Daha eski
          </Link>
        )}
      </div>
    </>
  );
}
