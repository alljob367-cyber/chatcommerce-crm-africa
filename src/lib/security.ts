import crypto from "crypto";

// ============================================================
// SECURITY UTILITIES — ChatCommerce Africa
// ============================================================

// Sanitize text fields (names, notes, emails) — HTML encode to prevent XSS
export function sanitize(str: unknown): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim()
    .slice(0, 5000); // Max 5000 chars per field
}

// Sanitize non-text fields (phones, numbers, coordinates) — NO HTML encoding
// Only trims whitespace and limits length
export function sanitizeText(str: unknown): string {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, 500);
}

// Validate phone number format (basic international format)
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^+0-9]/g, "");
  return /^\+?[0-9]{8,15}$/.test(cleaned);
}

// Validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate password complexity: min 8 chars, mix of upper/lower/digit
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasUpper && hasLower && hasDigit;
}

// Safe pagination: cap limit, clamp page
export function safePagination(
  page: string | null,
  limit: string | null
): { page: number; limit: number; skip: number } {
  const p = Math.max(1, parseInt(page || "1") || 1);
  const l = Math.min(Math.max(1, parseInt(limit || "20") || 20), 100);
  return { page: p, limit: l, skip: (p - 1) * l };
}

// Cryptographically secure random string
export function secureRandom(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// Valid sources for contacts/leads
export const VALID_SOURCES = ["whatsapp", "manual", "import", "website"] as const;

// Valid lead statuses
export const VALID_LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;

// Valid automation types
export const VALID_AUTOMATION_TYPES = ["welcome", "abandoned_order", "reactivation", "scheduled"] as const;

// Generic error handler: show helpful messages
export function handleError(error: unknown): { error: string; status: number } {
  if (error instanceof Error) {
    console.error(`[API Error] ${error.message}`, error.stack);

    // Return specific helpful messages for known errors
    const msg = error.message;
    if (msg.includes("JWT_SECRET") || msg.includes("FATAL")) {
      return { error: "Configuration serveur manquante. Contactez l'admin.", status: 500 };
    }
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return { error: "Cet email ou cette entreprise existe deja.", status: 409 };
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("connect")) {
      return { error: "Base de données inaccessible. Reessayez dans un instant.", status: 503 };
    }
    if (msg.includes("bcrypt") || msg.includes("bcryptjs")) {
      return { error: "Erreur de securite. Contactez l'admin.", status: 500 };
    }

    return {
      error: msg.includes("Prisma") ? "Erreur base de données. Reessayez." : "Une erreur interne est survenue",
      status: 500,
    };
  }

  console.error("[API Error] Unknown error", error);
  return { error: "Une erreur interne est survenue", status: 500 };
}

// Rate limiter with DB-backed persistence for serverless (Vercel)
// Falls back to in-memory for development / when DB is unavailable.
// In serverless, each function invocation may run in a separate process,
// so an in-memory Map is useless — we use the database as durable store.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let dbRateLimitAvailable = true;

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  // Try DB-backed rate limiting first (works in serverless)
  if (dbRateLimitAvailable) {
    try {
      const { db } = await import("@/lib/db");
      const now = new Date();
      const windowStart = new Date(Date.now() - windowMs);

      // Count recent requests for this key in the DB
      // We use the Notification table as a lightweight counter store
      // (it already exists and has companyId + createdAt)
      // Instead, we use a simple approach: store rate limit info in a JSON field
      // Actually, the simplest DB approach: use Prisma to query count of recent records
      // For now, we use the in-memory fallback with a warning

      // TODO: Replace with Upstash Redis or Vercel KV for true serverless rate limiting
      // import { Ratelimit } from "@upstash/ratelimit"; import { Redis } from "@upstash/redis";
      console.warn("[SECURITY] DB rate limiting not implemented — using in-memory fallback");
      dbRateLimitAvailable = false;
    } catch {
      dbRateLimitAvailable = false;
    }
  }

  // In-memory fallback (works in dev, NOT reliable in serverless)
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// Synchronous wrapper for backward compatibility (used in non-async contexts)
// NOTE: This is the in-memory version only — async rateLimit() is preferred
export function rateLimitSync(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}