# ADR-007: Dinero en enteros con moneda ISO 4217 y montos con signo

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Los decimales de punto flotante no representan con exactitud valores como 0,1, y una app de finanzas no puede acumular errores de redondeo en saldos ni reportes.

## Decisión

Los montos se guardan como enteros en la unidad menor de la moneda (`amount_minor`) junto al código ISO 4217. El tipo de movimiento fija el signo: negativo en gastos y transferencias, positivo en ingresos (INV-01). El saldo es el saldo inicial más la suma de los movimientos.

## Alternativas descartadas

- **Decimales:** exactos en la base de datos, pero sin un tipo equivalente en JavaScript ni en SQLite.
- **Cadenas de texto:** exactas, pero cada suma exige convertir.

## Consecuencias

- Sumar saldos es una suma de enteros, igual en el dispositivo y en el servidor.
- Cada moneda necesita su número de decimales; COP tiene 2 según ISO 4217, aunque la app muestre pesos sin centavos.
- **Hito 0:** en TypeScript los montos son `number` enteros con `Number.isSafeInteger` como guarda (hasta 9 × 10^15 de unidad menor), porque `bigint` no pasa por JSON ni por `expo-sqlite`. PostgreSQL usa `bigint` y SQLite `INTEGER`; ambos tienen `CHECK` de INV-01 e INV-02.
- **Hito 0:** `parseAmount` convierte lo que escribe la persona («12.500,50») con operaciones de texto, sin pasar por flotantes.
