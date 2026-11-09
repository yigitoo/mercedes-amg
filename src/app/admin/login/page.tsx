import type { Metadata } from "next";

import { AmgLogo, MercedesBenzLockup } from "@/components/brand/logos";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin girişi" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next } = await searchParams;
  return (
    <main className="checkered grid min-h-[100dvh] place-items-center p-4 [--checkered-opacity:0.04]">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-8">
        <div className="flex items-center justify-between gap-4">
          <MercedesBenzLockup className="text-sm" />
          <AmgLogo className="h-3 w-auto" />
        </div>
        <h1 className="mt-8 font-title text-2xl font-bold">Etkinlik paneli</h1>
        <p className="mt-1 text-sm text-muted">Sürücü atama ve raporlar için ekip şifresini girin.</p>
        <LoginForm next={typeof next === "string" ? next : "/admin"} />
      </div>
    </main>
  );
}
