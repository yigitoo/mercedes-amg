import { cn } from "@/lib/cn";

/** Form geneli sonuç mesajı (alan dışı hatalar). Ekran okuyucuya canlı bölge olarak duyurulur. */
export function FormMessage({ message, tone = "error" }: { message?: string; tone?: "error" | "info" }) {
  if (!message) return null;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-sm border px-3 py-2 text-sm", tone === "error" ? "border-amg/60 text-amg-text" : "border-line-strong text-soft")}>
      {message}
    </p>
  );
}
