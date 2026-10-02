import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  // Sin DATABASE_URL apunta al PostgreSQL local de infra/docker-compose.yml (credenciales falsas).
  dbCredentials: { url: process.env['DATABASE_URL'] ?? 'postgres://luka:luka@localhost:5432/luka' },
});
