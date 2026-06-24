import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "chatcommerce-africa-super-secret-key-2024"
);

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
  return new SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
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

export function getSessionFromHeader(
  request: Request
): { userId: string; companyId: string; role: string } | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  // Synchronous decode not possible with jose, but for API routes we'll verify async
  return null;
}