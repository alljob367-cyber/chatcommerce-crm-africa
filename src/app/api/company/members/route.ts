import { NextResponse } from "next/server";
import { db, ensureBootstrapped } from "@/lib/db";
import { verifyToken, hashPassword } from "@/lib/auth";
import { sanitize, isValidEmail, handleError, rateLimit, secureRandom } from "@/lib/security";
import { checkPlanLimit } from "@/lib/plan-limits";

// Hardcoded accounts fallback
const HARDCODED_ACCOUNTS: Record<string, { userId: string; companyId: string; role: string }> = {
  "admin-hardcoded-001": { userId: "admin-hardcoded-001", companyId: "company-admin-001", role: "company_admin" },
};

// Helper: authenticate
async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  const hardcoded = HARDCODED_ACCOUNTS[payload.userId];
  if (hardcoded) {
    return {
      user: { id: hardcoded.userId, name: "Admin", email: "", role: hardcoded.role },
      company: { id: hardcoded.companyId, maxAgents: 999 },
      payload,
    };
  }

  try {
    await ensureBootstrapped();
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { company: true },
    });
    if (!user || !user.company) return null;
    return { user, company: user.company, payload };
  } catch {
    return null;
  }
}

// GET /api/company/members — list team members
export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const members = await db.user.findMany({
      where: {
        companyId: auth.company.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ members });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// POST /api/company/members — invite a new member
export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }
    if (auth.user.role !== "company_admin" && auth.user.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse. Admin requis." }, { status: 403 });
    }

    // Check plan limits via checkPlanLimit (centralisée, pas le champ DB dénormalisé)
    let companyPlan = "starter";
    try {
      const userRecord = await db.user.findUnique({
        where: { id: auth.payload.userId },
        include: { company: true },
      });
      companyPlan = userRecord?.company?.plan || "starter";
    } catch { /* utilise starter par défaut */ }

    const agentCount = await db.user.count({
      where: { companyId: auth.company.id, isActive: true },
    });
    const limitError = await checkPlanLimit(companyPlan, "maxAgents", agentCount);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 403 });
    }

    const body = await request.json();
    const { action, email, role } = body;

    const rl = await rateLimit(`members:invite:${auth.payload.userId}`, 5, 60000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de requetes. Patientez." }, { status: 429 });
    }

    if (action === "invite") {
      if (!email || !role) {
        return NextResponse.json({ error: "Email et role requis" }, { status: 400 });
      }
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Format d'email invalide" }, { status: 400 });
      }
      const validRoles = ["company_admin", "agent", "viewer"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "Role invalide" }, { status: 400 });
      }

      // Check if already a member
      const existing = await db.user.findFirst({
        where: { email: email.toLowerCase(), companyId: auth.company.id },
      });
      if (existing) {
        return NextResponse.json({ error: "Cet email est deja membre de l'equipe" }, { status: 409 });
      }

      // Generate a temporary password
      const tempPassword = "CcA-" + secureRandom(10);
      const passwordHash = await hashPassword(tempPassword);

      const member = await db.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name: email.split("@")[0],
          role,
          emailVerified: true,
          isActive: true,
          companyId: auth.company.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Invitation envoyee a ${email}`,
        member,
      });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// DELETE /api/company/members — remove a member
export async function DELETE(request: Request) {
  try {
    const auth = await authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }
    if (auth.user.role !== "company_admin" && auth.user.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse. Admin requis." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("id");
    if (!memberId) {
      return NextResponse.json({ error: "ID membre requis" }, { status: 400 });
    }

    // Cannot delete self
    if (memberId === auth.user.id) {
      return NextResponse.json({ error: "Vous ne pouvez pas vous supprimer" }, { status: 400 });
    }

    // Verify member belongs to same company
    const member = await db.user.findFirst({
      where: { id: memberId, companyId: auth.company.id },
    });
    if (!member) {
      return NextResponse.json({ error: "Membre non trouve" }, { status: 404 });
    }

    // Soft-delete by deactivating
    await db.user.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: `${member.name} a ete retire de l'equipe`,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
