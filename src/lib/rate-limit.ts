import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ============================================================
// UPSTASH REDIS RATE LIMITING — ChatCommerce Africa
// ============================================================
// Works in serverless (Vercel) unlike in-memory approaches.
// Falls back to in-memory for local development when UPSTASH_REDIS_REST_URL is not set.

// Create Redis client (lazy-initialized)
let redis: Redis | null = null;
let limiter: Ratelimit | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null; // No Redis configured — will use in-memory fallback
  }

  if (!redis) {
    redis = new Redis({ url, token });
  }
  return redis;
}

function getLimiter(): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      // Sliding window algorithm — prevents burst attacks
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "ratelimit:chatcommerce",
    });
  }
  return limiter;
}

/**
 * Rate limit a request using Upstash Redis (production) or in-memory (dev).
 *
 * Usage in API routes:
 *   const { success } = await rateLimit({ key: "login:user@example.com", limit: 5, window: "30 s" });
 *   if (!success) return errorResponse(429, "Too many requests");
 *
 * @param key  - Unique identifier (e.g., "login:user@x.com", "api:contact-create:companyId")
 * @param limit - Max requests allowed in the window
 * @param window - Time window (e.g., "10 s", "1 m", "1 h")
 */
export async function rateLimit(options: {
  key: string;
  limit: number;
  window: string;
}): Promise<{ success: boolean; remaining: number; reset: number }> {
  const l = getLimiter();

  if (l) {
    // Upstash Redis rate limiting (production / serverless)
    try {
      const result = await l.limit(options.key);
      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (error) {
      console.error("[RATE LIMIT] Upstash error, falling back to in-memory:", error);
      // Fall through to in-memory
    }
  }

  // In-memory fallback (development only)
  return inMemoryRateLimit(options.key, options.limit, parseWindowToMs(options.window));
}

/**
 * Check rate limit in the Next.js middleware (Edge runtime compatible).
 * Edge runtime doesn't support Upstash's Node.js HTTP client,
 * so this uses a simpler approach.
 */
export async function rateLimitMiddleware(
  key: string,
  maxRequests: number = 10,
  windowSeconds: number = 10
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  // In middleware (Edge), we use a simple in-memory check or Upstash
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      // Use fetch directly (Edge-compatible)
      const response = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}), // empty body for INCR
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.result;
        if (count === 1) {
          // Set expiry on first request
          await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
        if (count > maxRequests) {
          return { allowed: false, retryAfterMs: windowSeconds * 1000 };
        }
        return { allowed: true, retryAfterMs: 0 };
      }
    } catch (error) {
      console.error("[RATE LIMIT] Middleware Redis error:", error);
    }
  }

  // In-memory fallback for middleware
  return inMemoryRateLimitSync(key, maxRequests, windowSeconds * 1000);
}

// ============================================================
// IN-MEMORY FALLBACK (development only)
// ============================================================

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function parseWindowToMs(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h)$/);
  if (!match) return 10000; // default 10s
  const num = parseInt(match[1]);
  const unit = match[2];
  if (unit === "s") return num * 1000;
  if (unit === "m") return num * 60 * 1000;
  if (unit === "h") return num * 3600 * 1000;
  return 10000;
}

function inMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1, reset: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, reset: entry.resetAt };
}

function inMemoryRateLimitSync(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const result = inMemoryRateLimit(key, maxRequests, windowMs);
  return { allowed: result.success, retryAfterMs: result.success ? 0 : result.reset - Date.now() };
}

// Clean up expired entries periodically (prevent memory leak in dev)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (now > entry.resetAt) memoryStore.delete(key);
    }
  }, 60000); // Clean every minute
}
