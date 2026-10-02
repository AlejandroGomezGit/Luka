# Sincronización y API

El dispositivo envía operaciones idempotentes desde una cola local y recibe cambios por cursor; los conflictos se resuelven campo a campo con un reloj lógico híbrido que el servidor acota.

## Garantías de la sincronización

El motor promete cinco cosas y declara tres límites; las pruebas de la última sección existen para demostrar las promesas.

**Lo que garantiza**

1. **Nada se pierde.** Todo cambio queda en la cola local hasta que el servidor confirma que lo aplicó.
2. **Nada se duplica.** Cada operación lleva un id único y el servidor ignora los repetidos.
3. **Convergencia.** Dos dispositivos que reciben las mismas operaciones terminan con el mismo estado, sin importar el orden en que lleguen.
4. **Orden estable.** El servidor numera las operaciones por usuario, así ningún dispositivo se salta cambios.
5. **Funciona sin conexión.** Leer y escribir no dependen de la red; sincronizar es una tarea de fondo.

**Lo que no hace**

- **No es en tiempo real.** Un cambio llega a otro dispositivo en su siguiente sincronización: al abrir la app, al volver la red o al refrescar. En V2 una notificación silenciosa puede disparar la sincronización.
- **No mezcla texto.** Si dos dispositivos editan la misma nota, gana una de las dos versiones completas; no se combinan frases.
- **No sincroniza saldos.** Cada dispositivo los recalcula desde los movimientos.

### Reloj lógico híbrido

Para decidir qué edición es más reciente sin confiar en el reloj del celular, cada cambio lleva un reloj lógico híbrido (HLC): la hora de pared en milisegundos, un contador y el id del dispositivo. Se guarda como texto de ancho fijo, por ejemplo `1790000000000-0002-a1b2c3d4`, y se ordena por texto.

1. **Evento local.** `ms = max(ms local, hora de pared)`; si `ms` no cambió, el contador sube en uno, y si cambió, vuelve a cero.
2. **Al recibir un reloj remoto.** `ms = max(ms local, ms remoto, hora de pared)` y el contador se ajusta para quedar por encima de los relojes que empatan en `ms`.
3. **Comparación.** Primero `ms`, luego el contador y, para desempatar siempre igual, el id del dispositivo.
4. **El servidor acota.** Al recibir una operación reemplaza `ms` por el menor entre `ms` y su propia hora. Así un reloj adelantado no gana todos los conflictos para siempre.
5. **El dispositivo adopta el reloj más alto que ve** en las respuestas, para que sus ediciones nuevas siempre queden por encima de lo que ya conoce.

## Flujo de sincronización

Un gasto creado sin conexión en el dispositivo A viaja al servidor en una sola llamada y llega al dispositivo B por cursor, sin que los dos dispositivos tengan que coordinarse entre sí.

&#91;embedded content: secuencia de sincronización · 2 dispositivos, API y PostgreSQL\]

La llamada del paso 2 es la de CU-21. El servidor aplica y numera cada operación dentro de una transacción (paso 3); el dispositivo B recibe el estado actual de los registros posteriores a su cursor y los fusiona campo a campo con el mismo algoritmo (paso 11).

## Operaciones y conflictos

Una operación describe qué campos cambió un dispositivo, cada uno con su reloj; el servidor fusiona cada campo por separado y devuelve el estado resultante del registro. Este es el formato de una edición de movimiento:

```json
{
  "opId": "0192f6c4-7a1e-7b3c-9d2e-5f4a8b1c2d3e",
  "entity": "transactions",
  "entityId": "0192f6c4-5b2a-7c11-8a90-1d2e3f4a5b6c",
  "baseVersion": 3,
  "fields": {
    "amount_minor": { "value": -4250000, "hlc": "1790000000000-0002-a1b2c3d4" },
    "note": { "value": "Mercado del mes", "hlc": "1790000000000-0001-a1b2c3d4" }
  }
}
```

Eliminar es una operación más: cambia el campo `deleted_at`, por eso se fusiona como cualquier otro campo. `baseVersion` es la versión que el dispositivo conocía; sirve para detectar que hubo cambios en medio, no para rechazar la operación.

### Grupos de campos

Algunos campos solo tienen sentido juntos, y fusionarlos por separado produciría registros incoherentes, como un monto de una edición con una cuenta de otra. Esos campos se fusionan como un grupo: gana el grupo completo con el reloj mayor.

