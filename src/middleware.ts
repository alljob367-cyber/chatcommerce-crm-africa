import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes publiques (pas besoin de token)
const PUBLIC_PATHS = ["/api/auth", "/api/seed", "/api/cron"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Autoriser les routes publiques
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Autoriser les fichiers statiques et pages Next.js
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/hero-bg") ||
    pathname.startsWith("/phone-mockup") ||
    pathname === "/" ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/robots")
  ) {
    return NextResponse.next();
  }

  // Vérifier l'auth pour toutes les routes /api/*
  if (pathname.startsWith("/api/")) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Non autorise - Token requis" },
        { status: 401 }
      );
    }

    // Vérification basique du format JWT (3 parties séparées par .)
    const parts = token.split(".");
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: "Token invalide" },
        { status: 401 }
      );
    }

    // Vérification de la signature JWT (HS256 avec jose)
    try {
      const secret = process.env.JWT_SECRET;
      let jwtSecret: Uint8Array;
      if (secret && secret.length > 10) {
        jwtSecret = new TextEncoder().encode(secret);
      } else {
        // Development-only fallback — never use DATABASE_URL as JWT secret
        jwtSecret = new TextEncoder().encode("chatcommerce-dev-only-fallback-key-2024");
      }

      const { jwtVerify } = await import("jose");
      await jwtVerify(token, jwtSecret);
    } catch {
      return NextResponse.json(
        { error: "Token expire ou invalide" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Toutes les routes API sauf les publiques
    "/api/((?!auth|seed).*)",
  ],
};
