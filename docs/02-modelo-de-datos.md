# Modelo de datos

El modelo usa los mismos conceptos en el celular (SQLite) y en el servidor (PostgreSQL): identificadores generados en el cliente, dinero en enteros y marcas de versión en cada registro para poder sincronizar.

## Principios del modelo

Siete reglas valen para todas las tablas y evitan los errores más caros de corregir después.

1. **Identificadores generados en el cliente.** Cada registro nace con un UUID v7 creado en el celular. Así se puede crear sin conexión y reintentar sin duplicar; además, UUID v7 ordena por tiempo y mantiene compactos los índices de PostgreSQL.
2. **Dinero en enteros.** Los montos se guardan como enteros en la unidad menor de la moneda (`amount_minor`) junto al código ISO 4217, nunca como decimales flotantes. COP tiene 2 decimales en el estándar, aunque la app muestre pesos sin centavos. Al escribir un monto, punto y coma valen igual: en COP, que se escribe en pesos enteros, un separador seguido de exactamente 3 dígitos agrupa miles («12.500» y «12,500» son 12 500 pesos); en USD y EUR, el último separador seguido de 1 o 2 dígitos es el decimal. Se muestran con punto de miles y coma decimal: «$ 12.500», «US$ 1.234,56». En el formulario la persona solo escribe dígitos: los puntos de miles se ponen solos mientras escribe, y en USD y EUR la coma abre los centavos.
3. **Monto con signo.** El usuario escribe un número positivo y el tipo de movimiento fija el signo al guardar: los gastos son negativos y los ingresos positivos. El saldo de una cuenta es su saldo inicial más la suma de sus movimientos.
4. **Fecha local y fecha en UTC.** `occurred_on` es la fecha que ve el usuario y la que agrupa los reportes; `created_at` y `updated_at` son instantes en UTC. Así un gasto de las 11 p. m. no cae en el mes siguiente.
5. **Borrado lógico.** `deleted_at` marca el registro y este se conserva 30 días antes de la purga definitiva, salvo que el usuario elimine su cuenta (RF-03), caso en el que se borra todo de inmediato.
6. **Versión y reloj por registro.** Cada registro sincronizable lleva `version`, que asigna el servidor, y `field_clocks`, el reloj lógico de cada campo, para resolver conflictos campo a campo (documento 4).
7. **Todo pertenece a un usuario.** Cada tabla de negocio tiene `user_id` y toda consulta del servidor lo filtra; PostgreSQL añade seguridad a nivel de fila como segunda barrera.

## Diagrama entidad-relación

Siete tablas forman el MVP y los movimientos son el punto de unión con cuentas, categorías y adjuntos.

&#91;embedded content: diagrama entidad-relación · 7 tablas del MVP\]

Todas las tablas de negocio llevan `user_id` y pertenecen a un usuario, por eso esas líneas no se dibujan. Las flechas van del lado «1» al lado «N»; una transferencia usa dos veces la relación con `accounts`, como origen y como destino.

## Entidades del MVP

Siete entidades cubren el MVP: usuarios, dispositivos, cuentas, categorías, movimientos, adjuntos y consentimientos; esta última se describe en la sección siguiente. Cuentas, categorías, movimientos y adjuntos son sincronizables y comparten un grupo de columnas comunes que no se repite en cada tabla.

### Columnas comunes de las tablas sincronizables

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | UUID v7 generado en el cliente; clave primaria |
| `user_id` | uuid | Dueño del registro; referencia a `users` |
| `created_at` | timestamptz | Instante de creación en el cliente, acotado por el servidor |
| `updated_at` | timestamptz | Último cambio aplicado, con la hora del servidor |
| `deleted_at` | timestamptz, nulo | Borrado lógico |
| `version` | integer | Contador por registro; el servidor lo aumenta con cada cambio aplicado |
| `field_clocks` | jsonb | Reloj lógico de cada campo o grupo de campos; lo mantiene el servidor y se copia al dispositivo |

### users (solo servidor)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | Clave primaria |
| `email` | citext, único, nulo | Nulo si la persona solo entra con Apple |
| `apple_sub` | text, único, nulo | Identificador estable de Sign in with Apple |
| `password_hash` | text, nulo | Argon2id; nulo si solo entra con Apple |
| `display_name` | text | Nombre para mostrar |
| `base_currency` | char(3) | Moneda de los resúmenes; COP por defecto |
| `locale` | text | `es-CO` por defecto |
| `created_at`, `deleted_at` | timestamptz | La cuenta eliminada se purga según RF-03 |

