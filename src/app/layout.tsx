import type { Metadata, Viewport } from "next";

import { fontVariables } from "./fonts";
import "./globals.css";

/** Paylaşım kartlarındaki mutlak adresler için: Vercel'de üretim alan adı, yerelde localhost. */
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

const description = "Mercedes-AMG sürüş etkinliği: 8 aracın sürücü nabzı anlık, canlı ekranda.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Mercedes-AMG Canlı Nabız Takibi", template: "%s · Mercedes-AMG" },
  description,
  applicationName: "AMG Pulse",
  openGraph: { type: "website", locale: "tr_TR", siteName: "Mercedes-AMG", title: "Mercedes-AMG Canlı Nabız Takibi", description },
  twitter: { card: "summary_large_image", title: "Mercedes-AMG Canlı Nabız Takibi", description },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${fontVariables} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
