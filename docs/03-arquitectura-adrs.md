# Arquitectura y ADRs

Luka es un monorepo con una app Expo que funciona sin conexión y una API NestJS sin estado; la sincronización y el categorizador viven en paquetes compartidos para probarlos una sola vez y usarlos en el celular y en el servidor.

## Contexto del sistema

Para el MVP, Luka solo necesita dos servicios externos: Apple, para iniciar sesión, y un servicio de correo para recuperar contraseñas.

&#91;embedded content: contexto C4 · 1 persona, 1 sistema, 4 servicios externos\]

Los trazos discontinuos son de V3: la app funciona completa sin ellos. Apple también entrega las notificaciones push a partir de V2.

## Contenedores

La app intercambia datos solo con la API y con el almacenamiento de objetos; todo lo que no debe esperar una respuesta (recurrentes, alertas, importaciones y purgas) lo hace un worker con una cola.

&#91;embedded content: contenedores C4 · app, API, worker, 3 almacenes y 4 servicios externos\]

La API también valida el token de Sign in with Apple y encola los correos; el diagrama dibuja solo el camino del worker hacia los servicios externos. Los trazos discontinuos son de V3.

## Stack tecnológico

Todo el sistema se escribe en TypeScript, así un solo lenguaje cubre la app, la API y los paquetes compartidos. Cada elección tiene su razón en la tabla y las decisiones más discutibles tienen un ADR más abajo.

| Capa | Tecnología | Motivo |
| --- | --- | --- |
| App móvil | Expo (React Native) con Expo Router | Un solo código y poco contacto con Xcode; EAS Build compila iOS en la nube y Android queda abierto |
| Base de datos local | SQLite con `expo-sqlite` y Drizzle ORM | Funciona sin conexión, consultas SQL rápidas y el mismo estilo de esquema que el servidor |
| Estado de la interfaz | Consultas reactivas de Drizzle y Zustand | La pantalla lee de la base local; Zustand solo guarda estado de la interfaz |
| Secretos en el dispositivo | `expo-secure-store` (Keychain) | Guarda los tokens de sesión fuera de la base de datos |
| Biometría | `expo-local-authentication` | Bloqueo con Face ID |
| Notificaciones | `expo-notifications` con APNs | Alertas de presupuesto en V2 |
| Cámara y OCR | Cámara de Expo y reconocimiento de texto de Apple en el dispositivo, mediante un módulo nativo (por validar) | Leer recibos en V3 sin enviar la foto a nadie |
| API | NestJS con adaptador Fastify | Estructura modular conocida y buen rendimiento |
| Contratos | Zod en un paquete compartido y OpenAPI generado | Un mismo esquema valida la app y el servidor, y documenta la API |
| Base de datos del servidor | PostgreSQL con Drizzle ORM | Transacciones, `jsonb` y seguridad a nivel de fila |
| Trabajos en segundo plano | BullMQ sobre Redis | Recurrentes, alertas, importaciones y purgas |
| Archivos | Almacenamiento de objetos compatible con S3 y URLs prefirmadas | Las imágenes no pasan por la API |
| Autenticación | JWT de vida corta, refresco rotatorio, Argon2id y Sign in with Apple | Control propio con bibliotecas probadas |
| Observabilidad | OpenTelemetry, logs JSON con Pino y Sentry en la app y en la API | Trazas, métricas y errores con un id de correlación |
| Integración y despliegue | GitHub Actions, EAS Build y EAS Submit, Docker | Un pipeline para la API y otro para la app |
| Infraestructura | Terraform | Entornos reproducibles cuando se pase a AWS |
| Pruebas | Jest, React Native Testing Library, `inject` de Fastify con Testcontainers, fast-check, Maestro y k6 | Unitarias, de integración, de propiedades, E2E móviles y de carga |

## Monorepo y paquetes compartidos

Un solo repositorio con pnpm y Turborepo aloja la app, la API y cinco paquetes; la regla clave es que `packages/domain` es TypeScript puro, sin React Native ni Node, para que corra igual en el celular, en el servidor y en las pruebas.

```text
luka/
├── apps/
│   ├── mobile/          # Expo + React Native
│   └── api/             # NestJS
├── packages/
│   ├── domain/          # dinero, fechas, invariantes, reloj lógico, fusión de operaciones, categorizador, lectores de mensajes
│   ├── contracts/       # esquemas Zod y tipos del contrato de la API
│   ├── schema-pg/       # tablas Drizzle de PostgreSQL y migraciones
│   ├── schema-sqlite/   # tablas Drizzle de SQLite y migraciones
│   └── config/          # tsconfig, ESLint y Prettier compartidos
├── infra/               # Terraform y docker-compose
├── docs/                # estos documentos, ADRs y diagramas
├── .github/workflows/   # CI/CD
├── CLAUDE.md
└── README.md
```

