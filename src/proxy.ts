import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE, verifyAdminToken } from "@/server/auth";

/**
 * /admin altındaki sayfaları korur. Giriş yoksa /admin/login'e yönlendirir, dönüş adresini saklar.
 * Asıl yetki kontrolü server action'larda da yapılır (requireAdmin); burası kullanıcı deneyimi içindir.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const authorized = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);
  if (authorized) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
