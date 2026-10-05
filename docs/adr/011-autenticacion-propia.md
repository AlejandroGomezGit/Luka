# ADR-011: Autenticación propia con JWT de vida corta, refresco rotatorio y Sign in with Apple

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

La app necesita cuentas con correo y con Apple, sesiones por dispositivo que se puedan revocar y el menor número posible de dependencias externas.

## Decisión

Autenticación propia: contraseñas con Argon2id, token de acceso JWT de 15 minutos firmado con clave asimétrica, refresco opaco de un solo uso con detección de reutilización por familia, y validación del token de Sign in with Apple. El detalle está en el documento 05.

## Alternativas descartadas

- **Servicio gestionado (Cognito, Auth0):** menos código propio, pero otra dependencia, otro costo y menos control sobre la sesión por dispositivo.

## Consecuencias

- El riesgo de escribir autenticación se reduce con bibliotecas probadas, pruebas de integración de la rotación y una revisión antes del lanzamiento.
- Los tokens viven en el Keychain (`expo-secure-store`), nunca en SQLite ni en logs.
- La reutilización de un token de refresco tiene un margen de 30 s para respuestas perdidas y refrescos simultáneos, y el token de acceso sigue valiendo hasta 15 minutos tras cerrar sesión: ADR-016.
