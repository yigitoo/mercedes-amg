"use client";

import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/**
 * Yerel <dialog> üzerine ince bir sarmalayıcı: odak hapsi, Esc ile kapanma ve arka plan erişilebilirliği
 * tarayıcıdan gelir. Arka plana tıklamak da kapatır.
 */
export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line-strong bg-surface p-0 text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-title text-xl font-bold">{title}</h2>
            {description && <div className="mt-1 text-sm text-muted">{description}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="-m-2 cursor-pointer rounded-sm p-2 text-muted hover:text-fg">
            <XIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
