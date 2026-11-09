import localFont from "next/font/local";

/**
 * Mercedes-Benz kurumsal fontları (brand/fonts). Lisanslıdır; repo dışına dağıtmayın.
 *   Corpo S Title  → başlıklar, büyük rakamlar, plaka
 *   Corpo S Text   → gövde metni, form, tablo
 *   Corpo A Title Cond → yalnız "Mercedes-Benz" yazısı (serif; arayüz metninde kullanılmaz)
 */

/** adjustFontFallback: font yüklenene kadar oluşan yedeğin ölçüleri Corpo'ya yaklaştırılır (kayma olmasın). */
export const corpoTitle = localFont({
  variable: "--font-corpo-title",
  display: "swap",
  fallback: [],
  src: [
    { path: "../../brand/fonts/MBCorpoSTitle-Light.otf", weight: "300", style: "normal" },
    { path: "../../brand/fonts/MBCorpoSTitle-Regular.otf", weight: "400", style: "normal" },
    { path: "../../brand/fonts/MBCorpoSTitle-Bold.otf", weight: "700", style: "normal" },
    { path: "../../brand/fonts/MBCorpoSTitle-ExtraBold.otf", weight: "800", style: "normal" },
  ],
});

export const corpoText = localFont({
  variable: "--font-corpo-text",
  display: "swap",
  fallback: [],
  src: [
    { path: "../../brand/fonts/MBCorpoSText-Light.otf", weight: "300", style: "normal" },
    { path: "../../brand/fonts/MBCorpoSText-Regular.otf", weight: "400", style: "normal" },
    { path: "../../brand/fonts/MBCorpoSText-Bold.otf", weight: "700", style: "normal" },
  ],
});

/** Corpo A, Mercedes'in serif kurumsal ailesi: yalnız "Mercedes-Benz" yazısı için. */
export const corpoA = localFont({
  variable: "--font-corpo-a",
  display: "swap",
  fallback: [],
  src: [{ path: "../../brand/fonts/MBCorpoATitleCond-Regular.otf", weight: "400", style: "normal" }],
});

export const fontVariables = [corpoTitle.variable, corpoText.variable, corpoA.variable].join(" ");