- **Dirección de las dependencias.** Las apps dependen de los paquetes; los paquetes nunca dependen de las apps, y `domain` no depende de ningún otro paquete.
- **Qué vive en `domain`.** Todo lo que debe comportarse igual en ambos lados: conversión de dinero, invariantes INV-01 a INV-07, reloj lógico híbrido, fusión de operaciones y categorizador. Así se prueba una sola vez, con pruebas de propiedades.
- **Qué queda fuera.** Nada de acceso a bases de datos, red o pantalla dentro de `domain`: esas piezas entran por interfaces que implementan las apps.
- **Metro con pnpm (R-06), validado en T-007.** Expo SDK 57 soporta las instalaciones aisladas de pnpm y configura Metro solo; no hace falta `metro.config.js` ni `node-linker=hoisted`. El CI empaqueta la app para iOS en cada pull request, así que una regresión se detecta ahí.

## Categorizador propio

El categorizador no es un LLM: es un clasificador de texto pequeño, por capas, que corre en el dispositivo, aprende de las correcciones del usuario y no envía datos a nadie. Entrenar un modelo de lenguaje propio exige datos y costos fuera del alcance de este proyecto, y para textos cortos como el nombre de un comercio un clasificador simple basta y es más rápido, privado y explicable.

| Orden | Capa | Qué hace | Quién la alimenta |
| --- | --- | --- | --- |
| 1 | Normalización | Pasa a minúsculas, quita tildes, números y símbolos, y separa en palabras clave | Código en `packages/domain` |
| 2 | Reglas del usuario (V2) | Coincidencia exacta o por texto contenido, con prioridad máxima | El usuario |
| 3 | Modelo | Naive Bayes multinomial sobre las palabras clave; su conteo inicial viene de un diccionario de comercios y palabras comunes en español | El diccionario y las correcciones del usuario |
| 4 | Umbral de confianza | Si la confianza es baja, no sugiere nada y deja el movimiento sin categoría | Calibración con datos de prueba |

**Cómo aprende.** Cada vez que el usuario asigna o corrige una categoría (`category_source = user`), el modelo suma esas palabras clave a su categoría en `token_stats`. Esa tabla se reconstruye siempre desde el historial, por eso no se sincroniza y no hay estado del modelo que pueda divergir entre dispositivos.

**Cómo arranca.** El diccionario siembra los conteos iniciales como pseudo-conteos, así el modelo es útil desde el primer día y converge a los hábitos de cada persona. El diccionario es un archivo versionado en el repositorio que se distribuye con la app.

**Cómo se mide.** Con un conjunto de prueba etiquetado y reservado, se mide cuántas veces acierta la primera sugerencia; la meta se fija después de la primera medición, no antes. La medición corre en CI para que un cambio de normalización no empeore el acierto sin que nadie lo note.

**Privacidad.** El texto de los movimientos se procesa en el dispositivo y no se comparte. En el futuro, aportar conteos anónimos para mejorar el diccionario sería opcional y requeriría una fila vigente en `consents`.

**Recibos y extractos (V3).** El texto se lee en el dispositivo con el reconocimiento de texto de Apple y se interpreta con reglas para total, fecha y comercio; la categoría la sigue poniendo este mismo clasificador. Un servicio de IA externo solo se usaría como respaldo para documentos que las reglas no entienden, con consentimiento explícito (`ai_external`) y tras revisar las condiciones de retención del proveedor.

## Tubería de captura

Todo movimiento que la persona no escribe a mano entra por una misma tubería, de modo que sumar una fuente nueva, como la conexión bancaria cuando los bancos abran los datos, sea escribir un adaptador y no rehacer la app (ADR-014). Hoy la app no puede leer los SMS por sí sola en iPhone, así que las fuentes de mensajes dependen de que la persona los entregue.

| Fuente | Cómo llega el dato | `source` | Fase |
| --- | --- | --- | --- |
| Pegar o compartir | La persona pega o comparte el texto de un mensaje o correo con Luka | `message_paste` | V2 |
| Atajo de iOS | Una automatización de Atajos envía a Luka el texto de los mensajes que cumplen el filtro del banco | `message_shortcut` | V2 |
| Importar extractos | La persona sube el archivo del banco | `import_csv`, `import_pdf` | V2 y V3 |
| Conexión bancaria | El banco entrega los movimientos mediante las finanzas abiertas | `bank` | Cuando los bancos habiliten el acceso |

### Los siete pasos de la tubería

