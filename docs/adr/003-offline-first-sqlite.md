# ADR-003: Offline-first: SQLite es la fuente de verdad en el dispositivo

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Registrar un gasto debe tomar segundos y funcionar en el metro o en modo avión. Una app que espera a la red para guardar pierde gastos y se siente lenta.

## Decisión

La app lee y escribe en SQLite (`expo-sqlite` con Drizzle). La interfaz nunca espera a la red: la sincronización es una tarea de fondo y el servidor es el punto de encuentro entre dispositivos, no la fuente de verdad del celular.

## Alternativas descartadas

- **Cliente delgado con caché:** más simple, pero sin conexión solo sirve para leer y cada escritura depende de la red.

## Consecuencias

- Las listas, búsquedas y resúmenes se resuelven en el dispositivo; el servidor atiende sobre todo escrituras y sincronización.
- Hace falta un motor de sincronización (ADR-005) y un esquema SQLite paralelo al de PostgreSQL (ADR-010).
- Los saldos no se sincronizan: cada dispositivo los recalcula desde los movimientos.