- **Importe:** `kind`, `amount_minor`, `to_amount_minor`, `currency`, `account_id`, `to_account_id`.
- **Clasificación:** `category_id`, `category_source`, `category_confidence`.
- **Todos los demás campos** se fusionan de uno en uno.

### Reglas por situación

| Situación | Regla | Resultado |
| --- | --- | --- |
| La misma operación llega dos veces | El `opId` repetido se ignora | Mismo estado, respuesta `duplicate` |
| Dos dispositivos cambian campos distintos del mismo registro | Se combinan los dos cambios | No se pierde ninguno |
| Dos dispositivos cambian el mismo campo o grupo | Gana el reloj mayor; el empate lo decide el id del dispositivo | El cambio perdedor queda en `conflicts` |
| Un dispositivo elimina y otro edita | Ambos cambios se aplican: la eliminación es un campo más | El registro queda oculto, con la edición, y recuperable 30 días |
| Se restaura un registro eliminado | Es un cambio de `deleted_at` a nulo con un reloj nuevo | Gana si su reloj supera el de la eliminación |
| El mismo registro se crea dos veces con el mismo id | Se trata como un `upsert` y se fusiona campo a campo | Reintentos tras un fallo parcial no duplican |
| Una categoría predefinida se crea en dos dispositivos | Tiene el mismo UUID v5, así que es el mismo registro | Se fusiona sin duplicar |
| Un movimiento apunta a una cuenta o categoría que aún no llegó | Las operaciones de un lote se aplican en orden de creación y la referencia se valida contra el estado actual más el propio lote | Si falta, `rejected` con `reference_missing`, y se reintenta tras la próxima descarga |
| Un movimiento nuevo cae en una cuenta archivada en otro dispositivo (INV-06) | Se compara el reloj de la operación con el del archivado | Se acepta si se creó antes del archivado; si no, `rejected` con `invariant_violated` |
| La fusión deja un registro que viola un invariante | El servidor valida el registro resultante | La operación se rechaza entera y no se aplica a medias |

## Endpoints de la API

El MVP necesita 16 endpoints, y uno solo, `POST /v1/sync`, mueve todos los datos de negocio; el resto cubre sesión, perfil, dispositivos, adjuntos y salud del servicio.

| Método y ruta | Qué hace | Acceso | Fase |
| --- | --- | --- | --- |
| `POST /v1/auth/register` | Crea la cuenta con correo y contraseña y registra la aceptación de términos | Público | MVP |
| `POST /v1/auth/login` | Inicia sesión y devuelve token de acceso y de refresco | Público | MVP |
| `POST /v1/auth/apple` | Entra con Sign in with Apple | Público | MVP |
| `POST /v1/auth/refresh` | Rota el token de refresco | Token de refresco | MVP |
| `POST /v1/auth/logout` | Revoca el token de refresco del dispositivo | Sesión | MVP |
| `POST /v1/auth/password/forgot` | Envía el correo de recuperación | Público | MVP |
| `POST /v1/auth/password/reset` | Cambia la contraseña con el código del correo | Público | MVP |
| `GET /v1/me` | Devuelve el perfil y las preferencias | Sesión | MVP |
| `PATCH /v1/me` | Cambia nombre, moneda base e idioma | Sesión | MVP |
| `DELETE /v1/me` | Elimina la cuenta y todos los datos (RF-03) | Sesión y reautenticación | MVP |
| `POST /v1/devices` | Registra o actualiza el dispositivo: versión y token push | Sesión | MVP |
| `POST /v1/sync` | Envía operaciones y recibe los cambios posteriores al cursor | Sesión | MVP |
| `GET /v1/sync/snapshot` | Descarga completa y paginada para un dispositivo nuevo o con cursor vencido | Sesión | MVP |
| `POST /v1/attachments` | Registra un adjunto y devuelve la URL prefirmada de subida | Sesión | MVP |
| `GET /v1/attachments/{id}/url` | Devuelve la URL prefirmada de lectura | Sesión | MVP |
| `GET /healthz` y `GET /readyz` | Estado del proceso y de sus dependencias, para el balanceador | Red interna | MVP |
| `DELETE /v1/devices/{id}` | Revoca un dispositivo | Sesión | V2 |
| `GET /v1/export` | Exporta todos los datos del usuario (RF-04) | Sesión | V2 |
| `POST /v1/imports` | Sube un extracto CSV para importarlo (CU-26) | Sesión | V2 |
| `/v1/admin/*` | Panel de operación (CU-30 y CU-31) | Rol de operador | V2 |

