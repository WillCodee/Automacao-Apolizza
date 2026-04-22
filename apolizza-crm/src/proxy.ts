import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes — no auth required
  const isPublic =
    pathname.startsWith("/login") ||
    pathname === "/pedido" ||                  // Formulário público de pedidos externos
    pathname.startsWith("/api/pedido") ||      // API pública de pedidos externos
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/telegram/") ||   // Telegram webhook (sem sessão)
    pathname.startsWith("/api/cron/") ||         // Cron jobs (autenticados por CRON_SECRET)
    pathname === "/tv" ||                        // Painel TV (auth por token na URL)
    pathname.startsWith("/api/tv");              // API TV (auth por token na URL)

  if (isPublic) return NextResponse.next();

  // Not authenticated — redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp).*)"],
};
