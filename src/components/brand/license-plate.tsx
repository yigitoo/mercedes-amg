import { cn } from "@/lib/cn";

/**
 * Plaka çerçevesi, AMG "License plate frame" kuralına göre (brand/references/license-plate-frame-spec.png):
 * mat siyah zemin, Corpo S Title Bold beyaz yazı, yazının üstünde ve altında yazı yüksekliğinin 3/4'ü kadar boşluk.
 */
export function LicensePlate({ plate, className }: { plate: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-line-strong bg-black px-[0.6em] py-[0.75em] font-title font-bold leading-[0.72] tracking-[0.04em] whitespace-nowrap text-fg uppercase",
        className,
      )}
    >
      {plate}
    </span>
  );
}
