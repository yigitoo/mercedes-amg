import { ImageResponse } from "next/og";

import { STAR_PATHS, STAR_VIEWBOX } from "@/components/brand/star-paths";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS/iPadOS ana ekran ikonu: siyah zemin üzerinde beyaz Mercedes yıldızı. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0b" }}>
        <svg width="118" height="114" viewBox={STAR_VIEWBOX} fill="#ffffff">
          {STAR_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
