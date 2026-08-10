const fs = require('fs');
const path = require('path');

const edits = [
  // 1. AI PAGE — Missing Authorization header
  {
    file: 'src/components/app/ai-page.tsx',
    replacements: [{
      old: `      const res = await fetch("/api/ai", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ message: input, language: "fr" }),\n      });`,
      new: `      const token = useAppStore.getState().token;\n      const res = await fetch("/api/ai", {\n        method: "POST",\n        headers: {\n          "Content-Type": "application/json",\n          ...(token ? { Authorization: \`Bearer \${token}\` } : {}),\n        },\n        body: JSON.stringify({ message: input, language: "fr" }),\n      });`
    }]
  },
  // 2. MIDDLEWARE — Exclude /api/cron from JWT check
  {
    file: 'src/middleware.ts',
    replacements: [{
      old: `const PUBLIC_PATHS = ["/api/auth", "/api/seed"];`,
      new: `const PUBLIC_PATHS = ["/api/auth", "/api/seed", "/api/cron"];`
    }]
  },
  // 3. CONVERSATIONS POST — Verify contactId belongs to company
  {
    file: 'src/app/api/conversations/route.ts',
    replacements: [{
      old: `    let conversation = await db.conversation.findFirst({\n      where: { companyId: session.companyId, contactId },\n    });`,
      new: `    // Verify contact belongs to this company\n    const contact = await db.contact.findFirst({\n      where: { id: contactId, companyId: session.companyId },\n    });\n    if (!contact) {\n      return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });\n    }\n\n    let conversation = await db.conversation.findFirst({\n      where: { companyId: session.companyId, contactId },\n    });`
    }]
  },
  // 4. COMPANY MEMBERS — Don't return temp password
  {
    file: 'src/app/api/company/members/route.ts',
    replacements: [{
      old: `    return NextResponse.json({\n      user: newUser,\n      tempPassword,\n    });`,
      new: `    return NextResponse.json({\n      user: newUser,\n      message: "Membre ajout\u00e9. Le mot de passe temporaire devrait \u00eatre envoy\u00e9 par email.",\n    });`
    }]
  },
  // 5. CONTACTS — Add plan limit check
  {
    file: 'src/app/api/contacts/route.ts',
    replacements: [{
      old: `    const session = await auth(request);\n    if (!session) return NextResponse.json({ error: "Non autoris\u00e9" }, { status: 401 });\n\n    const body = await request.json();`,
      new: `    const session = await auth(request);\n    if (!session) return NextResponse.json({ error: "Non autoris\u00e9" }, { status: 401 });\n\n    // Check plan limit for contacts\n    const { checkPlanLimit } = require("@/lib/plan-limits");\n    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });\n    if (company) {\n      const contactCount = await db.contact.count({ where: { companyId: session.companyId } });\n      const limitError = checkPlanLimit(company.plan, "maxContacts", contactCount);\n      if (limitError) {\n        return NextResponse.json({ error: limitError }, { status: 403 });\n      }\n    }\n\n    const body = await request.json();`
    }]
  },
  // 6. PRODUCTS PATCH — Add sanitization + price validation
  {
    file: 'src/app/api/products/route.ts',
    replacements: [{
      old: `    const body = await request.json();\n    const { id, name, description, price, categoryId, sku, stock, isActive, compareAtPrice, image } = body;\n\n    const existing = await db.product.findFirst({`,
      new: `    const body = await request.json();\n    const { id, name, description, price, categoryId, sku, stock, isActive, compareAtPrice, image } = body;\n\n    // Validate price\n    if (price !== undefined && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {\n      return NextResponse.json({ error: "Prix invalide" }, { status: 400 });\n    }\n\n    const existing = await db.product.findFirst({`
    }]
  },
  {
    file: 'src/app/api/products/route.ts',
    replacements: [{
      old: `      data: {\n        ...(name !== undefined && { name }),\n        ...(description !== undefined && { description }),`,
      new: `      data: {\n        ...(name !== undefined && { name: sanitize(name) }),\n        ...(description !== undefined && { description: sanitize(description) }),`
    }]
  },
];

let totalFixed = 0;
let errors = 0;

for (const edit of edits) {
  const filePath = path.join('/home/z/my-project', edit.file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const rep of edit.replacements) {
      if (content.includes(rep.old)) {
        content = content.replace(rep.old, rep.new);
        totalFixed++;
        console.log(`  ✅ Fixed: ${edit.file}`);
      } else {
        console.log(`  ⚠️  Pattern not found in: ${edit.file}`);
        errors++;
      }
    }
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {
    console.error(`  ❌ Error: ${edit.file} - ${e.message}`);
    errors++;
  }
}

console.log(`\n📊 Summary: ${totalFixed} fixes applied, ${errors} errors`);