**Convenciones**

- **Formato.** JSON en UTF-8; fechas en ISO 8601 con UTC; ids como UUID.
- **Versión.** Va en la ruta (`/v1`); un cambio que rompe a clientes viejos crea `/v2` y la versión anterior se mantiene mientras haya instalaciones que la usen.
- **Errores.** Siempre `application/problem+json` (RFC 9457), con un campo `code` estable que la app interpreta.
- **Trazabilidad.** Cada respuesta incluye `X-Request-Id`, el mismo id que aparece en los logs y las trazas.
- **Paginación.** Por cursor opaco, nunca por número de página.
- **Límites de tasa.** Por IP y por usuario; al excederlos, `429` con `Retry-After`. Los endpoints de autenticación tienen un límite más estricto.

## Errores, reintentos y límites

Cada operación recibe su propio resultado y cada error HTTP tiene una reacción definida en la app, así ningún fallo deja la cola en un estado ambiguo.

### Resultado por operación

| Estado | Significado | Qué hace la app |
| --- | --- | --- |
| `applied` | Se aplicó sin conflicto | La marca como sincronizada |
| `duplicate` | El `opId` ya se conocía | La trata como éxito |
| `merged` | Hubo un conflicto y el servidor lo resolvió | Adopta el registro resultante y puede avisar al usuario (CU-22) |
| `rejected` | No se pudo aplicar; trae un `code` como `validation_failed`, `reference_missing` o `invariant_violated` | La marca «con error» y sigue con el resto; solo `reference_missing` se reintenta sola tras la siguiente descarga |

### Errores del endpoint

| Respuesta | Causa | Reacción de la app |
| --- | --- | --- |
| `401` | Token de acceso vencido | Refresca el token y reintenta una vez |
| `403` | Dispositivo revocado (device\_revoked) o cuenta eliminada (account\_deleted) | Con device\_revoked pide iniciar sesión de nuevo y conserva los datos locales; con account\_deleted borra los datos locales |
| `410 cursor_expired` | El cursor es más viejo que la retención de 30 días | Descarga completa por `/v1/sync/snapshot` y reenvía su `outbox` |
| `413` | Lote demasiado grande | Divide el lote y reintenta |
| `426 upgrade_required` | La `schema_version` ya no se soporta | Pide actualizar la app sin tocar la cola |
| `429` | Límite de tasa | Espera el tiempo de `Retry-After` |
| `5xx` o sin red | Falla del servidor o de la conexión | Reintenta con espera exponencial y variación aleatoria, siempre con los mismos `opId` |

### Límites iniciales

Son valores de partida que se ajustan con las pruebas de carga.

| Límite | Valor |
| --- | --- |
| Operaciones por lote | 100 |
| Tamaño máximo de un lote | 1 MB |
| Registros por página de descarga completa | 500 |
| Espera entre reintentos | De 1 s a 5 min, con variación aleatoria |
| Sincronizaciones simultáneas por dispositivo | 1, con un candado local |
| Espera antes de sincronizar tras un cambio | 2 s, para agrupar cambios seguidos |

## Contrato OpenAPI de la sincronización

El contrato de `POST /v1/sync` es la pieza que la app y la API deben cumplir al pie de la letra; este fragmento es el punto de partida. En el código, los esquemas se escriben una vez con Zod en `packages/contracts` y el archivo OpenAPI completo se genera desde ahí.

