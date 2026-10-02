# ADR-014: Tubería de captura con fuentes enchufables

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Los movimientos que la persona no escribe llegarán por varias fuentes: mensajes del banco pegados o enviados por un Atajo de iOS, extractos y, cuando los bancos abran sus datos, una conexión bancaria. En iPhone una app no puede leer los SMS por sí sola.

## Decisión

Toda fuente entra por la misma tubería de `packages/domain`: adaptador, lector del banco, huella contra duplicados (`external_id`), cuenta, categoría y movimiento «por revisar», que solo cuenta al confirmarse (INV-09). Hoy las fuentes son el texto pegado y el Atajo de iOS; la conexión bancaria será un adaptador más.

## Alternativas descartadas

- **Leer los SMS directamente:** no es posible en iPhone y Google Play lo restringe.
- **Conectar bancos desde el inicio:** depende de estándares que aún no se publican (R-05).
- **Solo entrada manual:** no reduce la fricción que motiva el producto.

## Consecuencias

- Una sola ruta para deduplicar, revisar y categorizar; sumar una fuente es escribir un adaptador.
- El mismo gasto que llega por mensaje, por extracto y por banco no se cuenta tres veces.
- El texto original queda solo en el dispositivo (`captured_messages`) y se borra a los 30 días.
- Si iOS ejecuta la automatización sin confirmación se valida en un iPhone real en el Hito 5 (R-13).
