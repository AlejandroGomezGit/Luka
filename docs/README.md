# Documentación de Luka

La copia oficial del diseño vive aquí; si un documento y el código se contradicen, se corrige el documento o se escribe un ADR en el mismo pull request.

## Documentos

| Documento | De qué trata |
| --- | --- |
| [01 · Producto](01-producto.md) | Visión, requisitos (RF y RNF), casos de uso (CU) e historias (HU) |
| [02 · Modelo de datos](02-modelo-de-datos.md) | Entidades, invariantes (INV) y diferencias entre PostgreSQL y SQLite |
| [03 · Arquitectura](03-arquitectura-adrs.md) | Stack, monorepo, categorizador, tubería de captura, escalabilidad y entornos |
| [04 · Sincronización y API](04-sincronizacion-api.md) | Motor de sincronización, reloj lógico híbrido, conflictos y contrato de la API |
| [05 · Seguridad y privacidad](05-seguridad-privacidad.md) | Amenazas (AM), autenticación, Ley 1581 y requisitos de la App Store |
| [06 · Pruebas, CI y observabilidad](06-pruebas-ci-observabilidad.md) | Estrategia de pruebas, pipeline, reglas del repositorio y objetivos de servicio |
| [07 · Roadmap y backlog](07-roadmap-backlog.md) | Hitos con sus puertas, issues (T-xxx), épicas, riesgos y definición de hecho |
| [08 · Monorepo y CLAUDE.md](08-monorepo-claude-md.md) | Variables de entorno, scripts y cómo se trabaja con Claude Code |

## Registros de decisiones (ADRs)

| ADR | Decisión |
| --- | --- |
| [001](adr/001-app-con-expo.md) | App con Expo (React Native) y TypeScript |
| [002](adr/002-monorepo-pnpm-turborepo.md) | Monorepo con pnpm y Turborepo |
| [003](adr/003-offline-first-sqlite.md) | Offline-first: SQLite es la fuente de verdad en el dispositivo |
| [004](adr/004-backend-nestjs-postgresql.md) | Backend propio con NestJS y PostgreSQL |
| [005](adr/005-motor-de-sincronizacion-propio.md) | Motor de sincronización propio con registro de operaciones y cursor por usuario |
| [006](adr/006-conflictos-por-campo-con-hlc.md) | Conflictos por campo con reloj lógico híbrido acotado por el servidor |
| [007](adr/007-dinero-en-enteros.md) | Dinero en enteros con moneda ISO 4217 y montos con signo |
| [008](adr/008-uuid-generados-en-el-cliente.md) | UUID v7 en el cliente y UUID v5 deterministas |
| [009](adr/009-categorizador-propio.md) | Categorizador propio con Naive Bayes y diccionario sembrado |
| [010](adr/010-drizzle-orm.md) | Drizzle ORM para PostgreSQL y SQLite |
| [011](adr/011-autenticacion-propia.md) | Autenticación propia con JWT, refresco rotatorio y Sign in with Apple |
| [012](adr/012-adjuntos-con-urls-prefirmadas.md) | Adjuntos con URLs prefirmadas |
| [013](adr/013-api-versionada-y-problem-json.md) | API versionada en `/v1` con errores problem+json |
| [014](adr/014-tuberia-de-captura.md) | Tubería de captura con fuentes enchufables |

Un ADR nuevo toma el siguiente número (`015-titulo.md`) con contexto, decisión, alternativas descartadas y consecuencias.
