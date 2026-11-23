import { prisma } from '@services/database/prisma/prisma.client';

// Empties every table of the test database (the Prisma migrations table is kept), so each test starts from
// nothing. It works for any module: new tables are found in the database, not listed here.
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}
