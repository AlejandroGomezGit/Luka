# ADR-010: Drizzle ORM para PostgreSQL y SQLite

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

El mismo esquema lógico vive en PostgreSQL (servidor) y en SQLite (dispositivo), y el ORM debe correr dentro de React Native.

## Decisión

Drizzle ORM declara ambos esquemas en TypeScript y `drizzle-kit` genera las migraciones SQL versionadas.

## Alternativas descartadas

- **Prisma:** no corre en React Native.
- **TypeORM:** sin soporte de `expo-sqlite` y con un estilo distinto en cada motor.

## Consecuencias

- Un mismo estilo para los dos motores y migraciones como archivos SQL revisables.
- Los esquemas son dos (`schema-pg` y `schema-sqlite`) porque cambian los tipos físicos; las listas de valores se comparten desde `packages/domain`.
- **Hito 0:** las enumeraciones son `text` con `CHECK` en lugar de `pgEnum`, así agregar un valor no exige `ALTER TYPE` y el patrón es el mismo en SQLite.
- **Hito 0:** los nombres de columna se escriben en snake_case explícito en lugar de la opción `casing`, que habría que repetir en cada cliente.
- **Hito 0:** las migraciones se prueban desde cero en PGlite y en `node:sqlite`; en la app, `driver: 'expo'` genera `migrations.js`.