### devices

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | Se genera al instalar la app |
| `user_id` | uuid | Dueño del dispositivo |
| `platform` | text | `ios` por ahora |
| `app_version` | text | Para atender errores por versión |
| `push_token` | text, nulo | Token de APNs; llega con las alertas de V2 |
| `last_seen_at` | timestamptz | Última sincronización |
| `revoked_at` | timestamptz, nulo | Un dispositivo revocado ya no puede sincronizar |

### accounts

| Campo | Tipo | Notas |
| --- | --- | --- |
| `name` | text | Nombre visible |
| `type` | enum | `cash` (Efectivo), `savings` (Cuenta de ahorros), `checking` (Cuenta corriente), `credit_card` (Tarjeta de crédito), `other` (Otra: Nequi, Daviplata…) |
| `currency` | char(3) | No cambia una vez que la cuenta tiene movimientos |
| `opening_balance_minor` | bigint | Saldo inicial con signo. La persona lo escribe en cero o positivo; en una tarjeta de crédito escribe la «Deuda actual» y se guarda en negativo. Se puede corregir después |
| `color`, `icon` | text | `icon`: un emoji; `color`: token de la paleta (ver Categorías predefinidas) |
| `sort_order` | integer | Orden en la lista; una cuenta nueva va al final (máximo + 1). Por ahora no hay pantalla para reordenar |
| `archived_at` | timestamptz, nulo | Una cuenta archivada conserva su historial y su saldo, pero no se ofrece para movimientos nuevos. El nombre es único solo entre cuentas activas: para desarchivar una cuyo nombre ya usa una activa, primero hay que renombrarla |
| card\_last4 | text\[\], nulo | V2: últimos 4 dígitos de las tarjetas de la cuenta; asignan a qué cuenta pertenece un mensaje capturado |

### categories

| Campo | Tipo | Notas |
| --- | --- | --- |
| `parent_id` | uuid, nulo | Una categoría puede tener subcategorías, con un máximo de dos niveles |
| `name` | text | Nombre visible |
| `kind` | enum | `expense` o `income` |
| `color`, `icon` | text | `icon`: un emoji; `color`: token de la paleta (ver Categorías predefinidas) |
| `system_key` | text, nulo | Clave estable de las categorías predefinidas, por ejemplo `food.groceries`; nulo si la creó el usuario |
| `archived_at` | timestamptz, nulo | Archivar no altera los movimientos antiguos |

### transactions

| Campo | Tipo | Notas |
| --- | --- | --- |
| `account_id` | uuid | Cuenta de origen |
| `to_account_id` | uuid, nulo | Cuenta de destino; solo en transferencias |
| `kind` | enum | `expense`, `income`, `transfer`, `adjustment` |
| `amount_minor` | bigint | Con signo, en la moneda de `account_id`; nunca cero |
| `to_amount_minor` | bigint, nulo | Positivo, en la moneda de `to_account_id`; solo en transferencias |
| `currency` | char(3) | Copia de la moneda de la cuenta de origen al registrar; protege el histórico |
| `occurred_on` | date | Fecha local que ve el usuario, armada con los componentes locales de la fecha y el reloj inyectado (nunca con `toISOString`). No puede ser futura: error «La fecha no puede ser futura». La lista ordena por esta fecha y desempata por `created_at` |
| `occurred_at` | timestamptz, nulo | Hora exacta, si el usuario la fija |
| `category_id` | uuid, nulo | Opcional: sin categoría hasta que se asigne. Si la tiene, es siempre una subcategoría (INV-04). En los reportes (T-017) los movimientos sin categoría salen como «Sin categoría» |
| `category_source` | enum | `user`, `rule`, `model`, `import`; solo `user` alimenta el aprendizaje |
| `category_confidence` | smallint, nulo | De 0 a 100; solo si la asignó el modelo |
| `merchant` | text, nulo | Comercio o descripción corta |
| `note` | text, nulo | Nota libre |
| `tags` | text\[\] | Etiquetas como las escribe la persona («Viaje a Medellín»), sin espacios de sobra; se comparan sin mayúsculas ni tildes para buscar y para quitar repetidas. Hasta 10 de hasta 30 caracteres (`parseTags` y `tagErrors` en `packages/domain`). En SQLite se guardan como JSON |
| `source` | enum | `manual`, `import_csv`, `import_pdf`, `message_paste`, `message_shortcut`, `bank`, `receipt_scan`, `recurring` |
| `review_status` | enum | `confirmed` o `pending_review`; lo que llega de mensajes, importaciones o bancos entra como `pending_review` y solo cuenta al confirmarse (INV-09) |
| `external_id` | text, nulo | Identificador del banco o huella de la fila importada o del mensaje, para detectar duplicados entre fuentes |
| `import_batch_id` | uuid, nulo | V2: importación de la que viene |
| `recurring_rule_id` | uuid, nulo | V2: regla que lo generó |

