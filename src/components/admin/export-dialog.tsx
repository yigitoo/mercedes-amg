"use client";

import { DownloadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { AmgProgress } from "@/components/ui/amg-progress";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { CSV_BOM, csvRow, type CsvCell } from "@/lib/csv";

type ExportKind = "readings" | "audit";

const EXPORTS: { kind: ExportKind; title: string; description: string; file: string }[] = [
  { kind: "readings", title: "Nabız kayıtları", description: "Her ölçüm: zaman, araç, plaka, sürücü, bpm, bölge.", file: "amg-nabiz-kayitlari" },
  { kind: "audit", title: "İşlem kayıtları", description: "Sürücü atamaları, düzeltmeler, araç ve ekran değişiklikleri, girişler.", file: "amg-islem-kayitlari" },
];

interface ExportPage {
  header: string[];
  rows: CsvCell[][];
  next: string | null;
  total: number;
}

type Progress = { kind: ExportKind; done: number; total: number | null; batches: number };

/**
 * Tüm logları dışa aktarır. Veri sunucudan 5.000'lik parçalar halinde çekilir ve tarayıcıda tek CSV'ye
 * birleştirilir: büyük veride tek istek zaman aşımına düşmez, ilerleme gösterilir, istenirse iptal edilir.
 * Bir parça başarısız olursa 3 kez yeniden denenir.
 */
export function ExportButton({ variant = "secondary", size = "md", className }: Pick<ButtonProps, "variant" | "size" | "className">) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const run = async (kind: ExportKind, file: string) => {
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(undefined);
    setProgress({ kind, done: 0, total: null, batches: 0 });

    const lines: string[] = [];
    let cursor: string | null = null;
    let total: number | null = null;
    let done = 0;
    let batches = 0;
    try {
      do {
        const page: ExportPage = await fetchPage(kind, cursor, controller.signal);
        if (lines.length === 0) lines.push(csvRow(page.header));
        if (total == null && page.total >= 0) total = page.total;
        for (const row of page.rows) lines.push(csvRow(row));
        done += page.rows.length;
        batches += 1;
        cursor = page.next;
        setProgress({ kind, done, total: total == null ? null : Math.max(total, done), batches });
      } while (cursor);

      download(`${CSV_BOM}${lines.join("\r\n")}\r\n`, `${file}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`);
      setProgress({ kind, done, total: done, batches });
    } catch (e) {
      if (controller.signal.aborted) setProgress(null);
      else setError(e instanceof Error ? e.message : "Dışa aktarma tamamlanamadı.");
    } finally {
      abort.current = null;
      setBusy(false);
    }
  };

  const close = () => {
    abort.current?.abort();
    setOpen(false);
    setProgress(null);
    setError(undefined);
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <DownloadSimpleIcon size={16} aria-hidden />
        Dışa aktar
      </Button>
      <Dialog open={open} onClose={close} title="Tüm logları dışa aktar" description="CSV olarak indirilir (Excel ile açılır). Büyük veri parça parça çekilir.">
        <div className="grid gap-3">
          {EXPORTS.map(({ kind, title, description, file }) => {
            const active = progress?.kind === kind;
            const finished = active && progress.total != null && progress.done >= progress.total && !busy;
            return (
              <div key={kind} className="rounded-[var(--radius-card)] border border-line-strong bg-ink p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-title font-bold">{title}</p>
                    <p className="text-sm text-muted">{description}</p>
                  </div>
                  <Button size="sm" variant={finished ? "secondary" : "primary"} disabled={busy} onClick={() => run(kind, file)}>
                    <DownloadSimpleIcon size={16} aria-hidden />
                    {finished ? "Tekrar indir" : "İndir"}
                  </Button>
                </div>
                {active && (
                  <div className="mt-4">
                    <AmgProgress
                      value={progress.total ? progress.done / progress.total : progress.total === 0 ? 1 : null}
                      label={finished ? "İndirildi" : "Hazırlanıyor"}
                      detail={`${progress.done.toLocaleString("tr-TR")}${progress.total != null ? ` / ${progress.total.toLocaleString("tr-TR")}` : ""} satır · ${progress.batches} parça`}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <FormMessage message={error} />
          {busy && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}>
                <XIcon size={16} aria-hidden /> İptal
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

async function fetchPage(kind: ExportKind, cursor: string | null, signal: AbortSignal, attempt = 1): Promise<ExportPage> {
  const params = new URLSearchParams({ kind });
  if (cursor) params.set("cursor", cursor);
  try {
    const response = await fetch(`/api/admin/export?${params}`, { signal, cache: "no-store" });
    if (response.status === 401) throw new Error("Oturum süresi doldu. Sayfayı yenileyip tekrar giriş yapın.");
    if (!response.ok) throw new Error(`Sunucu hatası (${response.status}).`);
    return (await response.json()) as ExportPage;
  } catch (error) {
    if (signal.aborted || attempt >= 3 || (error instanceof Error && error.message.startsWith("Oturum"))) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    return fetchPage(kind, cursor, signal, attempt + 1);
  }
}

function download(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
