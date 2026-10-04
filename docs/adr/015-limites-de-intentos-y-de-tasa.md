# ADR-015: Límites de intentos de credenciales y de tasa en Redis

- **Estado:** Aceptada
- **Fecha:** 4 de octubre de 2026

## Contexto

AM-01 pide frenar la adivinación de contraseñas con una espera creciente y mensajes genéricos. AM-08 pide un límite de tasa por IP y por usuario. Las dos defensas cuentan en Redis, porque la API corre en varias instancias. Falta decidir qué pasa cuando Redis no responde y cuánto puede usar un atacante el bloqueo contra otra persona.

## Decisión

**Dos mecanismos separados, con dos códigos de `429`:**

- **Intentos fallidos de credenciales (AM-01), `too_many_attempts`.** Un `AttemptLimiter` propio con tres contadores por ventana (15 minutos por defecto):
  - cuenta e IP, con tope 5;
  - cuenta desde todas las IP, con tope 20;
  - IP sobre todas las cuentas, con tope 50.

  Al llegar a cualquiera de los topes, la cuenta o la IP queda bloqueada 1 minuto, y la espera se duplica con cada fallo siguiente, hasta 1 hora. Durante el bloqueo, incluso la contraseña correcta recibe `429`, para no confirmarla. Un acierto reinicia solo el contador de cuenta e IP. Un correo inexistente cuenta y se bloquea igual que uno real.
- **Límite de tasa (AM-08), `rate_limited`.** `@fastify/rate-limit` con Redis:
  - por IP, 300 peticiones por minuto;
  - 20 en `/v1/auth/*`, en un contador aparte;
  - por usuario autenticado, 300.

  `/healthz` y `/readyz` no cuentan.

**Claves de Redis.** Los correos se pasan a minúsculas y sin espacios, y las IP se agrupan: la IPv4 tal cual y la IPv6 por su prefijo /64. Los dos van solo como HMAC-SHA256 con `RATE_LIMIT_KEY_SECRET`. Toda clave expira. Los incrementos son atómicos: un script Lua en los intentos y el del plugin en la tasa. Cada contador tiene su espacio de nombres: `luka:tasa:ip:`, `luka:tasa:auth:` y `luka:tasa:usuario:` en la tasa, y `luka:intentos:` y `luka:bloqueo:` en los intentos. Así, el contador general y el estricto de `/v1/auth/*` nunca comparten clave.

**Si Redis no responde:**

| Mecanismo | Comportamiento | Motivo |
| --- | --- | --- |
| Límite de tasa | Deja pasar | Un corte de Redis no debe tumbar la API ni la sincronización |
| Intentos de credenciales | `503 temporarily_unavailable` con `Retry-After: 30` | Sin contador, la fuerza bruta no tendría freno |

Los dos casos se registran como advertencia, y `/readyz` marca a Redis caído. Las sesiones abiertas siguen funcionando, porque el refresco del token solo pasa por el límite de tasa.

**IP del cliente.** Fastify confía en `X-Forwarded-For` solo si `TRUST_PROXY` lo permite: `false` (el valor por defecto), `true` o las direcciones y rangos del balanceador, separados por comas.

- **Un número de saltos hace fallar el arranque.** Fastify desactivó esa forma en 5.12.1 por CVE-2026-16732 (GHSA-3m5p-2c4r-xxw2): con solo contar saltos, un cliente directo puede falsificar `X-Forwarded-*`.
- **En producción, `true` también hace fallar el arranque**, porque confía en cualquier cabecera `X-Forwarded-*`. Exige las direcciones del balanceador.
- **Con `false` en producción, la API avisa al arrancar:** detrás de un balanceador, todas las peticiones compartirían su IP.
- **Producción** es `APP_ENV=production` o `NODE_ENV=production`. Sin `APP_ENV`, `NODE_ENV=production` cuenta como producción y nunca como local.
- **T-040** pone el CIDR del balanceador y deja el origen alcanzable solo a través del proxy; si no, cualquiera podría saltárselo y enviar la cabecera.

## Alternativas descartadas

- **Solo `@fastify/rate-limit` para todo:** no conoce cuentas, no bloquea a una cuenta desde varias IP y no sabe que un acierto debe reiniciar el contador.
- **Contar en memoria:** cada instancia tendría su propio contador, y un atacante repartiría sus intentos.
- **Dejar pasar los intentos sin Redis:** convierte un corte en una ventana de fuerza bruta.
- **Bloquear solo por cuenta e IP:** un atacante con muchas IP probaría contraseñas sin freno contra una misma cuenta.

## Consecuencias

- **Compromiso del tope por cuenta:** cualquiera que conozca un correo puede dejar a esa persona sin entrar por un rato, fallando desde varias IP. Se acota de cuatro formas:
  - el tope es más alto que el de cuenta e IP (20 frente a 5);
  - el bloqueo es temporal y llega como máximo a 1 hora;
  - el tope por IP frena a un atacante con pocas IP;
  - las sesiones abiertas no se cierran.

  Si se ve abuso en producción, la salida es un desafío adicional (por ejemplo, un código por correo) en vez de subir el tope.
- **El tope por IP puede afectar a una red compartida** (una oficina o una red móvil con NAT). Por eso es alto (50 fallos).
- **Con Redis caído no se puede iniciar sesión, recuperar ni cambiar la contraseña**, aunque la app sigue funcionando sin conexión.
- **Las ventanas y los topes se configuran** por variables de entorno (documento 04). Las pruebas usan valores de milisegundos.