### attachments

| Campo | Tipo | Notas |
| --- | --- | --- |
| `transaction_id` | uuid | Movimiento al que pertenece |
| `kind` | enum | `receipt` por ahora |
| `mime_type` | text | Por ejemplo `image/jpeg` |
| `size_bytes` | integer | Tamaño del archivo |
| `sha256` | text | Verifica la subida y detecta archivos repetidos |
| `storage_key` | text, nulo | Clave en el almacenamiento de objetos; nulo mientras el archivo solo está en el dispositivo |
| `uploaded_at` | timestamptz, nulo | Nulo hasta que la subida termina |

En el MVP hay una foto de recibo por movimiento (T-018). El archivo vive en `Documents/attachments/<id>.jpg`, con el mismo id de la fila, así que no hace falta una columna con la ruta local: se reduce a 1.600 px en su lado largo y se guarda como JPEG con calidad 0,7; volver a codificarla deja fuera el GPS y los demás metadatos (prueba de concepto de T-018, con JPEG y HEIC). Con `storage_key` y `uploaded_at` nulos la foto está pendiente de subir (T-035). Quitar o reemplazar la foto, o borrar su movimiento, la borra de forma lógica; Deshacer devuelve solo lo que se borró con el movimiento, en el mismo instante. El archivo se borra del iPhone cuando ya no se puede deshacer (desaparece el aviso o se abre la app); la fila sigue el borrado lógico de 30 días.

## Entidades de V2 y V3

Ocho entidades más aparecen según la fase; solo `consents` es necesaria desde el MVP, para guardar la aceptación de términos y de la política de privacidad.

| Entidad | Fase | Dónde vive | Campos clave | Notas |
| --- | --- | --- | --- | --- |
| `consents` | MVP | Servidor | `purpose` (`terms`, `privacy`, `ai_external`, `bank_connection`), `version`, `granted_at`, `revoked_at` | Sin una fila vigente no se activa la función asociada |
| `budgets` | V2 | Ambos, sincronizable | `category_id` (nulo = total del mes), `month` (primer día), `amount_minor`, `currency` | Un presupuesto por categoría y mes; el consumo se calcula, no se guarda |
| `recurring_rules` | V2 | Ambos, sincronizable | Plantilla del movimiento, `rrule` (RFC 5545), `starts_on`, `ends_on`, `next_run_on`, `paused_at`, `origin` (`user` o `detected`) | El servidor genera las ocurrencias con un id determinista (regla más fecha) para que nunca se dupliquen |
| `category_rules` | V2 | Ambos, sincronizable | `match_type` (`contains`, `equals`, `starts_with`), `pattern`, `category_id`, `priority` | Reglas del usuario; ganan sobre el modelo |
| `import_batches` | V2 | Ambos, sincronizable | `source`, `filename`, `status`, `rows_total`, `rows_new`, `rows_duplicate`, `rows_error` | Permite deshacer una importación completa |
| `token_stats` | V2 | Solo dispositivo | `token`, `category_id`, `count` | Conteos del categorizador; se reconstruyen desde los movimientos que el usuario corrigió, por eso no se sincronizan |
| `bank_connections` | V3 | Solo servidor | `provider`, `provider_connection_id`, `institution_name`, `status`, `consent_expires_at`, `last_synced_at` | Credenciales y tokens del agregador cifrados con clave gestionada; nunca llegan al dispositivo |
| captured\_messages | V2 | Solo dispositivo | transaction\_id, sender, text, text\_hash, received\_at, parsed\_ok | Texto original del mensaje, para mostrarlo al revisar y mejorar los lectores; nunca se sincroniza y se borra a los 30 días |

