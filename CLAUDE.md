# Luka

App iOS de finanzas personales (registro de gastos) que funciona sin conexión y se sincroniza sin perder datos. Es un proyecto de portafolio full stack y está diseñado para poder publicarse en la App Store. El código, los comentarios, los commits y la documentación van en español; los identificadores de código, en inglés.

## Documentos (léelos antes de implementar)

- docs/01-producto.md: visión, requisitos (RF y RNF), casos de uso (CU) e historias (HU).
- docs/02-modelo-de-datos.md: entidades, invariantes (INV) y reglas de PostgreSQL y SQLite.
- docs/03-arquitectura-adrs.md: stack, monorepo, categorizador y ADRs.
- docs/04-sincronizacion-api.md: motor de sincronización, reloj lógico híbrido (HLC), conflictos y contrato de la API.
- docs/05-seguridad-privacidad.md: amenazas (AM), Ley 1581 y requisitos de la App Store.
- docs/06-pruebas-ci-observabilidad.md: pruebas, pipeline y observabilidad.
- docs/07-roadmap-backlog.md: hitos, puertas, issues (T-xxx) y definición de hecho.

Si el código y un documento se contradicen, no lo resuelvas en silencio: avísame y propón actualizar el documento o crear un ADR.

## Stack y estructura

TypeScript en todo el repositorio. App: Expo, React Native y Expo Router, con expo-sqlite y Drizzle. API: NestJS con Fastify, PostgreSQL con Drizzle, Redis y BullMQ. Contratos con Zod y OpenAPI. Monorepo con pnpm y Turborepo.

- apps/mobile y apps/api
- packages/domain, contracts, schema-pg, schema-sqlite y config
- infra/ (Terraform y Docker Compose) y docs/

## Comandos

- pnpm install
- pnpm dev:api y pnpm dev:mobile
- pnpm lint, pnpm typecheck, pnpm test, pnpm test:api, pnpm build y pnpm format
- pnpm sim:sync --seeds 50 (desde H3, T-033)
- pnpm --filter @luka/contracts openapi (regenera openapi.json)
- pnpm db:generate y pnpm db:migrate
- docker compose -f infra/docker-compose.yml up -d

## Reglas de arquitectura (no negociables)

1. packages/domain es TypeScript puro: sin React Native, sin Node y sin acceso a red ni a base de datos. Lo externo entra por interfaces.
2. Dinero: enteros en la unidad menor (amount_minor) con moneda ISO 4217 y signo según el tipo (INV-01). Nunca decimales flotantes.
3. Identificadores: UUID v7 generados en el cliente; UUID v5 para categorías predefinidas y ocurrencias recurrentes.
4. Toda tabla sincronizable lleva las columnas comunes del documento 02.
5. Borrado lógico (deleted_at); solo la eliminación de cuenta y la purga borran filas.
6. Todo cambio del usuario pasa por el outbox y viaja con POST /v1/sync; nunca se escribe en el servidor saltándose la cola.
7. Conflictos por campo o grupo de campos con HLC acotado por el servidor (ADR-006).
8. Toda consulta del servidor filtra por user_id y la seguridad a nivel de fila está activa.
9. Errores de la API en application/problem+json con un code estable.
10. Nunca registrar importes, comercios, notas ni correos en los logs.
11. El categorizador corre en el dispositivo; ningún texto de movimientos sale a terceros sin consentimiento (ai_external).
12. Interfaz en español con formato COP, compatible con Dynamic Type y VoiceOver.
13. Todo movimiento que no escribe la persona (mensaje, CSV, banco) entra por la tubería de captura de packages/domain: adaptador, lector, huella contra duplicados, cuenta, categoría y estado por revisar (ADR-014). Lo capturado no cuenta hasta confirmarse (INV-09).

## Convenciones

- Conventional Commits; ramas feat/, fix/, chore/, docs/ o ci/; un issue por rama y por pull request.
- Sin any; sin dependencias nuevas sin justificarlas en el PR.
- Las migraciones ya aplicadas no se editan: se crea una nueva.
- Cada criterio de aceptación tiene una prueba cuyo nombre incluye el id de la historia (por ejemplo HU-03).
- Cobertura de packages/domain: 80 % o más.

## Cómo trabajar

- Antes de empezar un issue, lee el documento correspondiente y resume el plan en pocas líneas. Si algo es ambiguo o grande, pregunta antes de escribir código.
- Escribe primero la prueba del criterio de aceptación cuando sea posible.
- Al terminar, ejecuta lint, typecheck y las pruebas y reporta el resultado real, sin suponerlo.
- Si cambia una decisión de arquitectura, crea un ADR en docs/adr/; si cambia un comportamiento, actualiza el documento afectado en el mismo PR.

## Seguridad

- No leas ni imprimas archivos .env; usa .env.example con valores falsos.
- Nunca pongas secretos en el código ni en variables EXPO_PUBLIC_, que terminan dentro de la app.
- Pide confirmación antes de git push, de borrar datos o de instalar dependencias.

## Fuera de alcance mientras no se pida

Android, web, pagos o mover dinero real, y cualquier trabajo de V2 o V3 antes de su hito.

## Glosario

HU historia de usuario, CU caso de uso, RF y RNF requisitos, INV invariante de datos, AM amenaza, ADR registro de decisión de arquitectura, HLC reloj lógico híbrido, outbox cola local de cambios pendientes.