```yaml
openapi: 3.1.0
info:
  title: Luka API
  version: 1.0.0
paths:
  /v1/sync:
    post:
      operationId: sync
      summary: Envía operaciones y recibe los cambios posteriores al cursor
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SyncRequest'
      responses:
        '200':
          description: Resultado de cada operación y cambios de otros dispositivos
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SyncResponse'
        '401': { $ref: '#/components/responses/Problem' }
        '410': { $ref: '#/components/responses/Problem' }
        '413': { $ref: '#/components/responses/Problem' }
        '426': { $ref: '#/components/responses/Problem' }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  responses:
    Problem:
      description: Error con formato problem+json (RFC 9457)
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'
  schemas:
    SyncRequest:
      type: object
      required: [deviceId, schemaVersion, cursor, hlc, ops]
      properties:
        deviceId: { type: string, format: uuid }
        schemaVersion: { type: integer, minimum: 1 }
        cursor: { type: integer, format: int64, minimum: 0 }
        hlc: { type: string }
        ops:
          type: array
          maxItems: 100
          items: { $ref: '#/components/schemas/Operation' }
    Operation:
      type: object
      required: [opId, entity, entityId, baseVersion, fields]
      properties:
        opId: { type: string, format: uuid }
        entity: { type: string, enum: [accounts, categories, transactions, attachments] }
        entityId: { type: string, format: uuid }
        baseVersion: { type: integer, minimum: 0 }
        fields:
          type: object
          additionalProperties: { $ref: '#/components/schemas/FieldChange' }
    FieldChange:
      type: object
      required: [value, hlc]
      properties:
        value: {}
        hlc: { type: string }
    SyncResponse:
      type: object
      required: [results, changes, cursor, hasMore, serverHlc]
      properties:
        results:
          type: array
          items: { $ref: '#/components/schemas/OperationResult' }
        changes:
          type: array
          items: { $ref: '#/components/schemas/Change' }
        cursor: { type: integer, format: int64 }
        hasMore: { type: boolean }
        serverHlc: { type: string }
    OperationResult:
      type: object
      required: [opId, status]
      properties:
        opId: { type: string, format: uuid }
        status: { type: string, enum: [applied, duplicate, merged, rejected] }
        code: { type: string }
        record: { type: object }
    Change:
      type: object
      required: [serverSeq, entity, entityId, record]
      properties:
        serverSeq: { type: integer, format: int64 }
        entity: { type: string }
        entityId: { type: string, format: uuid }
        record: { type: object }
    Problem:
      type: object
      required: [type, title, status, code]
      properties:
        type: { type: string, format: uri }
        title: { type: string }
        status: { type: integer }
        detail: { type: string }
        code: { type: string }
```

**Cómo leerlo.** La respuesta devuelve el estado actual de cada registro que cambió desde el cursor, con sus relojes por campo, y no la lista de operaciones; la app lo fusiona con el mismo algoritmo de siempre, por eso recibir un registro dos veces es inofensivo. En V2 la lista de entidades suma `budgets`, `recurring_rules`, `category_rules` e `import_batches`.

## Cómo se prueba el motor

La sincronización es la pieza donde un error pasa desapercibido hasta que alguien pierde un gasto, por eso se prueba en cinco niveles y el motor no se da por terminado hasta que las pruebas de propiedades y la simulación pasen en CI.

| Nivel | Qué verifica | Herramienta | Cuándo corre |
| --- | --- | --- | --- |
| Propiedades | Idempotencia, orden de llegada irrelevante, convergencia de dos réplicas, reloj que nunca retrocede e invariantes INV-01 a INV-07 tras cualquier secuencia de operaciones válidas | fast-check sobre `packages/domain` | Cada pull request |
| Simulación multidispositivo | De dos a cuatro dispositivos con relojes desfasados, ediciones al azar y una red que pierde, duplica y reordena mensajes; al final todos coinciden con el servidor | Simulador determinista propio con semilla reproducible | 50 semillas en cada PR y 1 000 de noche; cada fallo guarda su semilla |
| Integración | `POST /v1/sync` contra PostgreSQL real: índice único de idempotencia, dos sincronizaciones simultáneas sin saltos de secuencia, aislamiento entre usuarios, `410` por cursor vencido y migraciones | `inject` de Fastify y Testcontainers, con Toxiproxy para cortes de red | Cada pull request |
| E2E móvil | Crear gastos en modo avión, volver la red y ver el indicador en «al día»; el mismo flujo tras cerrar la app a mitad | Maestro en el simulador de iOS | Antes de cada versión |
| Carga | 1 000 usuarios simulados sincronizando con p95 menor a 300 ms (RNF-03) | k6 | De noche y antes de cada lanzamiento |

**Qué cuenta como fallo de convergencia.** Cualquier ejecución de la simulación donde, tras vaciar todas las colas y recibir todos los cambios, dos dispositivos difieran entre sí o del servidor en un solo campo.

**Cómo se reproduce un fallo.** La simulación imprime su semilla; con ella, el mismo orden de eventos se vuelve a ejecutar paso a paso en la máquina del desarrollador.
