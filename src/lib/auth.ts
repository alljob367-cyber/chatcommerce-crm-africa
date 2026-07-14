import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";

// C1 FIX: No hardcoded fallback — fail hard if JWT_SECRET is missing
const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: JWT_SECRET environment variable is required in production");
}
const JWT_SECRET = new TextEncoder().encode(secret || "chatcommerce-dev-only-insecure-key");

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: {
  userId: string;
  companyId: string;
  role: string;
}): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    // M3 FIX: Reduced from 7d to 24h for production
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