import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Etkinlik ekranı her istekte taze veri okur; önbellek katmanı bilinçli olarak kapalı (bkz. docs/ARCHITECTURE.md).
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
