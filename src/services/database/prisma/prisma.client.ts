import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '@config/env';

const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
});

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log:
      env.nodeEnv === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });

if (env.nodeEnv !== 'production') {
  global.prisma = prisma;
}
