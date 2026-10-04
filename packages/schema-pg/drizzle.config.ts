import { defineConfig } from 'drizzle-kit';

/**
 * Misma regla que db:migrate (#88): el valor por defecto (el PostgreSQL de Docker Compose local, con
 * credenciales falsas) solo vale con APP_ENV=local. Sin eso ni MIGRATION_DATABASE_URL no hay
 * credenciales y drizzle-kit no se conecta a nada; `generate` no las necesita.
 */
export function migrationCredentials(
  env: Record<string, string | undefined>,
): { url: string } | undefined {
  const url =
    env['MIGRATION_DATABASE_URL'] ??
    (env['APP_ENV'] === 'local' ? 'postgres://luka:luka@localhost:15432/luka' : undefined);
  return url === undefined ? undefined : { url };
}

const credentials = migrationCredentials(process.env);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  ...(credentials ? { dbCredentials: credentials } : {}),
});
