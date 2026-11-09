import { cn } from "@/lib/cn";

interface CheckeredFlagProps {
  /** Dikey dilim sayısı (4'ün katı önerilir); her dilim kısa gecikmeyle dalgalanır, kumaş hissi verir. */
  slices?: number;
  /** Yükseklikteki kare sayısı (çift sayı). */
  rows?: number;
  /** Bayrak direği gösterilsin mi. */
  pole?: boolean;
  className?: string;
}

const CHECKER = "repeating-conic-gradient(var(--color-fg) 0 25%, #0a0a0b 0 50%)";

/**
 * Damalı bitiş bayrağı. Boyutu kapsayıcıdan gelir (className ile genişlik/yükseklik).
 *
 * Desen geometrisi: bir kare = iki dilim genişliğinde. CSS damalı deseninin bir tekrarı 2×2 karedir,
 * yani 4 dilim genişliğinde ve `2 / rows` yüksekliğinde. Her dilim aynı deseni gösterir, yalnız kendi
 * yatay kaymasıyla; böylece dilimler yan yana kesintisiz bir bayrak oluşturur ve ayrı ayrı dalgalanabilir.
 * Azaltılmış harekette dalga durur.
 */
export function CheckeredFlag({ slices = 16, rows = 4, pole = true, className }: CheckeredFlagProps) {
  const sliceWidth = 100 / slices;
  const tileHeight = 200 / rows; // yüzde
  return (
    <span className={cn("relative flex", className)} aria-hidden>
      {pole && <span className="absolute top-[-6%] -left-[5%] h-[150%] w-[3.5%] rounded-full bg-gradient-to-b from-fg via-soft to-dim" />}
      {Array.from({ length: slices }, (_, i) => (
        <span
          key={i}
          className="h-full origin-left motion-safe:animate-[flag-wave_1.15s_ease-in-out_infinite]"
          style={{
            width: `${sliceWidth}%`,
            animationDelay: `${i * 65}ms`,
            backgroundImage: CHECKER,
            // Desen tekrarı dilimin 4 katı genişlikte; yüzde konum (dilim − desen) farkına göre işler:
            // k. kaymayı (k dilim sola) elde etmek için konum = k/3.
            backgroundSize: `400% ${tileHeight}%`,
            backgroundPosition: `${((i % 4) / 3) * 100}% 0`,
          }}
        />
      ))}
    </span>
  );
}
