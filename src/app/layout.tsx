import type { Metadata, Viewport } from "next";

import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AMG Pulse", template: "%s · AMG Pulse" },
  description: "Mercedes-AMG sürüş etkinliği için canlı nabız takibi.",
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
