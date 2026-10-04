# Seguridad

Luka maneja datos financieros personales, así que los reportes de seguridad se atienden antes que cualquier otro trabajo.

## Cómo reportar una vulnerabilidad

No abras un issue público. Usa el reporte privado de GitHub: pestaña **Security**, luego **Report a vulnerability**.

Incluye qué componente afecta (app, API o infraestructura), cómo reproducirlo y qué impacto crees que tiene. No incluyas datos reales de personas.

Recibirás una primera respuesta en un plazo de 7 días. Cuando haya corrección, se publica un aviso con el crédito para quien lo reportó, si así lo quiere.

## Alcance

- La API (`apps/api`) y su contrato.
- La app iOS (`apps/mobile`) y los datos que guarda en el dispositivo.
- La sincronización, la autenticación y el aislamiento de datos entre usuarios.
- Secretos o datos personales expuestos en el repositorio, los logs o la infraestructura.

Fuera de alcance: ataques de denegación de servicio por volumen y pruebas contra cuentas o datos de otras personas.

## Cómo se protege Luka

El modelo de amenazas completo (AM-01 a AM-14) y los requisitos de privacidad (Ley 1581 de 2012 y App Store) están en [docs/05-seguridad-privacidad.md](docs/05-seguridad-privacidad.md). En resumen:

- Toda consulta filtra por usuario y PostgreSQL aplica seguridad a nivel de fila.
- Tokens de acceso de vida corta, refresco de un solo uso y contraseñas con Argon2id.
- Los logs nunca registran importes, comercios, notas ni correos.
- El texto de los movimientos se procesa en el dispositivo y no sale sin consentimiento.
- Nunca hay secretos en el código: el repositorio solo incluye `.env.example` con valores falsos.

## Hallazgos de los escáneres

El CI corre gitleaks (secretos) y osv-scanner (dependencias vulnerables) en cada PR. Un hallazgo nunca se resuelve desactivando el job:

- **Secreto real:** se rota de inmediato. Borrar el commit no basta, porque el valor ya pudo copiarse.
- **Falso positivo de gitleaks:** se agrega su huella exacta (`commit:archivo:regla:línea`) a `.gitleaksignore` con un comentario que explica el motivo. Nunca se ignora una ruta ni una regla entera.
- **Vulnerabilidad sin arreglo aplicable:** se agrega a `osv-scanner.toml` como `[[IgnoredVulns]]` con su motivo y un `ignoreUntil` a 90 días o menos. Al caducar, el job vuelve a fallar y se revisa de nuevo.
