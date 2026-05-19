const { prisma } = require('../src/lib/db');
(async()=>{ await prisma.$queryRaw`SELECT 1`; console.log('ok'); await prisma.$disconnect(); })().catch(e=>{ console.error(e); process.exit(1); });