## Tablas de sincronización

Siete tablas de soporte hacen posible el modo sin conexión, la búsqueda y la auditoría de conflictos; ninguna es visible para el usuario.

| Tabla | Dónde | Campos clave | Para qué |
| --- | --- | --- | --- |
| `outbox` | Dispositivo | `op_id` (PK), `entity`, `entity_id`, `op` (`upsert` o `delete`), `patch` (campos cambiados con su reloj), `base_version`, `hlc`, `status` (`pending`, `sent`, `error`), `attempts`, `last_error` | Cola de cambios pendientes; sobrevive al cierre de la app |
| `device_profile` | Dispositivo | `device_id` (PK), `user_id`, `created_at` | Una sola fila creada en el primer arranque (T-010): la identidad local con la que se escriben los datos antes de tener servidor. Al registrarse, la app envía ese mismo `user_id` al servidor (ADR-008), así nada se reescribe |
| `transaction_search` | Dispositivo | `transaction_id` (PK, clave foránea a `transactions` con borrado en cascada), `content` | Texto de búsqueda de cada movimiento (HU-05, HU-06): nota, comercio y etiquetas en minúsculas y sin tildes. Tabla derivada y solo local: se escribe al crear o editar, cada arranque completa la que falte por lotes de 500 después del primer render (idempotente), se puede reconstruir entera desde `transactions` y nunca se sincroniza |
| `sync_state` | Dispositivo | `device_id`, `cursor`, `last_sync_at`, `hlc`, `schema_version` | Una sola fila: hasta dónde llegó este dispositivo |
| `user_sync_state` | Servidor | `user_id`, `last_seq` | Contador de secuencia por usuario |
| `sync_ops` | Servidor | `server_seq`, `user_id`, `device_id`, `op_id`, `entity`, `entity_id`, `op`, `changes` (jsonb), `resulting_version`, `hlc`, `applied_at` | Registro de operaciones aplicadas; solo se agrega, nunca se edita |
| `conflicts` | Servidor | `id`, `user_id`, `entity`, `entity_id`, `field`, `winning_op_id`, `losing_op_id`, `losing_value` (jsonb), `resolved_at` | Auditoría de cada campo que perdió un conflicto |

**Pregunta abierta para T-019.** Si la persona inicia sesión en una cuenta que ya existe desde un dispositivo con datos locales, su `user_id` local no coincide con el del servidor. Hay que decidir si esos datos se fusionan con la cuenta (reescribiendo `user_id` y los UUID v5 de las categorías predefinidas, que dependen de él) o se descartan con aviso.

**Por qué hay un contador por usuario.** Un `bigserial` global puede entregar números fuera del orden en que se confirman las transacciones, y un dispositivo que sincroniza en ese instante se saltaría cambios para siempre. Por eso cada operación toma su número de `user_sync_state` bajo un bloqueo de fila dentro de la misma transacción que la aplica.

**Idempotencia.** `sync_ops` tiene un índice único sobre `(user_id, op_id)`: reenviar una operación ya aplicada devuelve éxito sin cambiar nada.

**Retención.** `sync_ops` y los registros con `deleted_at` se conservan 30 días. Un dispositivo cuyo cursor es más antiguo recibe `410 cursor_expired` y hace una descarga completa, sin perder las operaciones que aún tiene en su `outbox`.

## Reglas e invariantes

La base de datos rechaza los estados imposibles y la capa de dominio los valida antes, así un error de la app o de un reintento no deja datos corruptos. Cada invariante se verifica en tres sitios cuando es posible: el paquete de dominio del cliente, la API y un `CHECK` de PostgreSQL.

