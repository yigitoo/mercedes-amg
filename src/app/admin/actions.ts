"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { validateDriver, validateSettings, validateVehicle } from "@/domain/validation";
import { ADMIN_COOKIE, checkAdminPassword, createAdminToken, requireAdmin } from "@/server/auth";
import { env } from "@/server/env";
import { DomainError } from "@/server/errors";
import { recordAudit } from "@/server/services/audit-service";
import { assignDriver, endActiveSession, renameDriver, updateVehicle } from "@/server/services/fleet-service";
import { updateEventSettings } from "@/server/services/settings-service";
import { fromTimeOfDay } from "@/lib/format";

/**
 * Admin server action'ları. Her biri aynı akışı izler:
 *   yetki → girdiyi doğrula → servisi çağır → sayfayı tazele → `ActionState` dön.
 * Formlar `useActionState` ile bu durumu okur; hata fırlatılmaz, alan altına yazılır.
 */

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string | undefined>;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Servis hatalarını forma çevirir; beklenmeyen hatayı loglayıp genel mesaj verir. */
async function run(scope: string, work: () => Promise<void>): Promise<ActionState> {
  try {
    await work();
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError) {
      return error.field ? { errors: { [error.field]: error.message } } : { message: error.message };
    }
    console.error(`[admin:${scope}]`, error);
    return { message: "İşlem tamamlanamadı. Bağlantıyı kontrol edip tekrar deneyin." };
  }
}

// ── Oturum ─────────────────────────────────────────────────────────────────

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  const password = text(form, "password");
  if (!password) return { errors: { password: "Şifre gerekli." } };
  if (!(await checkAdminPassword(password))) {
    await recordAudit({ action: "admin.login_failed", summary: "Hatalı şifreyle giriş denendi" });
    return { errors: { password: "Şifre hatalı." } };
  }
  await recordAudit({ action: "admin.login", summary: "Panele giriş yapıldı" });

  const token = await createAdminToken();
  (await cookies()).set(ADMIN_COOKIE, token.value, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    expires: token.expires,
  });

  const next = text(form, "next");
  // Yalnız site içi yollara dön; açık yönlendirme (open redirect) olmasın.
  const safe = (next.startsWith("/admin") || next === "/docs") && !next.startsWith("//");
  redirect(safe ? next : "/admin");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  await recordAudit({ action: "admin.logout", summary: "Panelden çıkış yapıldı" });
  redirect("/admin/login");
}

// ── Filo ───────────────────────────────────────────────────────────────────

export async function assignDriverAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const driver = validateDriver({ firstName: text(form, "firstName"), lastName: text(form, "lastName") });
  if (!driver.ok) return { errors: driver.errors };

  const startedAtRaw = text(form, "startedAt");
  const startedAt = startedAtRaw ? fromTimeOfDay(startedAtRaw, Date.now()) : Date.now();
  if (startedAt == null) return { errors: { startedAt: "Geçerli bir saat seçin." } };

  return run("assign-driver", () => assignDriver(text(form, "vehicleId"), driver.value, startedAt).then(() => undefined));
}

export async function endSessionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  return run("end-session", () => endActiveSession(text(form, "vehicleId")));
}

export async function updateVehicleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const input = validateVehicle({ plate: text(form, "plate"), model: text(form, "model") });
  if (!input.ok) return { errors: input.errors };
  return run("update-vehicle", () => updateVehicle(text(form, "vehicleId"), input.value));
}

export async function renameDriverAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const driver = validateDriver({ firstName: text(form, "firstName"), lastName: text(form, "lastName") });
  if (!driver.ok) return { errors: driver.errors };
  return run("rename-driver", () => renameDriver(text(form, "sessionId"), driver.value));
}

// ── Canlı ekran ────────────────────────────────────────────────────────────

export async function updateSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const settings = validateSettings({
    title: text(form, "title"),
    subtitle: text(form, "subtitle"),
    tagline: text(form, "tagline"),
    gauge: text(form, "gauge"),
  });
  if (!settings.ok) return { errors: settings.errors };
  return run("update-settings", () => updateEventSettings(settings.value));
}
