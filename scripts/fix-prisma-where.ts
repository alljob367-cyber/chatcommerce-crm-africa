// Fix script: Read each file, apply specific edits for Prisma where clause bugs
import { readFileSync, writeFileSync } from 'fs';

interface Edit {
  file: string;
  replacements: { old: string; new: string }[];
}

const edits: Edit[] = [
  // 1. conversations/route.ts - PATCH
  {
    file: 'src/app/api/conversations/route.ts',
    replacements: [{
      old: `    const conversation = await db.conversation.update({
      where: { id, companyId: session.companyId },
      data: { status, assignedToId },
    });

    return NextResponse.json({ conversation });`,
      new: `    const existing = await db.conversation.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });

    const conversation = await db.conversation.update({
      where: { id },
      data: { status, assignedToId },
    });

    return NextResponse.json({ conversation });`
    }]
  },
  // 2. products/route.ts - PATCH
  {
    file: 'src/app/api/products/route.ts',
    replacements: [{
      old: `    const product = await db.product.update({
      where: { id, companyId: session.companyId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(compareAtPrice !== undefined && { compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(sku !== undefined && { sku }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(isActive !== undefined && { isActive }),
        ...(image !== undefined && { image }),
      },
    });

    return NextResponse.json({ product });`,
      new: `    const existing = await db.product.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const product = await db.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(compareAtPrice !== undefined && { compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(sku !== undefined && { sku }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(isActive !== undefined && { isActive }),
        ...(image !== undefined && { image }),
      },
    });

    return NextResponse.json({ product });`
    }]
  },
  // 3. products/route.ts - DELETE
  {
    file: 'src/app/api/products/route.ts',
    replacements: [{
      old: `    await db.product.update({
      where: { id, companyId: session.companyId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });`,
      new: `    const existing = await db.product.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    await db.product.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });`
    }]
  },
  // 4. leads/route.ts - PATCH
  {
    file: 'src/app/api/leads/route.ts',
    replacements: [{
      old: `    const lead = await db.lead.update({
      where: { id, companyId: session.companyId },
      data: { status, notes, assignedToId },
    });

    return NextResponse.json({ lead });`,
      new: `    const existing = await db.lead.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

    const lead = await db.lead.update({
      where: { id },
      data: { status, notes, assignedToId },
    });

    return NextResponse.json({ lead });`
    }]
  },
  // 5. orders/route.ts - PATCH
  {
    file: 'src/app/api/orders/route.ts',
    replacements: [{
      old: `    const order = await db.order.update({
      where: { id, companyId: session.companyId },
      data: {
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        contact: { select: { name: true, phone: true } },
        items: true,
      },
    });`,
      new: `    const existing = await db.order.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const order = await db.order.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        contact: { select: { name: true, phone: true } },
        items: true,
      },
    });`
    }]
  },
  // 6. automations/route.ts - PATCH
  {
    file: 'src/app/api/automations/route.ts',
    replacements: [{
      old: `    const automation = await db.automation.update({
      where: { id, companyId: session.companyId },
      data: {
        ...(name !== undefined && { name }),
        ...(messageTemplate !== undefined && { messageTemplate }),
        ...(isActive !== undefined && { isActive }),
        ...(delayMinutes !== undefined && { delayMinutes }),
      },
    });

    return NextResponse.json({ automation });`,
      new: `    const existing = await db.automation.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Automatisation introuvable" }, { status: 404 });

    const automation = await db.automation.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(messageTemplate !== undefined && { messageTemplate }),
        ...(isActive !== undefined && { isActive }),
        ...(delayMinutes !== undefined && { delayMinutes }),
      },
    });

    return NextResponse.json({ automation });`
    }]
  },
  // 7. automations/route.ts - DELETE
  {
    file: 'src/app/api/automations/route.ts',
    replacements: [{
      old: `    await db.automation.delete({
      where: { id, companyId: session.companyId },
    });

    return NextResponse.json({ success: true });`,
      new: `    const existing = await db.automation.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Automatisation introuvable" }, { status: 404 });

    await db.automation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });`
    }]
  },
  // 8. telegram/agents/[id]/route.ts - PUT
  {
    file: 'src/app/api/telegram/agents/[id]/route.ts',
    replacements: [{
      old: `    const agent = await db.telegramAgent.update({
      where: { id, companyId: session.companyId },
      data: {`,
      new: `    const existing = await db.telegramAgent.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Agent Telegram introuvable" }, { status: 404 });

    const agent = await db.telegramAgent.update({
      where: { id },
      data: {`
    }]
  },
  // 9. telegram/agents/[id]/route.ts - DELETE
  {
    file: 'src/app/api/telegram/agents/[id]/route.ts',
    replacements: [{
      old: `    await db.telegramAgent.delete({
      where: { id, companyId: session.companyId },
    });`,
      new: `    const existing = await db.telegramAgent.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Agent Telegram introuvable" }, { status: 404 });

    await db.telegramAgent.delete({
      where: { id },
    });`
    }]
  },
  // 10. telegram/bookings/route.ts - PATCH
  {
    file: 'src/app/api/telegram/bookings/route.ts',
    replacements: [{
      old: `    const booking = await db.telegramBooking.update({
      where: { id, companyId: session.companyId },
      data: { status },
    });`,
      new: `    const existing = await db.telegramBooking.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Reservation introuvable" }, { status: 404 });

    const booking = await db.telegramBooking.update({
      where: { id },
      data: { status },
    });`
    }]
  },
  // 11. telegram/agents/[id]/services/route.ts - DELETE
  {
    file: 'src/app/api/telegram/agents/[id]/services/route.ts',
    replacements: [{
      old: `    await db.businessService.delete({
      where: { id: serviceId, agentId: id },
    });`,
      new: `    const service = await db.businessService.findFirst({
      where: { id: serviceId, agentId: id },
    });
    if (!service) return NextResponse.json({ error: "Service introuvable" }, { status: 404 });

    await db.businessService.delete({
      where: { id: serviceId },
    });`
    }]
  },
  // 12. telegram/ai/route.ts - findUnique
  {
    file: 'src/app/api/telegram/ai/route.ts',
    replacements: [{
      old: `    const agent = await db.telegramAgent.findUnique({
      where: { id: agentId, companyId: user.companyId },`,
      new: `    const agent = await db.telegramAgent.findFirst({
      where: { id: agentId, companyId: user.companyId },`
    }]
  },
  // 13. auth/change-password/route.ts - findUnique
  {
    file: 'src/app/api/auth/change-password/route.ts',
    replacements: [{
      old: `    const user = await db.user.findUnique({
      where: { id: payload.userId, companyId: payload.companyId },
      select: { id: true, passwordHash: true },
    });`,
      new: `    const user = await db.user.findFirst({
      where: { id: payload.userId, companyId: payload.companyId },
      select: { id: true, passwordHash: true },
    });`
    }]
  },
];

let totalFixed = 0;
let errors = 0;

for (const edit of edits) {
  const filePath = `/home/z/my-project/${edit.file}`;
  try {
    let content = readFileSync(filePath, 'utf8');
    for (const rep of edit.replacements) {
      if (content.includes(rep.old)) {
        content = content.replace(rep.old, rep.new);
        totalFixed++;
        console.log(`  ✅ Fixed: ${edit.file}`);
      } else {
        console.log(`  ⚠️  Pattern not found: ${edit.file}`);
        errors++;
      }
    }
    writeFileSync(filePath, content, 'utf8');
  } catch (e: unknown) {
    console.error(`  ❌ Error: ${edit.file} - ${(e as Error).message}`);
    errors++;
  }
}

console.log(`\n📊 Summary: ${totalFixed} fixes applied, ${errors} errors`);
