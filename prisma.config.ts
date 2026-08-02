import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://kovert:kovertsecret@localhost:5432/kovertklaus?schema=public",
  },
});
