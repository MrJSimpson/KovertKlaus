import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://kovert:kovertsecret@localhost:5433/kovertklaus?schema=public",
  },
});
