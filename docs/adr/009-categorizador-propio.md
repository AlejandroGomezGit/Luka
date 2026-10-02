# ADR-009: Categorizador propio por capas con Naive Bayes y diccionario sembrado

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Categorizar movimientos ahorra trabajo, pero el texto de los movimientos es sensible y la app debe funcionar sin conexión. Los textos son cortos, como el nombre de un comercio.

## Decisión

Un clasificador por capas que corre en el dispositivo: normalización del texto, reglas del usuario (V2), Naive Bayes multinomial sembrado con un diccionario versionado de comercios en español y un umbral de confianza bajo el cual no sugiere nada. Aprende de las correcciones del usuario.

## Alternativas descartadas

- **Entrenar un LLM propio:** exige datos y costos fuera del alcance del proyecto.
- **API de LLM para todo:** envía datos financieros a terceros, cuesta por uso y no funciona sin conexión.

## Consecuencias

- Privado, gratuito, rápido y explicable; funciona sin red.
- Los conteos (`token_stats`) se reconstruyen desde el historial, por eso no se sincronizan.
- El acierto se mide en CI con un conjunto reservado; la meta se fija tras la primera medición.
- Un servicio de IA externo solo se usaría como respaldo, con consentimiento `ai_external`.
