// ============================================================
// DIAGNOSTIC & SETUP SCRIPT
// Vérifie les agents Telegram, active l'IA Mistral, configure webhooks
// Usage: MISTRAL_API_KEY=your_key npx tsx scripts/diagnose-agents.ts
// ============================================================

import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL non définie");
  process.exit(1);
}

const MISTRAL_KEY = process.env.MISTRAL_API_KEY || "";
if (!MISTRAL_KEY) {
  console.error("MISTRAL_API_KEY non définie");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
const APP_URL = "https://alljob367-cyber-chatcommerce-crm-af.vercel.app";

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CHATCOMMERCE CRM — DIAGNOSTIC AGENTS TELEGRAM");
  console.log("═══════════════════════════════════════════════════\n");

  const agents = await prisma.telegramAgent.findMany({
    include: {
      company: { select: { name: true, plan: true } },
      services: { where: { isActive: true }, select: { id: true, name: true } },
      _count: { select: { bookings: true } },
    },
  });

  console.log(`🤖 Agents Telegram: ${agents.length}\n`);

  for (const agent of agents) {
    console.log(`┌─ ${agent.name} (@${agent.botUsername || "N/A"})`);
    console.log(`│  Entreprise: ${agent.company.name}`);
    console.log(`│  Actif: ${agent.isActive ? "✅" : "❌"} | Token: ${agent.token ? "✅" : "❌"} | IA: ${agent.aiConfig ? "✅" : "❌"}`);
    console.log(`│  Services: ${agent.services.length} | Réservations: ${agent._count.bookings}`);
    console.log(`└──────────────────────────────\n`);
  }

  // Enable AI
  let enabled = 0;
  for (const agent of agents) {
    if (!agent.isActive) continue;
    let cfg: Record<string, unknown> = {};
    try { cfg = JSON.parse(agent.aiConfig || "{}"); } catch { /* overwrite */ }
    if (cfg.enabled === true) { console.log(`✅ ${agent.name} — déjà activé`); continue; }
    await prisma.telegramAgent.update({
      where: { id: agent.id },
      data: { aiConfig: JSON.stringify({ enabled: true, provider: "mistral", apiKey: MISTRAL_KEY, model: "mistral-small-latest", temperature: 0.7, maxTokens: 500 }) },
    });
    console.log(`🟢 ${agent.name} — IA Mistral activée`);
    enabled++;
  }
  console.log(`\n📊 ${enabled} agents activés`);

  // Test Mistral
  console.log("\n🧪 Test clé Mistral...");
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_KEY}` },
    body: JSON.stringify({ model: "mistral-small-latest", messages: [{ role: "user", content: "Bonjour" }], max_tokens: 20 }),
  });
  console.log(res.ok ? `✅ Clé valide` : `❌ Erreur: ${res.status}`);

  await prisma.$disconnect();
}

main().catch(console.error);
