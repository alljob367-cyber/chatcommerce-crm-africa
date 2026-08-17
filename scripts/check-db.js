const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_Vu1EqLD0fyxl@ep-icy-bar-ayw4j64r-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
    }
  }
});
async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true, slug: true, plan: true } });
  console.log('Companies:', JSON.stringify(companies, null, 2));
  const agents = await prisma.telegramAgent.findMany({ select: { id: true, name: true, botUsername: true, businessType: true, isActive: true } });
  console.log('Agents:', JSON.stringify(agents, null, 2));
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, companyId: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());