import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import crypto from "crypto";

// JWT secret: in production, JWT_SECRET must be set (never use DATABASE_URL)
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 10) {
    return new TextEncoder().encode(secret);
  }
  // Production: REJECT if no JWT_SECRET — never use fallback in prod
  if (process.env.NODE_ENV === "production") {
    throw new Error("[SECURITY] JWT_SECRET environment variable is required in production.");
  }
  // Development-only fallback
  return new TextEncoder().encode("chatcommerce-dev-only-fallback-key-2024");
}

const JWT_SECRET = getJWTSecret();

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 12);
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
