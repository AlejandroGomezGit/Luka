# ADR-004: Backend propio con NestJS y PostgreSQL

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

La sincronización es el diferenciador técnico del proyecto y necesita control total sobre transacciones, numeración por usuario e idempotencia. Además, el proyecto debe demostrar trabajo full stack.

## Decisión

API propia con NestJS (adaptador Fastify) sobre PostgreSQL, con Redis y BullMQ para los trabajos en segundo plano.

## Alternativas descartadas

- **Supabase o Firebase:** aceleran el inicio, pero esconden justo la parte que se quiere controlar y demostrar, y atan el modelo de datos al proveedor.

## Consecuencias

- Hay que operar la API: despliegue, copias de seguridad, observabilidad y seguridad son responsabilidad del proyecto.
- PostgreSQL aporta transacciones, `jsonb`, `CHECK` y seguridad a nivel de fila.
- **Hito 0:** NestJS 12 publica sus paquetes en ESM; la API es ESM como el resto del monorepo. Las pruebas HTTP usan `inject` de Fastify, sin abrir un puerto.
