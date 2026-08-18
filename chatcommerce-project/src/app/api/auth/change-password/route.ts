import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, hashPassword, verifyPassword } from "@/lib/auth";
import { isValidPassword, handleError } from "@/lib/security";

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: Request) {
  try {
    const payload = await authenticate(request);
    if (!payload) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Mot de passe actuel et nouveau mot de passe requis" },
        { status: 400 }
      );
    }

    // Guard for hardcoded admin account (not in DB)
    const HARDCODED_IDS = ["admin-hardcoded-001"];
    if (HARDCODED_IDS.includes(payload.userId)) {
      const HARDCODED_PASSWORDS: Record<string, string> = {
        "admin-hardcoded-001": "Admin@2024",
      };
      const storedPassword = HARDCODED_PASSWORDS[payload.userId];
      if (currentPassword !== storedPassword) {
        return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
      }
      if (!isValidPassword(newPassword)) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir au moins 8 caracteres avec des majuscules, minuscules et chiffres" },
          { status: 400 }
        );
      }
      // Hardcoded accounts can't persist password changes
      return NextResponse.json({ message: "Mot de passe du compte admin ne peut pas etre modifie" });
    }

    // Fetch user with password hash
    const user = await db.user.findFirst({
      where: { id: payload.userId, companyId: payload.companyId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouve" }, { status: 404 });
    }

    // Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
    }

    // Validate new password complexity (8+ chars, upper + lower + digit)
    if (!isValidPassword(newPassword)) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caracteres avec des majuscules, minuscules et chiffres" },
        { status: 400 }
      );
    }

    // Hash and save new password
    const newHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: payload.userId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({
      message: "Mot de passe modifie avec succes",
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
