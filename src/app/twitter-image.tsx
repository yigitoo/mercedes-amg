import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { AMG_PATHS } from "@/components/brand/logos";
import { STAR_PATHS, STAR_VIEWBOX } from "@/components/brand/star-paths";

/**
 * Link paylaşıldığında görünen kart (WhatsApp, Slack, iMessage…). Derleme anında bir kez üretilir.
 * Canlı ekranın lansman açılışının son karesi: Mercedes yıldızı, "Lansmana hoş geldiniz", dolmuş AMG çubuğu
 * ve 0-100 sayacı. Yalnız marka varlıkları: MB Corpo fontları, resmi yıldız ve AMG path'leri, AMG kırmızısı.
 */
export const alt = "Mercedes-AMG Araba Lansmanı: Lansmana hoş geldiniz";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0A0A0B";
const WHITE = "#F3F3F4";
const MUTED = "#8E8E96";
const RED = "#E8112D";

export default async function TwitterImage() {
  const font = (file: string) => readFile(join(process.cwd(), "brand/fonts", file));
  const [extraBold, light, text, corpoA] = await Promise.all([
    font("MBCorpoSTitle-ExtraBold.otf"),
    font("MBCorpoSTitle-Light.otf"),
    font("MBCorpoSText-Regular.otf"),
    font("MBCorpoATitleCond-Regular.otf"),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: INK, color: WHITE, fontFamily: "Corpo Text" }}>
        <svg width="112" height="108" viewBox={STAR_VIEWBOX} fill={WHITE}>
          {STAR_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        <span style={{ marginTop: 26, fontFamily: "Corpo A", fontSize: 46 }}>Mercedes-Benz</span>
        <span style={{ marginTop: 18, fontFamily: "Corpo Title", fontWeight: 300, fontSize: 26, letterSpacing: 8, color: "#BDBDC3" }}>LANSMANA HOŞ GELDİNİZ</span>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 34, marginTop: 56 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <svg width="380" height="38" viewBox="179.6 226.8 482.3 47.9" fill={WHITE}>
              {AMG_PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            <div style={{ marginTop: 16, height: 3, width: 380, background: RED }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ display: "flex", alignItems: "baseline", fontFamily: "Corpo Title", fontWeight: 800, fontSize: 56, lineHeight: 1 }}>
              100<span style={{ marginLeft: 6, fontFamily: "Corpo Text", fontWeight: 400, fontSize: 18, color: MUTED }}>km/s</span>
            </span>
            <span style={{ marginTop: 8, fontSize: 14, letterSpacing: 4, color: MUTED }}>0-100 · 2,7 SN</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Corpo Title", data: extraBold, weight: 800, style: "normal" },
        { name: "Corpo Title", data: light, weight: 300, style: "normal" },
        { name: "Corpo Text", data: text, weight: 400, style: "normal" },
        { name: "Corpo A", data: corpoA, weight: 400, style: "normal" },
      ],
    },
  );
}
