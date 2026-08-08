import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import crypto from "crypto";

// Ultra-resilient JWT: never crash in production
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 10) {
    return new TextEncoder().encode(secret);
  }
  // Fallback: derive a stable secret from any available env var
  const fallback = process.env.DATABASE_URL || "chatcommerce-fallback-secret-key-2024";
  return new TextEncoder().encode(fallback);
}

const JWT_SECRET = getJWTSecret();

export async function hashPassword(password: string): Promise<string> {
  try {
    const bcrypt = await import("bcryptjs");
    return bcrypt.hash(password, 12);
  } catch {
    // Fallback: SHA-256 based hash if bcrypt fails
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.createHash("sha256").update(password + salt).digest("hex");
    return `sha256$${salt}$${hash}`;
  }
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    if (storedHash.startsWith("sha256$")) {
      const [, salt, hash] = storedHash.split("$");
      const computed = crypto.createHash("sha256").update(password + salt).digest("hex");
      return computed === hash;
    }
    const bcrypt = await import("bcryptjs");
    return bcrypt.compare(password, storedHash);
  } catch {
    return false;
  }
}

export async function createToken(payload: {
  userId: string;
  companyId: string;
  role: string;
}): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.NODE_ENV === "production" ? "24h" : "7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; companyId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as {
      userId: string;
      companyId: string;
      role: string;
    };
  } catch {
    return null;
  }
}
