import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrations: {
    seed: 'node --import tsx --env-file=.env prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://kovert:kovertsecret@localhost:5433/kovertklaus?schema=public",
  },
});
