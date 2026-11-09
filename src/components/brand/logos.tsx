/**
 * Resmi marka işaretleri. Path verileri brand/logos/ altındaki orijinal SVG dosyalarından üretildi.
 * Elle değiştirmeyin; logo oranları ve koruma alanı brand/README.md içinde.
 * Renk `currentColor`: beyaz zeminde siyah, siyah zeminde beyaz kullanılır; logo asla kırmızıya boyanmaz.
 */
import type { SVGProps } from "react";

import { STAR_PATHS, STAR_VIEWBOX } from "./star-paths";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children"> & { title?: string };

export const AMG_PATHS = ["M661.9,248.4c0-1.6-1.3-2.8-2.8-2.8h-1.4h-43.9h-1.4c-1.6,0-2.8,1.3-2.8,2.8v0.5v3.5c0,1.6,1.3,2.9,2.8,2.9 h29.3c2,0,1.9,0.9,1.9,3.2v0.5c0,2.3,0.1,2.8-1.8,2.8h-59.2H582c-1.6,0-2.8-1.3-2.8-2.8v-0.4v-16.3v-0.5c0-1.6,1.3-2.8,2.8-2.8h0.5 H657h2.1c1.6,0,2.8-1.3,2.8-2.8v-1.2V231v-1.3c0-1.6-1.3-2.8-2.8-2.8H657h-65h-14.7h-13c-1.6,0-2.8,1.3-2.8,2.8v42.1 c0,1.6,1.3,2.8,2.8,2.8h12.1H592h65.7h1.4c1.6,0,2.8-1.3,2.8-2.8v-2v-19.1v-2.7",
  "M509.3,260.1c-1.3,0.8-2.3,1.7-3.8,1.7h-12c-1.6,0-2.5-0.8-3.8-1.7l-23.2-14.7c-1.3-0.8-2.4-0.2-2.4,1.3v25 c0,1.6-1.3,2.8-2.8,2.8h-12.1c-1.6,0-2.8-1.3-2.8-2.8v-42.1c0-1.6,1.3-2.8,2.8-2.8h13c1.6,0,2.5,0.7,3.8,1.5l31.6,20.5 c1.3,0.8,2.6,0.8,3.9,0l31.6-20.4c1.3-0.8,2.3-1.5,3.8-1.5h13c1.6,0,2.8,1.3,2.8,2.8v42.1c0,1.6-1.3,2.8-2.8,2.8h-12.1 c-1.6,0-2.8-1.3-2.8-2.8v-25c0-1.6-1.1-2.2-2.4-1.3L509.3,260.1L509.3,260.1z",
  "M341.6,274.6h-15.6c-1.2,0-1.7-1.1-1.1-2.1l33.8-43.8c0.8-1,2-1.9,3.1-1.9h72.7c2,0,3.2,1.6,3.2,3.6v40.7v0.7 c0,1.6-1.3,2.8-2.8,2.8h-0.3h-11.8c-1.6,0-2.8-1.3-2.8-2.8v-6c0-1.7-0.1-2.3-1.9-2.3h-63.6c-1.2,0-2,0.8-2.8,1.9l-0.2,0.2l-4.8,6.3 c-1.2,1.6-2.9,2.8-4.5,2.8H341.6z M372.9,238.8c-0.8,0-1.5,0.6-2,1.3l-7.5,9.7c-0.5,0.7-0.2,1.3,0.6,1.3h53.9 c1.7,0,1.8-0.7,1.9-2.3V242c0-2.3,0.1-3.2-1.9-3.2H372.9z",
  "M311.2,274.6c1.6,0,3.3-1.3,4.5-2.8l32.5-42.1c1.2-1.6,0.6-2.8-0.9-2.8h-6.5c-1.2,0-2.3,0.9-3.1,1.9 l-33.8,43.8c-0.5,1,0,2.1,1.1,2.1H311.2z",
  "M292,274.6c1.6,0,3.3-1.3,4.5-2.8l32.5-42.1c1.2-1.6,0.6-2.8-0.9-2.8h-9.2c-1.2,0-2.3,0.9-3.1,1.9l-33.8,43.8 c-0.5,1,0,2.1,1.1,2.1H292z",
  "M258.4,274.6c-1.2,0-1.7-1.1-1.1-2.1l33.8-43.8c0.8-1,2-1.9,3.1-1.9h13.5c1.6,0,2.1,1.3,0.9,2.8l-32.5,42.1 c-1.2,1.6-2.9,2.8-4.5,2.8H258.4z",
  "M230,274.6c-1.2,0-1.7-1.1-1.1-2.1l33.8-43.8c0.8-1,2-1.9,3.1-1.9h18.1c1.6,0,2.1,1.3,0.9,2.8l-32.5,42.1 c-1.2,1.6-2.9,2.8-4.5,2.8H230z",
  "M181.3,274.6c-1.2,0-1.7-1.1-1.1-2.1l33.8-43.8c0.8-1,2-1.9,3.1-1.9h39.7c1.6,0,2.1,1.3,0.9,2.8l-32.5,42.1 c-1.2,1.6-2.9,2.8-4.5,2.8H181.3z"];


export function AmgLogo({ title = "Mercedes-AMG", ...props }: LogoProps) {
  return (
    <svg viewBox="179.6 226.8 482.3 47.9" fill="currentColor" role="img" aria-label={title} {...props}>
      {AMG_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function MercedesStar({ title = "Mercedes-Benz", ...props }: LogoProps) {
  return (
    <svg viewBox={STAR_VIEWBOX} fill="currentColor" role="img" aria-label={title} {...props}>
      {STAR_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * Yıldız + "Mercedes-Benz" kilidi (canlı ekran başlığı). Yazı Corpo A ile dizilir; yıldız yazı yüksekliğinin
 * yaklaşık 2 katı, aralarında yıldız genişliğinin yarısı kadar boşluk.
 */
export function MercedesBenzLockup({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.55em] text-fg ${className ?? ""}`}>
      <MercedesStar className="size-[2.1em]" aria-hidden title="" />
      <span className="font-wordmark text-[1.25em] leading-none tracking-[0.01em]">Mercedes-Benz</span>
    </span>
  );
}
