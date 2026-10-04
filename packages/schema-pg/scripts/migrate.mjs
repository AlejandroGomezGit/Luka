/* global process, console, URL */
// db:migrate: aplica las migraciones con el migrador de drizzle-orm (la misma tabla
// drizzle.__drizzle_migrations que drizzle-kit), dice a qué servidor se conecta y, si falla, muestra
// el error real de PostgreSQL. En local también fija la contraseña de luka_app (T-026); en otros
// entornos la pone el gestor de secretos (T-040). Nunca imprime contraseñas.
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const DEFAULT_MIGRATION_URL = 'postgres://luka:luka@localhost:15432/luka';
const DEFAULT_APP_URL = 'postgres://luka_app:luka-app-local@localhost:15432/luka';

/** URL de migraciones: siempre el dueño de las tablas, nunca luka_app (el rol de la API). */
export function migrationUrl(env) {
  const url = new URL(env.MIGRATION_DATABASE_URL ?? DEFAULT_MIGRATION_URL);
  if (decodeURIComponent(url.username) === 'luka_app') {
    throw new Error(
      'MIGRATION_DATABASE_URL usa luka_app, el rol de la API: las migraciones las aplica el dueño de las tablas (luka).',
    );
  }
  return url;
}

/**
 * De dónde salió la URL de migraciones. `shell` son las variables que ya traía la terminal antes de
 * leer .env (process.loadEnvFile no pisa las de la terminal).
 */
export function urlSource(env, shell) {
  if (env.MIGRATION_DATABASE_URL === undefined)
    return 'valor por defecto, sin MIGRATION_DATABASE_URL';
  return shell.has('MIGRATION_DATABASE_URL')
    ? 'MIGRATION_DATABASE_URL de la terminal'
    : 'MIGRATION_DATABASE_URL de .env';
}

/** usuario@host:puerto/base, sin contraseña. */
export const describeUrl = (url) =>
  `${decodeURIComponent(url.username)}@${url.hostname}:${url.port || '5432'}${url.pathname}`;

/** El error de PostgreSQL legible, sin la contraseña y con una pista si el rol o la clave no cuadran. */
export function explain(error, url) {
  // Drizzle envuelve el error («Failed query: …»); el de PostgreSQL o el de red viene en cause.
  const { code = '', message, detail, hint } = error?.cause ?? error ?? {};
  const lines = [
    `Error de PostgreSQL${code ? ` ${code}` : ''}: ${message || code || String(error)}`,
  ];
  if (detail) lines.push(`Detalle: ${detail}`);
  if (hint) lines.push(`Pista de PostgreSQL: ${hint}`);
  if (code === '28000' || code === '28P01') {
    const port = url.port || '5432';
    lines.push(
      `¿Hay otro PostgreSQL en el puerto ${port}? Revisa con lsof -nP -iTCP:${port} -sTCP:LISTEN (README).`,
    );
  }
  if (code === 'ECONNREFUSED') {
    lines.push(
      `Nada escucha en ${url.hostname}:${url.port || '5432'}. ¿Está levantado Docker Compose y coincide el puerto? Mira el puerto publicado con docker compose -f infra/docker-compose.yml ps.`,
    );
  }
  const secret = decodeURIComponent(url.password);
  const text = lines.join('\n');
  return secret ? text.replaceAll(secret, '***') : text;
}

/**
 * Contraseña de luka_app que se fija (la de DATABASE_URL), o null: solo con APP_ENV=local escrito
 * explícitamente y si el servidor que se migra es localhost o 127.0.0.1.
 */
export function localAppPassword(env, server) {
  if (env.APP_ENV !== 'local' || !['localhost', '127.0.0.1'].includes(server.hostname)) return null;
  const url = new URL(env.DATABASE_URL ?? DEFAULT_APP_URL);
  if (decodeURIComponent(url.username) !== 'luka_app') return null;
  return decodeURIComponent(url.password) || null;
}

/** ALTER ROLE no acepta parámetros: el literal se escribe con sus comillas simples duplicadas. */
export const alterAppPassword = (password) =>
  `alter role luka_app password '${password.replaceAll("'", "''")}'`;

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const shell = new Set(Object.keys(process.env));
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
  } catch {
    // Sin .env: valores locales por defecto (los de .env.example).
  }
  let url;
  try {
    url = migrationUrl(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  console.log(`Migrando ${describeUrl(url)} (${urlSource(process.env, shell)})`);
  const sql = postgres(url.toString(), { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
    console.log('Migraciones aplicadas.');
    const password = localAppPassword(process.env, url);
    if (password) {
      await sql.unsafe(alterAppPassword(password));
      console.log('Contraseña local de luka_app fijada (APP_ENV=local).');
    }
  } catch (error) {
    console.error(explain(error, url));
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
