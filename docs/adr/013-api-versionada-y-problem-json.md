# ADR-013: API versionada en /v1 con errores problem+json

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Las versiones viejas de la app siguen instaladas durante meses, y la app debe reaccionar a cada error sin interpretar mensajes de texto.

## Decisión

La versión va en la ruta (`/v1`); un cambio que rompe a clientes viejos crea `/v2`. Todo error responde `application/problem+json` (RFC 9457) con un campo `code` estable que la app interpreta. El contrato se escribe con Zod en `packages/contracts` y el OpenAPI se genera desde ahí.

## Alternativas descartadas

- **Sin versionado:** cada cambio incompatible rompería las instalaciones existentes.

## Consecuencias

- La app decide qué hacer leyendo `code`, nunca `title` ni `detail`.
- **Hito 0:** `code` es obligatorio en `Problem` (el documento 04 se actualizó). Un 500 nunca expone el mensaje interno. `/healthz` y `/readyz` quedan fuera de `/v1`.
- **Hito 0:** el OpenAPI sale de `z.toJSONSchema` (Zod 4), sin otra biblioteca. `openapi.json` se versiona y una prueba falla si no coincide con los esquemas.
