import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  // Migra el dueño de las tablas, nunca luka_app (la API). Sin MIGRATION_DATABASE_URL apunta al
  // PostgreSQL local de infra/docker-compose.yml (credenciales falsas).
  dbCredentials: {
    url: process.env['MIGRATION_DATABASE_URL'] ?? 'postgres://luka:luka@localhost:15432/luka',
  },
});
