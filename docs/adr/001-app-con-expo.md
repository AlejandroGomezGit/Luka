# ADR-001: App con Expo (React Native) y TypeScript

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Luka es una app iOS hecha por una sola persona que también escribe la API. Hace falta un solo lenguaje en todo el sistema, poco contacto con Xcode y la puerta abierta a Android sin reescribir.

## Decisión

La app se construye con Expo (React Native), Expo Router y TypeScript. EAS Build compila iOS en la nube y EAS Submit la envía a App Store Connect.

## Alternativas descartadas

- **Swift con SwiftUI:** la mejor integración con iOS, pero un segundo lenguaje y ningún camino a Android.
- **Flutter:** buen rendimiento, pero Dart no se comparte con la API.

## Consecuencias

- La app, la API y los paquetes comparten TypeScript, y `packages/domain` corre igual en el celular y en el servidor.
- Las funciones nativas sin módulo de Expo (OCR de recibos, App Intents) requieren un módulo nativo propio; se validan antes de su hito (R-04, R-13).
- Las actualizaciones OTA solo corrigen JavaScript; las funciones nuevas viajan en una versión revisada por Apple.
- **Hito 0:** la app usa Expo SDK 57, solo iOS (`platforms: ["ios"]`), con las rutas en `src/app`.
