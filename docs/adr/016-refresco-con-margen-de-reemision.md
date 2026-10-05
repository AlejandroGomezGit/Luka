# ADR-016: Refresco de un solo uso con margen de reemisión

- **Estado:** Aceptada
- **Fecha:** 5 de octubre de 2026

## Contexto

ADR-011 define el token de refresco como opaco, de un solo uso y con detección de reutilización: si alguien presenta un token ya rotado, se revoca toda su familia (la cadena de tokens de una misma sesión). Con esa regla estricta, un fallo de red normal parece un robo:

- **Respuesta perdida.** El servidor rota R1 y emite R2, pero la respuesta no llega. La app sigue con R1 y reintenta; con la regla estricta se revoca la sesión y la persona debe volver a entrar sin haber sido atacada.
- **Refrescos simultáneos.** Dos peticiones con R1 llegan a la vez, por ejemplo al volver la app al primer plano. Una rota y la otra parece una reutilización.

Responder `409` a la segunda no resuelve la respuesta perdida: la app nunca recibe R2.

## Decisión

- **El primer uso** de un token se marca con una operación atómica (`UPDATE … WHERE used_at IS NULL`), con la fila bloqueada (`FOR UPDATE`) para que dos refrescos del mismo token se atiendan uno detrás del otro.
- **Margen de 30 s** (`REFRESH_REUSE_GRACE_MS`): si un token ya usado vuelve dentro del margen, se emite un par nuevo en la misma familia, hijo del mismo token (`parent_id`), sin revocar nada. Los tokens que ya había emitido siguen valiendo, así sirve la respuesta que la app haya conservado.
- **Tope de 3 reemisiones** por token. Pasado el tope, o fuera del margen, la reutilización revoca la familia entera, incluidas las ramas de reemisiones, y responde `401 refresh_invalid`.
- **Un token vencido** responde `401` sin revocar nada.
- **Cada reemisión se registra** con el id de la familia y su número, nunca con valores de tokens.
- **La app** hace un solo refresco a la vez (T-019c).

## Alternativas descartadas

- **Regla estricta, sin margen:** cierra sesiones legítimas con cada respuesta perdida.
- **`409` para el segundo refresco:** no cubre la respuesta perdida.
- **Devolver el mismo R2 en el reintento:** obligaría a guardar el token en claro o cifrado; hoy solo se guarda su HMAC.

## Consecuencias

- **Compromiso del margen:** quien robe un token y lo use dentro de los 30 s siguientes a su uso legítimo obtiene un par válido, como mucho 3 veces. Fuera del margen, la detección del robo sigue igual.
- **El token de acceso sigue valiendo hasta 15 minutos** después de cerrar sesión o de revocar la familia: es un JWT que la API verifica sin consultar la base. Para cortar antes haría falta una lista de revocación o tokens más cortos; hoy no se justifica.
- **`refresh_tokens.parent_id`** permite contar las reemisiones y reconstruir la cadena de una sesión.
