const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma/client');

const prisma = new PrismaClient();

const email = process.env.SEED_ADMIN_EMAIL || 'admin@campusflow.local';
const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
const nama = process.env.SEED_ADMIN_NAMA || 'Administrator';

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', passwordHash },
    create: {
      nim: 'ADMIN001',
      nama,
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log(`Admin siap: ${admin.email} (${admin.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());