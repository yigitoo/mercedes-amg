import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="checkered grid min-h-[100dvh] place-items-center p-6 text-center">
      <div>
        <p className="font-title text-6xl font-extrabold">404</p>
        <p className="mt-2 text-muted">Aradığınız sayfa ya da kayıt bulunamadı.</p>
        <Link href="/" className={buttonClasses({ variant: "secondary", className: "mt-6" })}>
          Canlı ekrana dön
        </Link>
      </div>
    </main>
  );
}