1. **Adaptador de la fuente.** Convierte la entrada en un elemento capturado: texto sin procesar o movimiento ya estructurado, con su origen y la hora de recepción.
2. **Lector.** Si es texto, el lector del banco extrae monto, comercio, fecha y últimos dígitos de la tarjeta; entiende el formato colombiano de montos. Si no reconoce el formato, el elemento queda como «no reconocido» con el texto a la vista para completarlo o descartarlo.
3. **Huella contra duplicados.** Se calcula `external_id` a partir del banco, el monto, la fecha y hora, los últimos dígitos y el comercio normalizado; si ya existe un movimiento con esa huella en la cuenta, se descarta. Así el mismo gasto que llega por mensaje, por extracto y por banco no se cuenta tres veces.
4. **Cuenta.** Se asigna por los últimos dígitos de la tarjeta vinculada a la cuenta (`card_last4`); si ninguna coincide, se pide elegirla al revisar.
5. **Categoría.** El categorizador propio propone una, con su confianza.
6. **Movimiento «por revisar».** Se crea con `review_status = pending_review` y la fuente correspondiente. El texto original queda solo en el dispositivo (`captured_messages`) y nunca se sincroniza.
7. **Revisión.** La persona lo confirma o lo corrige (CU-29); recién entonces cuenta en saldos y reportes (INV-09) y su corrección alimenta al categorizador.

### Atajo de iOS y configuración guiada

La persona crea una sola vez, con ayuda de Luka, una automatización de Atajos con el disparador «Mensaje», el remitente del banco y una frase como «compra aprobada», y con una acción de Luka que recibe el texto (App Intents). Cada vez que llega un mensaje, la acción corre en el dispositivo, ejecuta los pasos 2 a 6 y devuelve un resumen para la notificación.

La guía de configuración (CU-35) elige el banco, muestra el remitente y la frase sugeridos, abre la app Atajos, explica cada paso con imágenes y ofrece una prueba con un mensaje de ejemplo. Luka no puede crear la automatización por la persona, y si iOS la ejecuta sin pedir confirmación depende de la versión; ambas cosas se validan en el Hito 5 (riesgo R-13).

### Lectores por banco

Cada banco tiene su lector en `packages/domain`, con dos funciones: reconocer si un mensaje es suyo (remitente y frase) y extraer los datos. Los lectores son reglas, no un modelo, y se prueban con muestras reales sin datos personales; agregar un banco es agregar un lector y sus muestras. Cuando los bancos habiliten los datos, el adaptador bancario entrega movimientos ya estructurados y se salta el lector.

## Escalabilidad por etapas

La arquitectura está pensada para que pasar de uso personal a miles de usuarios sea cambiar infraestructura, no reescribir código. Las escalas de la tabla son orientativas y se confirman con las pruebas de carga (RNF-03).

**Lo que ya favorece la escala desde el primer día:**

- La API no guarda estado en memoria, así se multiplican las instancias detrás de un balanceador.
- Los datos de cada usuario son independientes y la sincronización es un registro ordenado por usuario; esto permite particionar por usuario más adelante.
- Las lecturas pesadas (listas, búsquedas, resúmenes) se resuelven en el dispositivo, así que el servidor atiende sobre todo escrituras y sincronización.
- Paginación por llave, no por `OFFSET`; los adjuntos suben directo al almacenamiento de objetos.

| Etapa | Escala orientativa | Qué se hace | Qué todavía no hace falta |
| --- | --- | --- | --- |
| 0. Uso personal y portafolio | Una a diez personas | Un contenedor de API y otro de trabajos, PostgreSQL gestionado pequeño, Redis pequeño, un bucket, Sentry y métricas básicas | Alta disponibilidad, réplicas |
| 1. Lanzamiento | Cientos a pocos miles | Dos o más instancias de API, backups automáticos con restauración probada, limitación de tasa, alertas, entorno de staging | Particiones, caché |
| 2. Crecimiento | Decenas de miles | Pool de conexiones (PgBouncer), caché en Redis para lecturas repetidas, workers separados por cola, CDN para adjuntos, particionar `sync_ops` por tiempo | Separar la sincronización en otro servicio |
| 3. Escala alta | Cientos de miles | Réplicas de lectura, particionar tablas grandes por usuario, servicio de sincronización independiente | Reescribir el modelo de datos |

El paso de una etapa a la siguiente lo decide una métrica, no una fecha: latencia p95 de la API, uso de conexiones de la base de datos y tamaño de `sync_ops`.

## Registro de decisiones (ADRs)

Son 14 decisiones de arquitectura, todas aceptadas por el dueño del proyecto. Esta tabla las resume; cada una tiene su archivo en [`docs/adr/`](adr/) con contexto, decisión, alternativas y consecuencias.

