# Luka

App de finanzas personales para iOS que registra un gasto en segundos, funciona sin conexión y se sincroniza sin perder ni duplicar datos. Es un proyecto de portafolio full stack: app móvil, API, bases de datos, sincronización propia, CI/CD y observabilidad.

**Estado:** Hito 0 (cimientos) completo: monorepo, CI, entorno local, paquetes compartidos y esqueletos de la app y la API. El roadmap está en [docs/07-roadmap-backlog.md](docs/07-roadmap-backlog.md).

## Qué tiene de interesante

- **Sin conexión de verdad.** SQLite es la fuente de verdad en el celular; un motor de sincronización propio con reloj lógico híbrido resuelve conflictos campo a campo ([ADR-005](docs/adr/005-motor-de-sincronizacion-propio.md), [ADR-006](docs/adr/006-conflictos-por-campo-con-hlc.md)).
- **Dinero exacto.** Enteros en la unidad menor con moneda ISO 4217, validados en el dominio y con `CHECK` en PostgreSQL y SQLite ([ADR-007](docs/adr/007-dinero-en-enteros.md)).
- **Un dominio, dos lados.** Las reglas viven en `packages/domain`, TypeScript puro que corre igual en la app, en la API y en las pruebas.
- **Privacidad por diseño.** El categorizador corre en el dispositivo y ningún texto de movimientos sale sin consentimiento ([ADR-009](docs/adr/009-categorizador-propio.md)).

## Stack

TypeScript en todo el repositorio, con pnpm y Turborepo.

| Parte                    | Tecnología                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App (`apps/mobile`)      | Expo SDK 57, React Native y Expo Router; SQLite con Drizzle                                                                                                  |
| API (`apps/api`)         | NestJS 12 con Fastify, PostgreSQL 18 con Drizzle, Redis y logs con Pino                                                                                      |
| Compartido (`packages/`) | `domain` (reglas puras), `contracts` (Zod y OpenAPI), `schema-pg` y `schema-sqlite` (esquemas y migraciones), `config` (TypeScript, ESLint, Prettier y Jest) |
| Pruebas                  | Jest, fast-check, React Native Testing Library, PGlite y Testcontainers                                                                                      |
| Infraestructura          | Docker Compose en local (`infra/`) y GitHub Actions                                                                                                          |

## Empezar

Requisitos: Node.js 22 (ver `.nvmrc`), Docker y Corepack (incluido en Node).

```bash
corepack enable                                   # activa la versión de pnpm fijada en package.json
pnpm install
cp .env.example .env                              # valores falsos para desarrollo local
docker compose -f infra/docker-compose.yml up -d --wait
pnpm db:migrate                                   # aplica las migraciones en el PostgreSQL local
pnpm dev:api                                      # API en http://localhost:3000 (prueba /readyz)
pnpm dev:mobile                                   # servidor de Expo para el simulador de iOS
```

El entorno local levanta PostgreSQL (5432), Redis (6379), almacenamiento compatible con S3 (API en 9000, consola en 9001) y correo de pruebas (SMTP en 1025, bandeja en http://localhost:8025).

## Comandos

| Comando                                                  | Qué hace                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | Lo mismo que corre el CI, en todo el monorepo                            |
| `pnpm test:api`                                          | Integración de la API contra PostgreSQL y Redis reales (requiere Docker) |
| `pnpm format`                                            | Formatea con Prettier                                                    |
| `pnpm db:generate`                                       | Genera migraciones a partir de los esquemas de Drizzle                   |
| `pnpm db:migrate`                                        | Aplica las migraciones en el PostgreSQL local                            |
| `pnpm --filter @luka/contracts openapi`                  | Regenera `packages/contracts/openapi.json`                               |

## Estructura

```text
apps/mobile          app iOS (Expo)
apps/api             API (NestJS)
packages/domain      dinero, fechas e invariantes; sin React Native, Node ni red
packages/contracts   esquemas Zod y OpenAPI generado
packages/schema-pg   tablas y migraciones de PostgreSQL
packages/schema-sqlite  tablas y migraciones de SQLite
packages/config      configuración compartida
infra/               Docker Compose
docs/                diseño, ADRs y roadmap
```

## Documentación

El diseño completo está en [docs/](docs/README.md): producto, modelo de datos, arquitectura, sincronización, seguridad, pruebas y roadmap, más los [registros de decisiones (ADRs)](docs/adr/).

Para contribuir, lee [CONTRIBUTING.md](CONTRIBUTING.md); para reportar una vulnerabilidad, [SECURITY.md](SECURITY.md).

## Problemas comunes

- **`role "luka" does not exist` al migrar o al arrancar la API.** Hay otro PostgreSQL escuchando en `localhost:5432` (por ejemplo uno de Homebrew) y recibe las conexiones antes que Docker. Detenlo mientras trabajas en Luka (`brew services stop postgresql`, o el nombre de tu servicio) y comprueba con `lsof -nP -iTCP:5432 -sTCP:LISTEN` que solo queda Docker.
- **La API no arranca y nombra una variable.** Falta en `.env`; cópiala de `.env.example`.
