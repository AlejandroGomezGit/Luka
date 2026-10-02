# ADR-002: Monorepo con pnpm y Turborepo

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

La app y la API comparten reglas de negocio, contratos y esquemas. En repositorios separados, un cambio del contrato exigiría publicar paquetes y coordinar versiones.

## Decisión

Un solo repositorio con espacios de trabajo de pnpm y Turborepo: `apps/mobile`, `apps/api` y los paquetes `domain`, `contracts`, `schema-pg`, `schema-sqlite` y `config`. Las apps dependen de los paquetes; los paquetes nunca de las apps, y `domain` de ninguno.

## Alternativas descartadas

- **Repositorios separados:** obligan a versionar y publicar los paquetes compartidos, y los cambios dejan de ser atómicos.

## Consecuencias

- Un cambio que cruza la app, la API y el contrato entra en un solo pull request.
- Turborepo ordena y guarda en caché las tareas; el CI corre lint, tipos, pruebas y build en una sola invocación.
- **Hito 0 (R-06):** Metro funciona con las instalaciones aisladas de pnpm sin configuración extra desde Expo SDK 54; no hizo falta `node-linker=hoisted`. El CI empaqueta la app para iOS en cada PR.
- **Hito 0:** los paquetes se compilan a ESM en `dist/` con `tsc`; la API (Node) y Metro consumen el mismo JavaScript.
- **Hito 0:** pnpm bloquea los scripts de instalación; cada dependencia que los trae tiene una decisión explícita en `allowBuilds` de `pnpm-workspace.yaml`.