| ID | Invariante | Dónde se aplica |
| --- | --- | --- |
| INV-01 | `amount_minor` no es cero y su signo depende del tipo: negativo en `expense` y `transfer`, positivo en `income`, cualquiera en `adjustment` | Dominio, API, `CHECK` |
| INV-02 | Una transferencia exige `to_account_id` distinto de `account_id` y `to_amount_minor` positivo; los demás tipos los dejan nulos | Dominio, API, `CHECK` |
| INV-03 | Si ambas cuentas tienen la misma moneda, `to_amount_minor` es igual a `-amount_minor` | Dominio, API |
| INV-04 | La categoría coincide con el tipo: `expense` con categorías de gasto e `income` con categorías de ingreso, y siempre es una subcategoría, nunca la principal; transferencias y ajustes no llevan categoría | Dominio, API |
| INV-05 | `currency` del movimiento es la de su cuenta al crearlo, y la moneda de una cuenta con movimientos no cambia; cuentan también los borrados, porque «Deshacer» o la sincronización pueden devolverlos | Dominio, API |
| INV-06 | Una cuenta archivada no acepta movimientos nuevos, pero conserva los existentes: un movimiento que ya estaba en ella sigue editable mientras no cambie de cuenta; pasarlo a otra cuenta archivada se rechaza | Dominio, API |
| INV-07 | Las categorías con `system_key` no se eliminan: solo se renombran o se archivan | Dominio, API |
| INV-08 | Ningún dato de otro `user_id` se lee ni se escribe | Filtros de la API y seguridad a nivel de fila (T-026): la API se conecta como `luka_app` (sin superusuario ni `BYPASSRLS`) y cada petición corre en una transacción con `app.user_id` fijado por `withUser`; cada tabla tiene RLS forzada con una política `USING` y `WITH CHECK` sobre `app.current_user_id()`, y las claves foráneas entre tablas del usuario son compuestas (`user_id`, `id`), porque PostgreSQL comprueba las claves por encima de la RLS. Una prueba de catálogo rechaza tablas sin RLS forzada, políticas abiertas y privilegios de más |
| INV-09 | Un movimiento «por revisar» no entra en saldos, presupuestos ni reportes hasta que se confirma | Dominio, API |

### Saldo de una cuenta

El saldo nunca se guarda como dato fuente: se calcula sumando los movimientos vigentes y confirmados (sin eliminados ni «por revisar», INV-09). Por ahora el dispositivo lo calcula al leer, con una consulta sobre los índices de `account_id` y `to_account_id`; la prueba de 10 000 movimientos de T-016 mostró que no hace falta una caché (ver Consultas críticas). El saldo calculado puede ser negativo. En una tarjeta de crédito, un saldo negativo se muestra como «Debes $ X» y uno positivo como «A favor $ X». En las demás cuentas, un saldo negativo se muestra con su signo en el color de alerta y la ayuda «Saldo negativo: revisa los movimientos o corrige el saldo inicial», en las listas de cuentas y en «Saldo de la cuenta» del formulario; VoiceOver lo lee como «saldo negativo, menos 25.000 pesos». Mientras llega el ajuste de saldo (CU-07, V2), se corrige editando el saldo inicial (T-046).

```latex
\text{saldo}(c) = \text{opening}_c + \sum_{t:\ \text{account}_t = c} \text{amount}_t + \sum_{t:\ \text{to\_account}_t = c} \text{to\_amount}_t
```

El MVP no convierte monedas: los resúmenes se agrupan por moneda. La conversión a la moneda base llega en V2 con una tabla de tasas de cambio.

### Consultas críticas e índices

