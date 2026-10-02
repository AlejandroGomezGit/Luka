# ADR-008: UUID v7 generados en el cliente; UUID v5 para categorías predefinidas y ocurrencias recurrentes

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Un registro creado sin conexión necesita un id antes de llegar al servidor, y reintentar un envío no puede crear duplicados.

## Decisión

Cada registro nace en el dispositivo con un UUID v7, que además ordena por tiempo y mantiene compactos los índices. Los registros que dos dispositivos podrían crear por su cuenta usan UUID v5 deterministas: las categorías predefinidas (usuario y `system_key`) y las ocurrencias de movimientos recurrentes (regla y fecha).

## Alternativas descartadas

- **Enteros autoincrementales:** exigen al servidor para crear y chocan entre dispositivos.

## Consecuencias

- Crear sin conexión y reintentar son seguros: el mismo id llega a ser el mismo registro (`upsert`).
- Dos dispositivos que siembran las categorías predefinidas producen los mismos ids y no se duplican.
- Los ids no revelan cuántos registros hay.
