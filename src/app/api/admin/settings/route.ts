import { validateSettings } from "@/domain/validation";
import { adminJsonRoute, str, ValidationFailure } from "@/server/admin-api";
import { getEventSettings, updateEventSettings } from "@/server/services/settings-service";

/**
 * PUT /api/admin/settings — canlı ekran ayarları. Verilmeyen alan mevcut değerini korur.
 *   { "title"?: "...", "subtitle"?: "...", "tagline"?: "...", "gauge"?: "bar" | "dial" }
 */
export async function PUT(request: Request) {
  return adminJsonRoute(request, "update-settings", async (body) => {
    const current = await getEventSettings();
    const pick = (key: keyof typeof current) => (typeof body[key] === "string" ? str(body, key) : current[key]);
    const settings = validateSettings({ title: pick("title"), subtitle: pick("subtitle"), tagline: pick("tagline"), gauge: pick("gauge") });
    if (!settings.ok) throw new ValidationFailure(settings.errors);
    await updateEventSettings(settings.value);
    return settings.value;
  });
}
