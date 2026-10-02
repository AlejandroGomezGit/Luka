## Qué cambia

<!-- Resumen corto del cambio y por qué. -->

## Referencias

<!-- Issue que cierra y la historia, caso de uso o requisito: Closes #, HU-xx, CU-xx, RF-xx. -->

Closes #

## Capturas

<!-- Si hay interfaz: capturas con modo claro y oscuro, y con texto grande (Dynamic Type). -->

## Dependencias nuevas

<!-- Cuál y por qué; si trae scripts de instalación, qué se decidió en allowBuilds. Borra la sección si no hay. -->

## Definición de hecho

- [ ] Cumple los criterios de aceptación de la historia o del caso de uso, con una prueba por cada criterio.
- [ ] Lint, tipos, pruebas y build pasan en CI.
- [ ] Si toca `packages/domain`, su cobertura sigue en 80 % o más.
- [ ] Si cambia el esquema, la migración se probó desde cero y desde la versión anterior.
- [ ] Si cambia el contrato de la API, el OpenAPI se regeneró y las pruebas de contrato pasan.
- [ ] No hay datos financieros en los logs ni secretos en el código.
- [ ] Si hay interfaz, funciona con Dynamic Type y VoiceOver y, cuando aplica, sin conexión.
- [ ] La documentación afectada está actualizada y, si cambió la arquitectura, hay un ADR.