| Consulta | Índice o técnica | Dónde |
| --- | --- | --- |
| Lista de movimientos paginada | Índice `(user_id, occurred_on DESC, id)` parcial sobre `deleted_at IS NULL`; orden por fecha descendente y, en el mismo día, por id descendente (UUID v7: lo último registrado primero); paginación por llave con fecha e id, no por `OFFSET`. Con 10 000 movimientos la primera página tarda 0,52 ms en el simulador iPhone 17 (SQLite nativo) | Ambos |
| Resumen mensual por categoría | Índice `(user_id, occurred_on, category_id)` y suma agrupada por tipo y categoría con el rango de fechas del mes. En el dispositivo SQLite prefiere `transactions_list`, que también empieza por `user_id` y `occurred_on` y ya excluye los borrados; una prueba comprueba que el plan busca por índice con ese rango y no recorre la tabla. Sin caché: con 10 000 movimientos, un mes completo (422 movimientos) tarda 3,14 ms en el simulador iPhone 17 y 2,46 ms en sql.js, y el mes en curso 2,85 ms y 2,21 ms (mediana de 21, T-017). Las subcategorías se suman a su principal en la app | Ambos |
| Saldo de una cuenta | Índices sobre `account_id` y `to_account_id`; sin caché: con 10 000 movimientos la suma tarda 0,58 ms en el simulador iPhone 17 y 1,65 ms en sql.js (T-016) | Ambos |
| Búsqueda por texto | `LIKE` escapado (`%`, `_` y `\`) sobre `transaction_search` (nota, comercio y etiquetas normalizados), más los ids de las cuentas y categorías cuyo nombre coincide, en la misma consulta. FTS5 está en el `expo-sqlite` de Expo Go, pero no en sql.js, donde corren las pruebas; con 10 000 movimientos `LIKE` tarda 1,31 ms recorriendo todo y 0,24 ms para 50 resultados en el simulador, así que no hace falta (T-016) | Dispositivo |
| Cambios desde un cursor | Índice `(user_id, server_seq)` en `sync_ops` | Servidor |
| Duplicados al importar | Índice único parcial `(user_id, account_id, external_id)` donde `external_id` no es nulo | Servidor |

## PostgreSQL y SQLite

El esquema lógico es el mismo en el servidor y en el dispositivo; solo cambian los tipos físicos, y el paquete de dominio se encarga de convertirlos en un único lugar.

| Concepto | PostgreSQL | SQLite (dispositivo) |
| --- | --- | --- |
| Identificador | `uuid` | `TEXT` con el UUID en minúsculas |
| Instante en UTC | `timestamptz` | `INTEGER` en milisegundos desde 1970 |
| Fecha local | `date` | `TEXT` en formato `AAAA-MM-DD` |
| Montos | `bigint` | `INTEGER` de 64 bits |
| Enumeraciones | `enum` o `text` con `CHECK` | `TEXT` con `CHECK` |
| Datos flexibles | `jsonb` | `TEXT` con JSON y funciones `json_*` |
| Listas de etiquetas | `text[]` | `TEXT` con arreglo JSON |
| Correo sin distinguir mayúsculas | `citext` | No aplica: `users` solo vive en el servidor |
| Booleanos | `boolean` | `INTEGER` 0 o 1 |

### Migraciones

- **Una sola fuente del esquema.** El esquema se declara con Drizzle ORM en TypeScript, una vez para PostgreSQL y otra para SQLite, y `drizzle-kit` genera migraciones SQL versionadas.
- **Expandir y luego contraer.** Una columna se agrega primero, se deja de usar en una versión y se elimina en una posterior; así una versión vieja de la app sigue funcionando mientras llega la actualización.
- **Servidor.** Las migraciones corren en el despliegue, antes de arrancar la versión nueva de la API.
- **Dispositivo.** Las migraciones corren al abrir la app, antes de leer la base local; el dispositivo envía su `schema_version` en cada sincronización.
- **Clientes demasiado viejos.** Si la `schema_version` es menor que el mínimo que acepta la API, esta responde `426 upgrade_required` y la app pide actualizar sin perder la cola.
- **En CI.** Cada cambio de esquema se prueba aplicando todas las migraciones desde cero y desde la versión anterior sobre datos de ejemplo.

## Categorías predefinidas

La app crea 21 categorías principales, 15 de gasto y 6 de ingreso, con 54 subcategorías: 75 en total, sembradas en el primer arranque. El id de cada una es un UUID v5 derivado de `user_id` y `system_key`, así dos dispositivos del mismo usuario nunca generan categorías duplicadas. La clave no cambia aunque la categoría se renombre o se traduzca; la lista completa vive en `packages/domain/src/categories.ts`.

- **Dos niveles siempre.** Toda categoría principal tiene subcategorías, al menos `.other`, y un movimiento se asigna siempre a una subcategoría, nunca a la principal (INV-04). El selector muestra siempre los dos niveles.
- **Nombre de `.other`.** «Otros» junto a subcategorías reales; «General» cuando es la única; «Otros gastos» y «Otros ingresos» en `other_expense.other` y `other_income.other`, para no mostrar «Otros gastos › Otros».
- **«General» de una categoría creada por la persona.** Al crear una categoría principal se crea también su «General», cuyo id es `uuid5(id de la principal, "other")`; en una predefinida es la subcategoría `.other` de su clave. Una sola función, `generalCategoryId` en `packages/domain`, aplica las dos reglas, así el categorizador y las reglas de V2 lo encuentran sin depender del nombre.
- **Archivar no va en cascada.** Archivar o desarchivar cambia solo esa fila. Una categoría principal archivada oculta su rama al leer, y una subcategoría archivada aparte sigue archivada aunque se archive y desarchive su principal. Ninguna categoría se elimina: solo se archiva (HU-07, INV-07).
- **Ícono y color.** `icon` guarda un emoji que la persona elige con el teclado del celular (cualquiera; las categorías predefinidas traen el suyo, por ejemplo 🛒 Supermercado) y `color` un token de una paleta fija de 12 colores (`orange`, `teal`…), definida en `packages/domain/src/tokens.ts`. La app traduce cada color en un solo archivo, `src/ui/palette.ts`, con un valor para modo claro y otro para oscuro y contraste de 3:1 o más contra el fondo y contra la tarjeta (WCAG 1.4.11: el color es un elemento gráfico que acompaña al emoji y al nombre, nunca es texto). El ícono es opcional: puede quedar vacío. El emoji se muestra sobre un círculo de su color; un ícono vacío o que no es emoji se muestra con 🏷️ en las listas y como un espacio en blanco en el formulario. Una categoría o cuenta se muestra siempre con su emoji y su nombre, nunca solo con color.
- **Reembolsos.** `refunds` es una categoría de ingreso, porque INV-01 no permite gastos positivos. En el resumen mensual cuentan como ingresos y no restan del gasto que devuelven; la pantalla lo dice en una línea de ayuda (T-017). El resumen cuenta solo gastos e ingresos: transferencias, pagos de tarjeta y ajustes (`adjustment`, CU-07) no cuentan.

| Tipo | Categoría (`system_key`) | Subcategorías (`system_key` después del punto) |
| --- | --- | --- |
| Gasto | Alimentación (`food`) | Supermercado (`groceries`), Restaurantes (`restaurants`), Domicilios (`delivery`), Café y snacks (`coffee_snacks`), Otros (`other`) |
| Gasto | Transporte (`transport`) | Combustible (`fuel`), Transporte público (`public_transit`), Taxi y apps (`taxi_apps`), Parqueadero y peajes (`parking_tolls`), Mantenimiento (`maintenance`), Seguros, SOAT y tecnomecánica (`insurance`), Otros (`other`) |
| Gasto | Vivienda (`housing`) | Arriendo o cuota (`rent_mortgage`), Administración (`building_fees`), Reparaciones (`repairs`), Otros (`other`) |
| Gasto | Servicios (`utilities`) | Energía (`electricity`), Agua (`water`), Gas (`gas`), Internet y telefonía (`internet_phone`), Otros (`other`) |
| Gasto | Salud (`health`) | Citas y medicina prepagada (`appointments_insurance`), Farmacia (`pharmacy`), Deporte (`sports`), Otros (`other`) |
| Gasto | Educación (`education`) | Matrículas y cursos (`tuition_courses`), Libros y materiales (`books_supplies`), Otros (`other`) |
| Gasto | Entretenimiento (`entertainment`) | Salidas (`outings`), Juegos y hobbies (`games_hobbies`), Viajes (`travel`), Otros (`other`) |
| Gasto | Compras (`shopping`) | Ropa (`clothing`), Tecnología (`electronics`), Hogar (`home`), Otros (`other`) |
| Gasto | Cuidado personal (`personal_care`) | General (`other`) |
| Gasto | Suscripciones (`subscriptions`) | General (`other`) |
| Gasto | Deudas y créditos (`debt`) | Intereses y cargos (`interest`), Préstamos (`loans`), Otros (`other`) |
| Gasto | Impuestos y comisiones (`fees`) | 4x1000 (`gmf`), Cuota de manejo (`account_fees`), Impuestos (`taxes`), Otros (`other`) |
| Gasto | Regalos y donaciones (`gifts`) | General (`other`) |
| Gasto | Mascotas (`pets`) | General (`other`) |
| Gasto | Otros gastos (`other_expense`) | Otros gastos (`other`) |
| Ingreso | Salario (`salary`) | General (`other`) |
| Ingreso | Honorarios (`freelance`) | General (`other`) |
| Ingreso | Negocio y ventas (`business`) | General (`other`) |
| Ingreso | Rendimientos (`investment_income`) | General (`other`) |
| Ingreso | Reembolsos (`refunds`) | General (`other`) |
| Ingreso | Otros ingresos (`other_income`) | Otros ingresos (`other`) |
