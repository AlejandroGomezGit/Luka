# ADR-005: Motor de sincronización propio con registro de operaciones y cursor por usuario

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Varios dispositivos de una persona editan sin conexión y deben converger sin perder ni duplicar movimientos. Los datos son registros planos (cuentas, categorías, movimientos), no documentos de texto colaborativo.

## Decisión

Motor propio: el dispositivo guarda cada cambio en un `outbox` y lo envía con `POST /v1/sync`; el servidor aplica cada operación de forma idempotente (índice único sobre `user_id` y `op_id`), la numera con un contador por usuario y devuelve los cambios posteriores al cursor del dispositivo. El detalle está en el documento 04.

## Alternativas descartadas

- **PowerSync o ElectricSQL:** resuelven el problema, pero el diferenciador del proyecto quedaría en un servicio de terceros.
- **CRDTs completos:** pensados para texto colaborativo; para registros planos bastan las reglas por campo (ADR-006).

## Consecuencias

- Hay que demostrar la convergencia: pruebas de propiedades y un simulador multidispositivo con 50 semillas por PR y 1 000 de noche (RNF-05).
- El contador por usuario evita los huecos de un `bigserial` global, a cambio de un bloqueo de fila por usuario al aplicar.
- `sync_ops` y los registros borrados se conservan 30 días; un cursor más viejo recibe `410` y hace una descarga completa.
