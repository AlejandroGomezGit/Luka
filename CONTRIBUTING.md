# Cómo contribuir

Luka lo desarrolla una sola persona, así que estas reglas reemplazan a un segundo revisor: cada cambio llega por pull request, pasa el CI y cumple la definición de hecho.

## Flujo de trabajo

1. **Un issue por cambio.** Cada pull request resuelve un issue del backlog ([docs/07-roadmap-backlog.md](docs/07-roadmap-backlog.md)) y apunta a menos de 400 líneas cambiadas.
2. **Rama corta** desde `main` con prefijo `feat/`, `fix/`, `chore/`, `docs/` o `ci/`, por ejemplo `feat/t-013-registrar-gasto`.
3. **Commits con [Conventional Commits](https://www.conventionalcommits.org/es/)**: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `ci:` o `chore:`, en español.
4. **Antes de abrir el PR**, corre lo mismo que el CI: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm format:check`; si tocaste la API, también `pnpm test:api`.
5. **Fusión** con historial lineal y el CI en verde.

## Reglas del código

- El código, los comentarios y la documentación van en español; los identificadores, en inglés.
- TypeScript estricto y sin `any`.
- `packages/domain` es TypeScript puro: nada de React Native, Node, red ni base de datos. Su compilación lo impide.
- Dinero en enteros de la unidad menor con moneda ISO 4217; nunca decimales flotantes.
- Errores de la API en `application/problem+json` con un `code` estable.
- Los logs nunca llevan importes, comercios, notas ni correos.

Las reglas completas están en [CLAUDE.md](CLAUDE.md), en la sección «Reglas de arquitectura».

## Pruebas

- Cada criterio de aceptación tiene una prueba cuyo nombre incluye el id de la historia o del invariante, por ejemplo `HU-03` o `INV-01`.
- Escribe primero la prueba del criterio cuando sea posible.
- El reloj y el azar se inyectan: ninguna prueba depende de la hora real.
- Cobertura de `packages/domain`: 80 % o más (el CI lo exige).
- Una prueba inestable se arregla o se desactiva con un issue; nunca se reintenta «hasta que pase».

## Dependencias

- Ninguna dependencia nueva sin justificarla en el PR.
- pnpm bloquea los scripts de instalación de las dependencias. Si una nueva los trae, decide de forma explícita en `allowBuilds` de `pnpm-workspace.yaml`, y explica por qué en el PR.
- En la app, instala con `pnpm expo install` para que la versión coincida con el SDK de Expo.

## Base de datos

- Cambia el esquema en `packages/schema-pg` o `packages/schema-sqlite` y genera la migración con `pnpm db:generate`.
- Las migraciones ya aplicadas no se editan: se crea una nueva.

## Documentación

- Un cambio de arquitectura exige un ADR nuevo en [docs/adr/](docs/adr/) con contexto, decisión, alternativas y consecuencias.
- Un cambio de comportamiento actualiza el documento afectado en el mismo PR.
