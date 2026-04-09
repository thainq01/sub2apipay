import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://sub2apipay:sub2apipay@localhost:5433/sub2apipay',
  },
});
