import crypto from "crypto";

// ============================================================
// SECURITY UTILITIES — ChatCommerce Africa
// ============================================================

// Sanitize string: remove HTML/script tags, trim
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

// Generic error handler: hide internal details in production
export function handleError(error: unknown): { error: string; status: number } {
  const isDev = process.env.NODE_ENV === "development";

  if (error instanceof Error) {
    // Log the real error server-side
    console.error(`[API Error] ${error.message}`, error.stack);

    // Return generic message in production
    return {
      error: isDev ? error.message : "Une erreur interne est survenue",
      status: 500,
    };
  }

  console.error("[API Error] Unknown error", error);
  return {
    error: "Une erreur interne est survenue",
    status: 500,
  };
}

// Simple in-memory rate limiter (per IP + endpoint)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
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
    return {
      allowed: false,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// Clean up old rate limit entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }, 5 * 60 * 1000);
}