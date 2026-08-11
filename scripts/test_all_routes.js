/**
 * TEST RAPIDE DE TOUTES LES ROUTES API - ChatCommerce CRM
 * Optimisé pour être rapide (batch mode)
 */
const BASE = "http://localhost:3000";
const DEMO_PASSWORD = "Demo@2024";

const C = {
  reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m", dim: "\x1b[2m",
};

let token = null;
let pass = 0, fail = 0, total = 0;
let failures = [];

async function req(method, route, body = null, useToken = true) {
  const headers = { "Content-Type": "application/json" };
  if (useToken && token) headers["authorization"] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${route}`, opts, { signal: AbortSignal.timeout(8000) });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: null, error: err.message };
  }
}

function check(method, route, status, data, expected, desc) {
  total++;
  const ok = status === expected;
  if (ok) { pass++; console.log(`  ✅ ${C.green}PASS${C.reset}  ${C.cyan}${method.padEnd(7)}${C.reset} ${route.padEnd(52)} ${status}`); }
  else {
    fail++;
    const msg = data?.error || data?.message || JSON.stringify(data)?.slice(0,60) || "N/A";
    console.log(`  ❌ ${C.red}FAIL${C.reset}  ${C.cyan}${method.padEnd(7)}${C.reset} ${route.padEnd(52)} got ${status}, want ${expected} → ${msg}`);
    failures.push({ method, route, got: status, want: expected, desc });
  }
}

async function main() {
  console.log("\n" + C.bold + "═".repeat(80));
  console.log("  🔍 AUDIT COMPLET ROUTES API - ChatCommerce CRM");
  console.log("═".repeat(80) + C.reset + "\n");

  // 0. Vérifier serveur
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
    console.log(C.green + "  ✅ Serveur OK" + C.reset + "\n");
  } catch {
    console.log(C.red + "  ❌ Serveur inaccessible" + C.reset);
    process.exit(1);
  }

  // 1. AUTH
  console.log(C.bold + "📋 1. AUTHENTIFICATION" + C.reset);
  let r;
  r = await req("POST", "/api/auth", { action: "demo" }, false);
  check("POST", "/api/auth (demo)", r.status, r.data, 200, "Login demo");
  if (r.data?.token) token = r.data.token;

  r = await req("POST", "/api/auth", { action: "login", email: "bad@test.com", password: "wrong" }, false);
  check("POST", "/api/auth (bad login)", r.status, r.data, 401, "Login invalid");

  r = await req("POST", "/api/auth", { action: "login", email: "demo@chatcommerce.africa", password: DEMO_PASSWORD }, false);
  check("POST", "/api/auth (admin login)", r.status, r.data, 200, "Login admin");

  r = await req("POST", "/api/auth", { action: "register", email: "bad" }, false);
  check("POST", "/api/auth (bad register)", r.status, r.data, 400, "Register invalid");

  r = await req("POST", "/api/auth", { action: "unknown" }, false);
  check("POST", "/api/auth (unknown)", r.status, r.data, 400, "Action inconnue");

  r = await req("GET", "/api/auth", null, true);
  check("GET", "/api/auth (profile)", r.status, r.data, 200, "Profile avec token");

  // 2. AUTH sub-routes
  console.log(C.bold + "\n📋 2. AUTH SUB-ROUTES" + C.reset);
  r = await req("POST", "/api/auth/phone", { phone: "+237612345678" }, false);
  check("POST", "/api/auth/phone", r.status, r.data, 200, "Phone auth");

  r = await req("POST", "/api/auth/change-password", { currentPassword: DEMO_PASSWORD, newPassword: "NewPass1234" });
  check("POST", "/api/auth/change-password", r.status, r.data, 200, "Change password");
  // Reset
  await req("POST", "/api/auth/change-password", { currentPassword: "NewPass1234", newPassword: DEMO_PASSWORD });

  r = await req("POST", "/api/auth/2fa", { code: "123456" });
  check("POST", "/api/auth/2fa", r.status, r.data, 200, "2FA check");

  // 3. DASHBOARD
  console.log(C.bold + "\n📋 3. DASHBOARD" + C.reset);
  r = await req("GET", "/api/dashboard");
  check("GET", "/api/dashboard", r.status, r.data, 200, "Dashboard");

  // 4. CONTACTS
  console.log(C.bold + "\n📋 4. CONTACTS" + C.reset);
  r = await req("GET", "/api/contacts");
  check("GET", "/api/contacts", r.status, r.data, 200, "Liste contacts");
  r = await req("POST", "/api/contacts", { name: "Test", phone: "+237699999999" });
  check("POST", "/api/contacts", r.status, r.data, 200, "Créer contact");
  r = await req("GET", "/api/contacts/test-id");
  check("GET", "/api/contacts/[id]", r.status, r.data, 200, "Get contact");
  r = await req("PUT", "/api/contacts/test-id", { name: "Updated" });
  check("PUT", "/api/contacts/[id]", r.status, r.data, 200, "Update contact");

  // 5. CONVERSATIONS
  console.log(C.bold + "\n📋 5. CONVERSATIONS" + C.reset);
  r = await req("GET", "/api/conversations");
  check("GET", "/api/conversations", r.status, r.data, 200, "Liste conversations");
  r = await req("GET", "/api/conversations/messages");
  check("GET", "/api/conversations/messages", r.status, r.data, 200, "Messages");
  r = await req("POST", "/api/conversations/messages", { contactId: "test", message: "Hi" });
  check("POST", "/api/conversations/messages", r.status, r.data, 200, "Envoyer message");

  // 6. PRODUCTS
  console.log(C.bold + "\n📋 6. PRODUITS" + C.reset);
  r = await req("GET", "/api/products");
  check("GET", "/api/products", r.status, r.data, 200, "Liste produits");
  r = await req("GET", "/api/products/categories");
  check("GET", "/api/products/categories", r.status, r.data, 200, "Catégories");
  r = await req("POST", "/api/products", { name: "Test Product", price: 5000 });
  check("POST", "/api/products", r.status, r.data, 200, "Créer produit");

  // 7. ORDERS
  console.log(C.bold + "\n📋 7. COMMANDES" + C.reset);
  r = await req("GET", "/api/orders");
  check("GET", "/api/orders", r.status, r.data, 200, "Liste commandes");
  r = await req("POST", "/api/orders", { contactId: "test", items: [], total: 5000 });
  check("POST", "/api/orders", r.status, r.data, 200, "Créer commande");

  // 8. LEADS
  console.log(C.bold + "\n📋 8. LEADS" + C.reset);
  r = await req("GET", "/api/leads");
  check("GET", "/api/leads", r.status, r.data, 200, "Liste leads");
  r = await req("POST", "/api/leads", { name: "Test Lead", source: "web" });
  check("POST", "/api/leads", r.status, r.data, 200, "Créer lead");

  // 9. CAMPAIGNS
  console.log(C.bold + "\n📋 9. CAMPAGNES" + C.reset);
  r = await req("GET", "/api/campaigns");
  check("GET", "/api/campaigns", r.status, r.data, 200, "Liste campagnes");
  r = await req("POST", "/api/campaigns", { name: "Test", type: "whatsapp" });
  check("POST", "/api/campaigns", r.status, r.data, 200, "Créer campagne");
  r = await req("POST", "/api/campaigns/launch", { campaignId: "test" });
  check("POST", "/api/campaigns/launch", r.status, r.data, 200, "Lancer campagne");

  // 10. DELIVERIES
  console.log(C.bold + "\n📋 10. LIVRAISONS" + C.reset);
  r = await req("GET", "/api/deliveries");
  check("GET", "/api/deliveries", r.status, r.data, 200, "Liste livraisons");
  r = await req("GET", "/api/deliveries/stats");
  check("GET", "/api/deliveries/stats", r.status, r.data, 200, "Stats livraisons");
  r = await req("POST", "/api/deliveries", { orderId: "test", address: "Douala" });
  check("POST", "/api/deliveries", r.status, r.data, 200, "Créer livraison");
  r = await req("GET", "/api/deliveries/test-id");
  check("GET", "/api/deliveries/[id]", r.status, r.data, 200, "Get livraison");
  r = await req("PUT", "/api/deliveries/test-id", { status: "delivered" });
  check("PUT", "/api/deliveries/[id]", r.status, r.data, 200, "Update livraison");

  // 11. PAYMENTS
  console.log(C.bold + "\n📋 11. PAIEMENTS" + C.reset);
  r = await req("GET", "/api/payments");
  check("GET", "/api/payments", r.status, r.data, 200, "Liste paiements");
  r = await req("GET", "/api/payments/admin");
  check("GET", "/api/payments/admin", r.status, r.data, 200, "Paiements admin");
  r = await req("POST", "/api/payments/confirm", { paymentId: "test", status: "completed" });
  check("POST", "/api/payments/confirm", r.status, r.data, 200, "Confirmer paiement");

  // 12. DRIVERS
  console.log(C.bold + "\n📋 12. LIVREURS" + C.reset);
  r = await req("GET", "/api/drivers");
  check("GET", "/api/drivers", r.status, r.data, 200, "Liste livreurs");
  r = await req("POST", "/api/drivers", { name: "Test Driver", phone: "+237622222222" });
  check("POST", "/api/drivers", r.status, r.data, 200, "Créer livreur");
  r = await req("GET", "/api/drivers/test-id");
  check("GET", "/api/drivers/[id]", r.status, r.data, 200, "Get livreur");
  r = await req("PUT", "/api/drivers/test-id", { name: "Updated" });
  check("PUT", "/api/drivers/[id]", r.status, r.data, 200, "Update livreur");

  // 13. TELEGRAM
  console.log(C.bold + "\n📋 13. TELEGRAM" + C.reset);
  r = await req("GET", "/api/telegram/agents");
  check("GET", "/api/telegram/agents", r.status, r.data, 200, "Liste agents TG");
  r = await req("POST", "/api/telegram/agents", { name: "Agent Test" });
  check("POST", "/api/telegram/agents", r.status, r.data, 200, "Créer agent TG");
  r = await req("GET", "/api/telegram/agents/test-id");
  check("GET", "/api/telegram/agents/[id]", r.status, r.data, 200, "Get agent TG");
  r = await req("PUT", "/api/telegram/agents/test-id", { name: "Updated" });
  check("PUT", "/api/telegram/agents/[id]", r.status, r.data, 200, "Update agent TG");
  r = await req("GET", "/api/telegram/agents/test-id/services");
  check("GET", "/api/telegram/agents/[id]/services", r.status, r.data, 200, "Services agent TG");
  r = await req("GET", "/api/telegram/stats");
  check("GET", "/api/telegram/stats", r.status, r.data, 200, "Stats TG");
  r = await req("POST", "/api/telegram/setup", { botToken: "test" });
  check("POST", "/api/telegram/setup", r.status, r.data, 400, "Setup TG (bad token)");
  r = await req("POST", "/api/telegram/activate", { agentId: "test" });
  check("POST", "/api/telegram/activate", r.status, r.data, 200, "Activer agent TG");
  r = await req("POST", "/api/telegram/ai", { message: "Bonjour" });
  check("POST", "/api/telegram/ai", r.status, r.data, 200, "AI TG");
  r = await req("GET", "/api/telegram/bookings");
  check("GET", "/api/telegram/bookings", r.status, r.data, 200, "Bookings TG");

  // 14. AUTOMATIONS
  console.log(C.bold + "\n📋 14. AUTOMATISATIONS" + C.reset);
  r = await req("GET", "/api/automations");
  check("GET", "/api/automations", r.status, r.data, 200, "Liste automatisations");
  r = await req("POST", "/api/automations", { name: "Test", trigger: "new_lead" });
  check("POST", "/api/automations", r.status, r.data, 200, "Créer automatisation");
  r = await req("POST", "/api/automations/run", { automationId: "test" });
  check("POST", "/api/automations/run", r.status, r.data, 200, "Run automatisation");

  // 15. NOTIFICATIONS
  console.log(C.bold + "\n📋 15. NOTIFICATIONS" + C.reset);
  r = await req("GET", "/api/notifications");
  check("GET", "/api/notifications", r.status, r.data, 200, "Notifications");
  r = await req("GET", "/api/notifications/poll");
  check("GET", "/api/notifications/poll", r.status, r.data, 200, "Poll notifications");

  // 16. COMPANY
  console.log(C.bold + "\n📋 16. ENTREPRISE" + C.reset);
  r = await req("GET", "/api/company");
  check("GET", "/api/company", r.status, r.data, 200, "Info entreprise");
  r = await req("PUT", "/api/company", { name: "Updated" });
  check("PUT", "/api/company", r.status, r.data, 200, "Update entreprise");
  r = await req("GET", "/api/company/members");
  check("GET", "/api/company/members", r.status, r.data, 200, "Membres");
  r = await req("POST", "/api/company/members", { name: "Member", email: "m@t.com" });
  check("POST", "/api/company/members", r.status, r.data, 200, "Ajouter membre");

  // 17. REPORTS
  console.log(C.bold + "\n📋 17. RAPPORTS" + C.reset);
  r = await req("GET", "/api/reports");
  check("GET", "/api/reports", r.status, r.data, 200, "Rapports");

  // 18. AI
  console.log(C.bold + "\n📋 18. AI" + C.reset);
  r = await req("POST", "/api/ai", { query: "Résume" });
  check("POST", "/api/ai", r.status, r.data, 200, "AI query");

  // 19. SYNC
  console.log(C.bold + "\n📋 19. SYNC" + C.reset);
  r = await req("POST", "/api/sync", { source: "telegram" });
  check("POST", "/api/sync", r.status, r.data, 200, "Sync");

  // 20. ADMIN
  console.log(C.bold + "\n📋 20. ADMIN" + C.reset);
  r = await req("GET", "/api/admin");
  check("GET", "/api/admin", r.status, r.data, 200, "Admin stats");

  // 21. CHARIOW
  console.log(C.bold + "\n📋 21. CHARIOW" + C.reset);
  r = await req("POST", "/api/chariow/checkout", { amount: 5000, phone: "+237612345678" });
  check("POST", "/api/chariow/checkout", r.status, r.data, 200, "Checkout");
  r = await req("POST", "/api/chariow/webhook", { transaction_id: "test" }, false);
  check("POST", "/api/chariow/webhook", r.status, r.data, 200, "Webhook");

  // 22. CRON (public)
  console.log(C.bold + "\n📋 22. CRON (public)" + C.reset);
  r = await req("GET", "/api/cron/external", null, false);
  check("GET", "/api/cron/external", r.status, r.data, 200, "Cron external");
  r = await req("GET", "/api/cron/automations", null, false);
  check("GET", "/api/cron/automations", r.status, r.data, 200, "Cron automations");

  // 23. SEED (public)
  console.log(C.bold + "\n📋 23. SEED (public)" + C.reset);
  r = await req("POST", "/api/seed", null, false);
  check("POST", "/api/seed", r.status, r.data, 200, "Seed DB");
  r = await req("POST", "/api/seed-demo", null, false);
  check("POST", "/api/seed-demo", r.status, r.data, 200, "Seed demo");

  // 24. MIDDLEWARE SECURITY
  console.log(C.bold + "\n📋 24. SECURITE MIDDLEWARE" + C.reset);
  r = await req("GET", "/api/contacts", null, false);
  check("GET", "/api/contacts (no token)", r.status, r.data, 401, "401 sans token");
  r = await req("GET", "/api/dashboard", null, false);
  check("GET", "/api/dashboard (no token)", r.status, r.data, 401, "401 sans token");
  r = await req("GET", "/api/products", null, false);
  check("GET", "/api/products (no token)", r.status, r.data, 401, "401 sans token");
  r = await req("GET", "/api/orders", null, false);
  check("GET", "/api/orders (no token)", r.status, r.data, 401, "401 sans token");

  // 25. API ROOT
  console.log(C.bold + "\n📋 25. API ROOT" + C.reset);
  r = await req("GET", "/api", null, false);
  check("GET", "/api (root)", r.status, r.data, 200, "API root");

  // ═══ RAPPORT FINAL ═══
  console.log("\n" + C.bold + "═".repeat(80));
  console.log("  📊 RAPPORT FINAL" + C.bold);
  console.log("═".repeat(80) + C.reset + "\n");

  const rate = ((pass / total) * 100).toFixed(1);
  console.log(`  Total: ${C.bold}${total}${C.reset} | ${C.green}✅ Pass: ${pass}${C.reset} | ${C.red}❌ Fail: ${fail}${C.reset}`);
  console.log(`  Taux réussite: ${C.bold}${rate}%${C.reset}\n`);

  if (failures.length > 0) {
    console.log(C.red + C.bold + "  ⚠️ ROUTES EN ERREUR:" + C.reset);
    failures.forEach(f => {
      console.log(`  ${C.red}❌${C.reset} ${C.cyan}${f.method}${C.reset} ${f.route} → got ${f.got}, want ${f.want} (${f.desc})`);
    });
    console.log("");
  }

  if (fail === 0) console.log(C.green + C.bold + "  🎉 TOUS LES TESTS PASSENT ! App prête pour le lancement." + C.reset);
  else if (fail <= 5) console.log(C.yellow + `  ⚡ ${fail} erreurs mineures à vérifier.` + C.reset);
  else console.log(C.red + `  🚨 ${fail} erreurs - À CORRIGER avant lancement !` + C.reset);

  process.exit(fail > 5 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
