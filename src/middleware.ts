import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes publiques qui ne nécessitent PAS de token (exclusion EXACTE)
const EXACT_PUBLIC_PATHS = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/phone/send-otp",
  "/api/auth/phone/verify-otp",
  "/api/chariow/webhook",
];
const PREFIX_PUBLIC_PATHS = ["/api/cron", "/api/telegram/webhook", "/api/seed"];

// Routes sensibles nécessitant un rate limiting strict
const RATE_LIMITED_PATHS: Array<{ path: string; limit: number; windowSec: number }> = [
  { path: "/api/auth/login", limit: 5, windowSec: 60 },       // 5 login attempts per minute
  { path: "/api/auth/register", limit: 3, windowSec: 60 },    // 3 registrations per minute
  { path: "/api/auth/phone/send-otp", limit: 5, windowSec: 60 }, // 5 OTP sends per minute
  { path: "/api/auth/phone/verify-otp", limit: 10, windowSec: 60 }, // 10 OTP verifies per minute
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Autoriser les fichiers statiques et assets Next.js
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/hero-bg") ||
    pathname.startsWith("/phone-mockup") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/sw.js") ||
    pathname === "/" ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/robots")
  ) {
    return NextResponse.next();
  }

  // 2. Autoriser les routes publiques par préfixe
  if (PREFIX_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // /api/seed-demo N'EST PAS public — seul /api/seed est public
    if (pathname.startsWith("/api/seed-demo")) {
      return NextResponse.json({ error: "Non autorise" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // 3. Autoriser les routes publiques par correspondance exacte
  if (EXACT_PUBLIC_PATHS.includes(pathname)) {
    // Rate limiting pour les routes publiques sensibles
    const rateLimitRule = RATE_LIMITED_PATHS.find((r) => r.path === pathname);
    if (rateLimitRule) {
      // Get client IP for rate limit key
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
      const rateLimitKey = `mw:${rateLimitRule.path}:${clientIp}`;

      // Dynamic import for rate limiting (Edge-compatible)
      try {
        const { rateLimitMiddleware } = await import("@/lib/rate-limit");
        const result = await rateLimitMiddleware(
          rateLimitKey,
          rateLimitRule.limit,
          rateLimitRule.windowSec
        );

        if (!result.allowed) {
          return NextResponse.json(
            {
              error: "Trop de requetes. Reessayez dans un instant.",
              retryAfter: Math.ceil(result.retryAfterMs / 1000),
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
                "X-RateLimit-Limit": String(rateLimitRule.limit),
              },
            }
          );
        }
      } catch {
        // Rate limiting unavailable — allow request (fail open)
      }
    }
    return NextResponse.next();
  }

  // 4. Vérifier l'auth pour toutes les autres routes /api/*
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
      if (secret && secret.length >= 32) {
        jwtSecret = new TextEncoder().encode(secret);
      } else if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Configuration serveur" }, { status: 500 });
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
    // Toutes les routes sauf les fichiers statiques internes
    "/((?!_next/static|_next/image|favicon|logo|hero-bg|phone-mockup|manifest|icons|sw\\.js).*)",
  ],
};