| ID | Decisión | Alternativas descartadas | Motivo principal | Estado |
| --- | --- | --- | --- | --- |
| ADR-001 | App con Expo (React Native) y TypeScript | Swift con SwiftUI, Flutter | Un solo lenguaje con el backend, poco contacto con Xcode y Android abierto | Aceptada |
| ADR-002 | Monorepo con pnpm y Turborepo | Repositorios separados | Paquetes compartidos y cambios atómicos entre app y API | Aceptada |
| ADR-003 | Offline-first: SQLite es la fuente de verdad en el dispositivo | Cliente delgado con caché | La app debe funcionar sin red; el servidor es el punto de sincronización | Aceptada |
| ADR-004 | Backend propio con NestJS y PostgreSQL | Supabase, Firebase | Control total de la sincronización y demostración full stack | Aceptada |
| ADR-005 | Motor de sincronización propio con registro de operaciones y cursor por usuario | PowerSync, ElectricSQL, CRDTs completos | Es el diferenciador técnico; los datos son registros planos y no necesitan CRDTs de texto | Aceptada |
| ADR-006 | Conflictos por campo con reloj lógico híbrido acotado por el servidor | Hora de llegada al servidor, relojes vectoriales, CRDTs | Respeta el orden real de edición sin confiar en el reloj del celular | Aceptada |
| ADR-007 | Dinero en enteros con moneda ISO 4217 y montos con signo | Decimales, cadenas de texto | Exactitud y sumas simples | Aceptada |
| ADR-008 | UUID v7 generados en el cliente; UUID v5 para categorías predefinidas y ocurrencias recurrentes | Enteros autoincrementales | Crear sin conexión, reintentar sin duplicar y evitar duplicados entre dispositivos | Aceptada |
| ADR-009 | Categorizador propio por capas con Naive Bayes y diccionario sembrado | LLM propio, API de LLM para todo | Privacidad, costo y funcionamiento sin conexión | Aceptada |
| ADR-010 | Drizzle ORM para PostgreSQL y SQLite | Prisma, TypeORM | Cubre ambos motores con el mismo estilo y funciona con `expo-sqlite`; Prisma no corre en React Native | Aceptada |
| ADR-011 | Autenticación propia con JWT de vida corta, refresco rotatorio y Sign in with Apple | Servicio gestionado (Cognito, Auth0) | Menos dependencias y más control; el riesgo se reduce con bibliotecas probadas y se revisa antes del lanzamiento | Aceptada |
| ADR-012 | Adjuntos en almacenamiento de objetos con URLs prefirmadas | Subir los archivos por la API | La API no maneja binarios y escala mejor | Aceptada |
| ADR-013 | API versionada en `/v1` con errores `problem+json` | Sin versionado | Versiones viejas de la app conviven con la API nueva | Aceptada |
| ADR-014 | Tubería de captura con fuentes enchufables: hoy mensajes por Atajo de iOS y texto pegado, y la conexión bancaria como fuente futura | Leer los SMS directamente (no es posible en iPhone y Google Play lo restringe), conectar bancos desde el inicio, solo entrada manual | Una sola ruta para deduplicar, revisar y categorizar; sumar el banco será escribir un adaptador | Aceptada |

## Entornos y despliegue

Hay cuatro entornos y el código llega a producción solo por un camino: una pull request que pasa el pipeline, luego staging y, al final, una etiqueta de versión aprobada a mano.

| Entorno | Para qué | Datos | Cómo se despliega |
| --- | --- | --- | --- |
| Local | Desarrollo diario | Datos de ejemplo | `docker compose up` levanta PostgreSQL, Redis, almacenamiento de objetos compatible con S3 (RustFS) y correo de pruebas (Mailpit); la API corre con `pnpm dev:api` y la app en el simulador o en el celular con Expo. La imagen de la API se suma al compose en T-040 y el worker llega con BullMQ |
| CI | Validar cada pull request | Efímeros | Contenedores de servicio en GitHub Actions y Testcontainers |
| Staging | Probar versiones antes de publicarlas y repartir builds por TestFlight | Datos sintéticos | Automático al fusionar a `main`; las migraciones corren primero |
| Producción | Usuarios reales | Datos reales | Manual desde una etiqueta de versión; las migraciones corren primero y hay vuelta atrás probada |

**Pipeline de la API.** Lint, tipos, pruebas unitarias y de integración, construcción de la imagen Docker y despliegue; cada paso bloquea el siguiente si falla. Desde el H0 corren lint, tipos y pruebas; la imagen y el despliegue llegan en T-040.

**Pipeline de la app.** Lint, tipos y pruebas, build con EAS, build de staging por TestFlight y envío a App Store Connect con EAS Submit.

**Alojamiento.** La etapa 0 puede correr en un servicio de contenedores de bajo costo y la etapa 1 pasar a AWS con Terraform; se decide en un ADR cuando haya presupuesto y requisitos reales.
