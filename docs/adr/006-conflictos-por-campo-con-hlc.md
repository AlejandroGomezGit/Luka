# ADR-006: Conflictos por campo con reloj lógico híbrido acotado por el servidor

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Cuando dos dispositivos editan el mismo registro hay que decidir qué edición gana. La hora de llegada al servidor premia a quien tenga peor conexión, y el reloj del celular puede estar adelantado o atrasado.

## Decisión

Cada campo, o grupo de campos que solo tiene sentido junto (importe, clasificación), lleva un reloj lógico híbrido (HLC): hora en milisegundos, contador e id del dispositivo. Gana el reloj mayor y el empate lo decide el id del dispositivo. El servidor acota la hora de cada operación a la suya, así un reloj adelantado no gana para siempre. El cambio perdedor queda registrado en `conflicts`.

## Alternativas descartadas

- **Hora de llegada al servidor:** no respeta el orden real de edición.
- **Relojes vectoriales:** detectan concurrencia, pero no deciden un ganador y crecen con cada dispositivo.
- **CRDTs:** más de lo que necesitan registros planos.

## Consecuencias

- Ediciones de campos distintos se combinan sin perder ninguna.
- Borrar es un campo más (`deleted_at`), así que se fusiona igual que cualquier edición.
- El reloj y la fusión viven en `packages/domain` y se prueban con propiedades (T-027, T-028).
