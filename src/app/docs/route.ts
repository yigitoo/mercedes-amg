import { ApiReference } from "@scalar/nextjs-api-reference";

/**
 * GET /docs — Scalar API referansı, Mercedes-AMG kimliğiyle.
 *
 * Scalar arayüzü CDN'den yüklenir; sürüm sabitlenmiştir (varsayılan "en son" yerine), etkinlik günü habersiz
 * bir güncelleme sayfayı değiştirmesin. Güncellemek için yalnız SCALAR_VERSION değişir.
 */
const SCALAR_VERSION = "1.76.0";

/** Marka token'ları (src/app/globals.css ile aynı değerler) Scalar'ın CSS değişkenlerine çevrilir. */
const MERCEDES_THEME = `
@font-face { font-family: "MB Corpo S Title"; src: url("/brand/fonts/MBCorpoSTitle-Regular.otf"); font-weight: 400; font-display: swap; }
@font-face { font-family: "MB Corpo S Title"; src: url("/brand/fonts/MBCorpoSTitle-Bold.otf"); font-weight: 700; font-display: swap; }
@font-face { font-family: "MB Corpo S Text"; src: url("/brand/fonts/MBCorpoSText-Regular.otf"); font-weight: 400; font-display: swap; }
@font-face { font-family: "MB Corpo S Text"; src: url("/brand/fonts/MBCorpoSText-Bold.otf"); font-weight: 700; font-display: swap; }

:root {
  --scalar-font: "MB Corpo S Text", sans-serif;
  --scalar-font-code: ui-monospace, "SF Mono", Menlo, monospace;
  --scalar-radius: 6px;
  --scalar-radius-lg: 12px;
  --scalar-radius-xl: 12px;
}

.dark-mode {
  --scalar-background-1: #0a0a0b;
  --scalar-background-2: #111113;
  --scalar-background-3: #18181b;
  --scalar-background-accent: rgba(232, 17, 45, 0.12);
  --scalar-color-1: #f3f3f4;
  --scalar-color-2: #bdbdc3;
  --scalar-color-3: #8e8e96;
  --scalar-color-accent: #ff4155;
  --scalar-border-color: #26262a;
  --scalar-button-1: #e8112d;
  --scalar-button-1-hover: #ff2a44;
  --scalar-button-1-color: #ffffff;
  --scalar-color-green: #f3f3f4;
  --scalar-color-blue: #bdbdc3;
  --scalar-color-orange: #ff8a3d;
  --scalar-color-yellow: #ffd23f;
  --scalar-color-red: #ff4155;
  --scalar-color-purple: #bdbdc3;

  --scalar-sidebar-background-1: #111113;
  --scalar-sidebar-color-1: #f3f3f4;
  --scalar-sidebar-color-2: #8e8e96;
  --scalar-sidebar-border-color: #26262a;
  --scalar-sidebar-item-hover-background: #18181b;
  --scalar-sidebar-item-active-background: rgba(232, 17, 45, 0.14);
  --scalar-sidebar-color-active: #ffffff;
  --scalar-sidebar-search-background: #0a0a0b;
  --scalar-sidebar-search-border-color: #3a3a40;
}

/* Başlıklar Corpo S Title ile */
h1, h2, h3, .section-header, .section-header-label, .introduction-section h1 {
  font-family: "MB Corpo S Title", var(--scalar-font) !important;
  letter-spacing: -0.01em;
}

/* Giriş bölümündeki AMG logosu */
.markdown img[alt="Mercedes-AMG"] { height: 34px; width: auto; margin: 4px 0 16px; }

/* Sol üst: Mercedes yıldızı + AMG kilidi; altında AMG kırmızısı çizgi (görsel içerik alanında, çizgi kenarlıkta) */
.sidebar::before, .t-doc__sidebar::before {
  content: "";
  display: block;
  flex-shrink: 0;
  height: 28px;
  margin: 22px 16px 14px;
  padding-bottom: 16px;
  box-sizing: content-box;
  border-bottom: 2px solid #e8112d;
  background: url("/brand/logos/mercedes-amg-lockup.svg") left top / contain no-repeat;
  background-origin: content-box;
  background-clip: content-box;
}

/* Scalar'ın kendi tanıtım bağlantıları gizli: sayfa yalnız AMG Pulse'ı anlatır */
a[href*="scalar.com"], .darklight-reference-promo, [class*="powered-by"] { display: none !important; }

/* HTTP metot rozetleri: POST kırmızı, GET beyaz */
.sidebar-heading-type--post, .request-method--post { color: #ff4155 !important; }
`;

export const GET = ApiReference({
  url: "/api/openapi.json",
  pageTitle: "API · Mercedes-AMG Araba Lansmanı",
  // Özel CDN adresi klasik <script> olarak yüklenir ve global `Scalar` bekler: UMD paketi (esm.js değil).
  cdn: `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}/dist/browser/standalone.js`,
  theme: "none",
  forceDarkModeState: "dark",
  hideDarkModeToggle: true,
  withDefaultFonts: false,
  favicon: "/icon.svg",
  customCss: MERCEDES_THEME,
  defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
  // Scalar'ın geliştirici menüsü, yapay zekâ sohbeti ve SDK önerileri kapalı.
  showDeveloperTools: "never",
  agent: { disabled: true },
  documentDownloadType: "json",
});
