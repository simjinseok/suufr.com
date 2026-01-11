import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Specifies the location of your schema file
  schema: 'prisma/schema.prisma',

  datasource: {
    // Retrieves the database connection URL from environment variables
    url: env('POSTGRES_PRISMA_URL'),
    // Optionally support a shadow database URL if present
    // shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
