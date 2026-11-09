import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { AMG_PATHS } from "@/components/brand/logos";
import { STAR_PATHS, STAR_VIEWBOX } from "@/components/brand/star-paths";

/**
 * Link paylaşıldığında görünen kart (WhatsApp, Slack, iMessage…). Derleme anında bir kez üretilir.
 * Kampanya görselinin dili: karbon desen zemin, kalın + ince büyük harf başlık ("TOO HARD / TO RESIST" gibi),
 * ürünün kendi devir kadranı. Yalnız marka varlıkları: MB Corpo fontları, resmi yıldız ve AMG path'leri, AMG Red.
 */
export const alt = "Mercedes-AMG Canlı Nabız Takibi: sürücünün kalp atışı devir kadranında, anlık";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RED = "#B21E23";
const WHITE = "#F3F3F4";
const ROOT = process.cwd();

// Kadran: canlı ekrandaki RevDial ile aynı geometri (250° tarama, 40-200 bpm, 160+ kırmızı).
const SWEEP = 250;
const START = 90 + (360 - SWEEP) / 2;
const ratio = (bpm: number) => (bpm - 40) / 160;
function point(angle: number, r: number, c: number) {
  const a = (angle * Math.PI) / 180;
  return `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
}
function arc(from: number, to: number, r: number, c: number) {
  const a0 = START + from * SWEEP;
  const a1 = START + to * SWEEP;
  return `M ${point(a0, r, c)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${point(a1, r, c)}`;
}

const BPM = 168;

export default async function TwitterImage() {
  const font = (file: string) => readFile(join(ROOT, "brand/fonts", file));
  const [extraBold, bold, light, text, corpoA, carbon] = await Promise.all([
    font("MBCorpoSTitle-ExtraBold.otf"),
    font("MBCorpoSTitle-Bold.otf"),
    font("MBCorpoSTitle-Light.otf"),
    font("MBCorpoSText-Regular.otf"),
    font("MBCorpoATitleCond-Regular.otf"),
    readFile(join(ROOT, "public/brand/patterns/carbon-white.png")),
  ]);
  const carbonSrc = `data:image/png;base64,${carbon.toString("base64")}`;

  const D = 440; // kadran kutusu
  const C = D / 2;
  const R = 182;
  const ticks = [40, 80, 120, 160, 200];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0a0a0b", color: WHITE, fontFamily: "Corpo Text" }}>
        {/* Karbon desen zemin + kenar karartması */}
        <img src={carbonSrc} width={1200} height={1260} style={{ position: "absolute", top: -300, left: 0, opacity: 0.07 }} alt="" />
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(circle at 78% 50%, rgba(10,10,11,0) 0%, rgba(10,10,11,0.55) 60%, rgba(10,10,11,0.92) 100%)" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", padding: "56px 64px 52px" }}>
          {/* Üst şerit: Mercedes kilidi + canlı rozeti */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <svg width="54" height="52" viewBox={STAR_VIEWBOX} fill={WHITE}>
                {STAR_PATHS.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              <span style={{ fontFamily: "Corpo A", fontSize: 34 }}>Mercedes-Benz</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${RED}`, padding: "8px 16px", fontSize: 20, letterSpacing: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 10, background: RED }} />
              CANLI
            </div>
          </div>

          {/* Orta: kampanya tipografisi + kadran */}
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Corpo Title", fontWeight: 800, fontSize: 96, lineHeight: 0.92, letterSpacing: -1 }}>CANLI NABIZ</span>
              <span style={{ fontFamily: "Corpo Title", fontWeight: 300, fontSize: 96, lineHeight: 1.02, letterSpacing: -1 }}>TAKİBİ</span>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 34 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ width: 9, height: 22, background: RED, transform: "skewX(-28deg)" }} />
                  ))}
                </div>
                <span style={{ fontSize: 24, letterSpacing: 3, color: "#BDBDC3" }}>8 ARAÇ · SÜRÜCÜNÜN KALP ATIŞI, ANLIK</span>
              </div>
            </div>

            <div style={{ display: "flex", position: "relative", width: D, height: D, marginRight: -24 }}>
              <svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{ position: "absolute", top: 0, left: 0 }}>
                <path d={arc(0, 1, R, C)} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={16} />
                <path d={arc(ratio(160), 1, R, C)} fill="none" stroke={RED} strokeOpacity={0.35} strokeWidth={16} />
                <path d={arc(0, ratio(BPM), R, C)} fill="none" stroke={RED} strokeWidth={16} />
                {ticks.map((t) => {
                  const a = START + ratio(t) * SWEEP;
                  const [x1, y1] = point(a, R + 14, C).split(" ");
                  const [x2, y2] = point(a, R + 26, C).split(" ");
                  return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t >= 160 ? RED : "#8E8E96"} strokeWidth={3} />;
                })}
                <path d={arc(ratio(BPM) - 0.004, ratio(BPM) + 0.004, R, C)} fill="none" stroke={WHITE} strokeWidth={30} />
              </svg>
              <div style={{ position: "absolute", top: 0, left: 0, width: D, height: D, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 20, letterSpacing: 5, color: "#FF5A5F" }}>KIRMIZI BÖLGE</span>
                <span style={{ fontFamily: "Corpo Title", fontWeight: 800, fontSize: 150, lineHeight: 0.95, letterSpacing: -5, color: WHITE }}>{BPM}</span>
                <span style={{ fontFamily: "Corpo Title", fontWeight: 700, fontSize: 22, letterSpacing: 6, color: "#8E8E96" }}>BPM</span>
              </div>
            </div>
          </div>

          {/* Alt: AMG */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <svg width="300" height="30" viewBox="179.6 226.8 482.3 47.9" fill={WHITE}>
              {AMG_PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            <span style={{ fontFamily: "Corpo Title", fontWeight: 700, fontSize: 22, letterSpacing: 6 }}>
              TOO HARD <span style={{ fontWeight: 300, marginLeft: 10 }}>TO RESIST</span>
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Corpo Title", data: extraBold, weight: 800, style: "normal" },
        { name: "Corpo Title", data: bold, weight: 700, style: "normal" },
        { name: "Corpo Title", data: light, weight: 300, style: "normal" },
        { name: "Corpo Text", data: text, weight: 400, style: "normal" },
        { name: "Corpo A", data: corpoA, weight: 400, style: "normal" },
      ],
    },
  );
}
