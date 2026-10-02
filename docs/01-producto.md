# Luka — Diseño de producto (preprogramación)

Oct 1, 2026 · @Alejandro

## Visión y alcance

Luka es una app de finanzas personales para iOS que registra un gasto en segundos, funciona sin internet y se sincroniza sin perder ni duplicar datos. Al mismo tiempo es un proyecto de portafolio full stack, así que cada decisión técnica debe poder explicarse y defenderse en una entrevista.

**Problema que ataca.** La hipótesis de producto es que el registro manual es lo que hace abandonar estas apps. Luka reduce esa fricción con captura rápida, categorización automática con IA y carga de movimientos desde extractos o bancos.

### Objetivos del producto

- Registrar un gasto en menos de 5 segundos desde que se abre la app.
- Funcionar completo sin conexión y sincronizar sin conflictos ni duplicados.
- Categorizar movimientos y leer recibos con IA, con corrección manual siempre disponible.
- Importar movimientos desde extractos (CSV y PDF) y, en V3, desde conexión bancaria.
- Mostrar en qué se va el dinero con resúmenes, presupuestos y alertas.

### Objetivos del portafolio

- Demostrar un sistema completo: app móvil, API, base de datos, IA, CI/CD y observabilidad.
- Documentación que un reclutador lea en 10 minutos: README, diagramas y ADRs.
- Pruebas automatizadas, integración continua y despliegue reproducible con Docker.
- Historial de commits y issues ordenado, que cuente cómo se construyó el proyecto.

### Fuera de alcance por ahora

- Mover dinero real: pagos, transferencias o inversiones.
- Asesoría financiera personalizada.
- Android y web; la arquitectura no debe impedirlos.
- Cuentas compartidas entre varios usuarios.

### Supuestos de partida

- Mercado inicial: Colombia, con COP como moneda base y el modelo preparado para varias monedas.
- Idioma de la app, el repositorio y la documentación: español.
- Un solo desarrollador, así que el alcance se corta por fases (MVP, V2, V3) y no por funcionalidades sueltas.

**Lanzamiento.** Uso personal primero, pero diseñada para publicarse en la App Store: el aislamiento de datos entre usuarios, el borrado de la cuenta dentro de la app, la política de privacidad, las copias de seguridad y la observabilidad son parte del diseño desde el inicio y no se agregan después.

## Actores y personas

Luka tiene un actor humano principal y seis actores secundarios, entre sistemas externos y procesos internos. Los casos de uso del documento se escriben desde la perspectiva de estos actores.

| Actor | Tipo | Qué espera del sistema |
| --- | --- | --- |
| Usuario | Humano, primario | Registrar gastos rápido, ver en qué gasta y no pasarse del presupuesto |
| Operador | Humano, secundario | Ver la salud del sistema, revisar trabajos fallidos y atender cuentas con problemas |
| Servicio de IA | Sistema externo | Interpretar recibos y extractos que las reglas del dispositivo no entienden, solo con permiso del usuario (V3) |
| Proveedor bancario | Sistema externo | Entregar movimientos de las cuentas que el usuario autorice |
| Servicio de notificaciones (APNs) | Sistema externo | Entregar alertas push al celular |
| Planificador | Proceso interno | Disparar gastos recurrentes, alertas de presupuesto y tareas de sincronización |
| Atajos de iOS | Sistema del dispositivo | Entregar a Luka el texto de los mensajes que cumplen el filtro que la persona configuró |

### Personas de referencia

Son arquetipos ficticios para decidir prioridades; no representan usuarios reales.

- **Camila, 27, diseñadora freelance.** Ingresos irregulares, paga en efectivo y con tarjeta. Quiere ver el mes de un vistazo y capturar gastos de pie, a veces sin señal.
- **Mateo, 34, empleado con salario fijo.** Tiene suscripciones, cuotas y gastos fijos. Prefiere importar el extracto del banco y revisar solo lo que la app no pudo clasificar.

## Requisitos funcionales

Hay 40 requisitos funcionales: 15 entran al MVP, 20 a V2 y 5 a V3, y 17 de ellos son Must. La fase y la prioridad (MoSCoW) son una propuesta inicial para ajustar.

| ID | Módulo | Requisito | MoSCoW | Fase |
| --- | --- | --- | --- | --- |
| RF-01 | Acceso | Registro e inicio de sesión con correo y con Sign in with Apple | Must | MVP |
| RF-02 | Acceso | Bloqueo de la app con Face ID o código | Should | MVP |
| RF-03 | Acceso | Eliminar la cuenta y todos los datos del usuario | Must | MVP |
| RF-04 | Acceso | Exportar todos los datos del usuario en CSV y JSON | Should | V2 |
| RF-05 | Cuentas | Crear, editar y archivar cuentas (efectivo, débito, crédito, ahorro) con saldo inicial | Must | MVP |
| RF-06 | Cuentas | Registrar transferencias entre cuentas sin contarlas como gasto | Must | MVP |
| RF-07 | Cuentas | Conciliar el saldo de una cuenta con el saldo real | Should | V2 |
| RF-08 | Movimientos | Registrar un gasto o ingreso con monto, fecha, cuenta, categoría y nota | Must | MVP |
| RF-09 | Movimientos | Editar y eliminar movimientos con borrado lógico | Must | MVP |
| RF-10 | Movimientos | Buscar y filtrar por fecha, categoría, cuenta, monto y texto | Must | MVP |
| RF-11 | Movimientos | Etiquetas libres y foto adjunta del recibo | Should | MVP |
| RF-12 | Movimientos | Dividir un movimiento entre varias categorías | Could | V2 |
| RF-13 | Movimientos | Registro rápido desde widget y Atajos de iOS | Should | V2 |
| RF-14 | Categorías | Categorías predefinidas en español y categorías propias con ícono y color | Must | MVP |
| RF-15 | Categorías | Reglas de categorización por comercio o por texto | Should | V2 |
| RF-16 | Presupuestos | Presupuesto mensual por categoría y total | Must | V2 |
| RF-17 | Presupuestos | Alertas push al llegar al 80 % y al 100 % del presupuesto | Should | V2 |
| RF-18 | Recurrentes | Gastos e ingresos recurrentes (semanal, mensual, anual) | Must | V2 |
| RF-19 | Recurrentes | Detectar suscripciones a partir del historial | Could | V3 |
| RF-20 | Reportes | Resumen mensual de ingresos, gastos y balance | Must | MVP |
| RF-21 | Reportes | Gasto por categoría y tendencia de los últimos 6 meses | Should | V2 |
| RF-22 | Reportes | Exportar movimientos a CSV | Should | V2 |
| RF-23 | Sincronización | Todo el MVP funciona sin conexión | Must | MVP |
| RF-24 | Sincronización | Sincronización automática en segundo plano al volver la conexión | Must | MVP |
| RF-25 | Sincronización | Resolución de conflictos determinista, con registro de qué cambio ganó | Must | MVP |
| RF-26 | Sincronización | Estado de sincronización visible: al día, pendiente o con error | Should | MVP |
| RF-27 | Sincronización | Varios dispositivos por usuario | Should | V2 |
| RF-28 | IA | Sugerir categoría al registrar un movimiento | Should | V2 |
| RF-29 | IA | Aprender de las correcciones del usuario | Could | V3 |
| RF-30 | IA | Escanear un recibo y proponer comercio, monto, fecha y categoría | Should | V3 |
| RF-31 | IA | Mostrar todo resultado de la IA como propuesta editable, nunca como dato final | Must | V2 |
| RF-32 | Importación | Importar movimientos desde CSV con mapeo de columnas | Should | V2 |
| RF-33 | Importación | Importar extractos en PDF | Could | V3 |
| RF-34 | Importación | Detectar y evitar duplicados al importar | Must | V2 |
| RF-35 | Importación | Conectar cuentas bancarias mediante las finanzas abiertas, cuando los bancos habiliten el acceso | Could | V3 |
| RF-36 | Operación | Panel de operación con métricas, errores y trabajos fallidos | Should | V2 |
| RF-37 | Captura | Pegar o compartir el texto de un mensaje o correo para crear un movimiento | Should | V2 |
| RF-38 | Captura | Configuración guiada, una sola vez, del Atajo de iOS que entrega a Luka los mensajes de compra aprobada | Should | V2 |
| RF-39 | Captura | Lectores por banco que extraen monto, comercio, fecha y últimos dígitos de la tarjeta | Should | V2 |
| RF-40 | Captura | Todo movimiento capturado entra como «por revisar» y no cuenta hasta que el usuario lo confirma | Must | V2 |

## Requisitos no funcionales

Los tres que más pesan en el portafolio son el funcionamiento sin conexión, la convergencia de la sincronización y la calidad automatizada. Las metas numéricas son puntos de partida, pensados para medirse desde el primer sprint.

| ID | Categoría | Requisito | Cómo se verifica |
| --- | --- | --- | --- |
| RNF-01 | Rendimiento móvil | Arranque en frío hasta el formulario de gasto en menos de 2 s; registrar un gasto en 3 toques o menos | Medición en dispositivo y prueba E2E con tiempos |
| RNF-02 | Rendimiento móvil | Lista de 10 000 movimientos con scroll fluido gracias a paginación local | Prueba con datos semilla |
| RNF-03 | Rendimiento API | p95 menor a 300 ms en lectura y sincronización con 1 000 usuarios simulados | Pruebas de carga con k6 en CI nocturno |
| RNF-04 | Offline-first | Los requisitos RF-05 a RF-14 operan en modo avión; la cola de cambios sobrevive al cierre de la app | Pruebas E2E sin red |
| RNF-05 | Consistencia | Dos dispositivos terminan con el mismo estado tras sincronizar; ningún movimiento se pierde ni se duplica | Pruebas basadas en propiedades con conflictos simulados |
| RNF-06 | Exactitud | Montos como enteros en la unidad menor de la moneda; nunca decimales flotantes | Pruebas unitarias y regla de lint |
| RNF-07 | Seguridad | Contraseñas con Argon2id, JWT de vida corta con refresh rotatorio, TLS 1.2 o superior, secretos fuera del repositorio | Revisión contra OWASP ASVS y MASVS, SAST en CI |
| RNF-08 | Seguridad | Base de datos local protegida con cifrado de iOS y bloqueo biométrico opcional | Revisión manual y prueba en dispositivo |
| RNF-09 | Privacidad | Consentimiento explícito antes de usar IA o conexión bancaria; borrado completo de datos a petición del usuario | Pruebas E2E del flujo de borrado; alineación con la Ley 1581 de 2012, por validar con asesoría legal |
| RNF-10 | Observabilidad | Logs estructurados con id de correlación, métricas de tasa, errores y latencia, trazas y alertas | Tablero y alerta de prueba disparada a propósito |
| RNF-11 | Calidad | Cobertura de 80 % o más en lógica de dominio; CI en cada PR con lint, tipos, pruebas y build; merge bloqueado si falla | Reglas de rama protegida en GitHub (pendientes: el plan gratuito no las permite en repositorios privados; se activan al publicar el repositorio, #9) |
| RNF-12 | Despliegue | Entorno local completo con un solo comando (Docker Compose); infraestructura versionada como código | Prueba de arranque limpio en CI |
| RNF-13 | Accesibilidad | Dynamic Type y VoiceOver en los flujos principales; contraste mínimo AA | Auditoría con Accessibility Inspector |
| RNF-14 | Disponibilidad | Meta de 99,5 % mensual para la API mientras sea un servicio de bajo costo | Monitoreo externo de health checks |

## Catálogo de casos de uso

Hay 36 casos de uso en 11 módulos: 13 en el MVP, 18 en V2 y 5 en V3.

&#91;embedded content: casos de uso · 7 actores, 11 módulos\]

Los actores humanos están a la izquierda y los sistemas externos y procesos internos a la derecha; cada flecha indica qué módulo usa cada actor.

| ID | Caso de uso | Módulo | Actores | Fase | Requisitos |
| --- | --- | --- | --- | --- | --- |
| CU-01 | Registrarse e iniciar sesión | Acceso | Usuario | MVP | RF-01 |
| CU-02 | Bloquear la app con biometría | Acceso | Usuario | MVP | RF-02 |
| CU-03 | Eliminar la cuenta y los datos | Acceso | Usuario | MVP | RF-03 |
| CU-04 | Exportar mis datos | Acceso | Usuario | V2 | RF-04 |
| CU-05 | Gestionar cuentas financieras | Cuentas | Usuario | MVP | RF-05 |
| CU-06 | Registrar una transferencia entre cuentas | Cuentas | Usuario | MVP | RF-06 |
| CU-07 | Conciliar el saldo de una cuenta | Cuentas | Usuario | V2 | RF-07 |
| CU-08 | Registrar un gasto o ingreso | Movimientos | Usuario | MVP | RF-08, RF-14 |
| CU-09 | Editar o eliminar un movimiento | Movimientos | Usuario | MVP | RF-09 |
| CU-10 | Buscar y filtrar movimientos | Movimientos | Usuario | MVP | RF-10 |
| CU-11 | Agregar etiquetas y foto de recibo | Movimientos | Usuario | MVP | RF-11 |
| CU-12 | Registrar desde widget o Atajos | Movimientos | Usuario | V2 | RF-13 |
| CU-13 | Gestionar categorías | Categorías | Usuario | MVP | RF-14 |
| CU-14 | Definir reglas de categorización | Categorías | Usuario | V2 | RF-15 |
| CU-15 | Definir el presupuesto mensual | Presupuestos y recurrentes | Usuario | V2 | RF-16 |
| CU-16 | Recibir una alerta de presupuesto | Presupuestos y recurrentes | Usuario, Planificador, APNs | V2 | RF-17 |
| CU-17 | Programar un movimiento recurrente | Presupuestos y recurrentes | Usuario, Planificador | V2 | RF-18 |
| CU-18 | Ver el resumen mensual | Reportes | Usuario | MVP | RF-20 |
| CU-19 | Ver gasto por categoría y tendencia | Reportes | Usuario | V2 | RF-21 |
| CU-20 | Exportar movimientos a CSV | Reportes | Usuario | V2 | RF-22 |
| CU-21 | Sincronizar cambios | Sincronización | Usuario (automático) | MVP | RF-23, RF-24, RF-26 |
| CU-22 | Resolver un conflicto de edición | Sincronización | Usuario (solo aviso) | MVP | RF-25 |
| CU-23 | Enlazar un segundo dispositivo | Sincronización | Usuario | V2 | RF-27 |
| CU-24 | Recibir sugerencia de categoría | IA | Usuario | V2 | RF-28, RF-31 |
| CU-25 | Escanear un recibo | IA | Usuario, Servicio de IA | V3 | RF-30, RF-31 |
| CU-26 | Importar un extracto CSV | Importación | Usuario | V2 | RF-32, RF-34 |
| CU-27 | Importar un extracto PDF | Importación | Usuario, Servicio de IA | V3 | RF-33, RF-34 |
| CU-28 | Conectar una cuenta bancaria | Importación | Usuario, Proveedor bancario | V3 | RF-35 |
| CU-29 | Revisar y confirmar movimientos importados o capturados | Importación | Usuario | V2 | RF-34 |
| CU-30 | Monitorear la salud del sistema | Operación | Operador | V2 | RF-36 |
| CU-31 | Reintentar un trabajo fallido | Operación | Operador | V2 | RF-36 |
| CU-32 | Descubrir suscripciones | Presupuestos y recurrentes | Usuario, Planificador | V3 | RF-19 |
| CU-33 | Corregir una sugerencia de IA y aprender de ella | IA | Usuario | V3 | RF-29 |
| CU-34 | Pegar o compartir el texto de un mensaje | Captura | Usuario | V2 | RF-37, RF-39, RF-40 |
| CU-35 | Configurar con guía la captura automática de mensajes | Captura | Usuario | V2 | RF-38 |
| CU-36 | Registrar un movimiento desde un mensaje que llega | Captura | Atajos de iOS; Usuario (solo aviso) | V2 | RF-38, RF-39, RF-40 |

## Casos de uso detallados del MVP

Se detallan los cinco casos de uso que más condicionan la arquitectura: iniciar sesión, registrar un movimiento, editarlo, sincronizar y resolver conflictos. Los demás se detallan antes de empezar su fase.

### CU-01 Registrarse e iniciar sesión

- **Actor:** Usuario. **Requisitos:** RF-01, RNF-07.
- **Precondiciones:** app instalada y con conexión. Es el único paso del MVP que exige red, y solo la primera vez.
- **Disparador:** el usuario abre la app por primera vez o su sesión expiró.

**Flujo principal**

1. El usuario elige «Continuar con Apple» o «Correo».
2. Con correo, escribe correo y contraseña; el servidor valida el formato y que el correo no exista.
3. El servidor crea el usuario, guarda el hash Argon2id y devuelve un token de acceso de vida corta y un token de refresco.
4. La app guarda los tokens en el Keychain de iOS y crea la base de datos local.
5. La app carga las categorías predefinidas y lleva al usuario a crear su primera cuenta (CU-05).

**Flujos alternativos**

- Con Apple, el servidor valida el token de identidad de Apple y crea o reconoce al usuario.
- Si el correo ya existe, la app ofrece iniciar sesión o recuperar la contraseña.
- Si el usuario ya tiene datos y entra desde un dispositivo nuevo, se ejecuta una sincronización completa (CU-21).

**Errores**

- Sin conexión en el primer inicio: la app explica que necesita red solo esta vez.
- Credenciales inválidas: mensaje genérico que no revela si el correo existe, con espera creciente tras varios intentos.
- Token de refresco vencido o revocado: la app pide iniciar sesión de nuevo sin borrar los cambios locales pendientes.

**Postcondiciones:** sesión activa, tokens en el Keychain y base local lista.

### CU-08 Registrar un gasto o ingreso

- **Actor:** Usuario. **Requisitos:** RF-08, RF-14, RNF-01, RNF-04.
- **Precondiciones:** sesión iniciada y al menos una cuenta creada. No requiere conexión.
- **Disparador:** el usuario toca «Agregar» en la pantalla de inicio.

**Flujo principal**

1. La app abre el formulario con la última cuenta usada, la fecha de hoy y el teclado numérico activo.
2. El usuario escribe el monto.
3. Elige la categoría, con las más usadas primero, y si quiere agrega una nota.
4. Toca «Guardar».
5. La app valida los datos, genera un UUID, guarda el movimiento en la base local como pendiente de sincronizar y actualiza saldos y resumen.
6. La app confirma con un aviso breve y deja el formulario listo para otro registro.

**Flujos alternativos**

- El usuario cambia el tipo a ingreso o a transferencia; esta última continúa en CU-06.
- El usuario cambia la fecha o la cuenta antes de guardar.
- Si hay conexión, el movimiento se encola para sincronización inmediata (CU-21) sin bloquear la pantalla.

**Errores**

- Monto vacío, cero o negativo: se marca el campo y no se guarda.
- Cuenta archivada: se pide elegir otra.
- Almacenamiento local lleno o dañado: se muestra el error y se ofrece exportar lo pendiente.

**Postcondiciones:** el movimiento existe en el dispositivo con un ID estable, el saldo de la cuenta cambió y hay una operación en la cola de sincronización.

### CU-09 Editar o eliminar un movimiento

- **Actor:** Usuario. **Requisitos:** RF-09, RNF-04.
- **Precondiciones:** el movimiento existe en la base local. No requiere conexión.
- **Disparador:** el usuario abre un movimiento desde la lista y lo modifica o toca «Eliminar».

**Flujo principal**

1. La app muestra el movimiento con todos sus campos editables.
2. El usuario cambia uno o más campos y guarda, o confirma la eliminación.
3. La app guarda el cambio localmente con una nueva marca `updated_at`; una eliminación solo marca el movimiento como borrado.
4. La app recalcula saldos y resumen.
5. La app encola la operación para sincronizar (CU-21).

**Flujos alternativos**

- Tras eliminar, aparece un aviso «Deshacer» durante unos segundos.
- Si el movimiento vino de una importación, la app avisa que cambiarlo puede generar un duplicado al reimportar.

**Errores**

- Los mismos de CU-08 para monto, cuenta y almacenamiento.
- Si otro dispositivo cambió el mismo movimiento, el conflicto se resuelve al sincronizar (CU-22).

**Postcondiciones:** el cambio persiste en el dispositivo y la cola tiene una operación nueva.

### CU-21 Sincronizar cambios

- **Actores:** Usuario (disparo automático) y servidor de la API. **Requisitos:** RF-23, RF-24, RF-26, RNF-05.
- **Precondiciones:** sesión activa y operaciones pendientes o cambios en el servidor.
- **Disparadores:** vuelve la conexión, la app pasa a primer plano, el usuario desliza para refrescar o se guarda un cambio con red disponible.

**Flujo principal**

1. La app toma las operaciones pendientes de la cola, en orden de creación.
2. Envía un lote al servidor con el cursor de la última sincronización y un id único por operación, que garantiza idempotencia.
3. El servidor aplica cada operación dentro de una transacción; si ya la había recibido, la ignora y responde éxito.
4. El servidor responde con los cambios de otros dispositivos posteriores al cursor y un cursor nuevo.
5. La app aplica los cambios remotos a la base local en una sola transacción y guarda el cursor.
6. La app marca las operaciones enviadas como sincronizadas y el indicador pasa a «al día».

**Flujos alternativos**

- Si la cola es más grande que un lote, se repite desde el paso 1 hasta vaciarla.
- Dispositivo nuevo, con cursor vacío: descarga completa y paginada.
- Si el servidor detecta que dos dispositivos editaron lo mismo, se activa CU-22.

**Errores**

- Se pierde la conexión a mitad: nada se marca como sincronizado y se reintenta con espera exponencial y los mismos ids.
- Respuesta 401: se refresca el token y se reintenta una vez.
- El servidor rechaza una operación por validación: queda «con error», se muestra al usuario y no bloquea el resto de la cola.

**Postcondiciones:** el dispositivo y el servidor convergen; la cola queda vacía o con errores visibles.

### CU-22 Resolver un conflicto de edición

- **Actores:** Sistema; el Usuario solo recibe un aviso. **Requisitos:** RF-25, RNF-05.
- **Precondiciones:** dos dispositivos editaron el mismo movimiento desde su última sincronización.
- **Disparador:** el servidor recibe una operación cuya versión base es anterior a la versión actual del registro.

**Flujo principal**

1. El servidor compara la versión base de la operación con la versión actual del registro y detecta el conflicto.
2. Combina por campo, o por grupo de campos que deben ser coherentes entre sí: si solo uno de los dos cambió un campo, se conserva ese cambio.
3. Si ambos cambiaron el mismo campo, gana el cambio con el reloj lógico híbrido mayor, que el servidor acota a su propia hora.
4. El servidor guarda el cambio perdedor en un registro de conflictos para auditoría.
5. La respuesta de sincronización incluye el registro resultante y la app lo adopta.
6. La app muestra un aviso discreto, «Se combinó una edición de otro dispositivo», con acceso al detalle.

**Flujos alternativos**

- Si un dispositivo eliminó y el otro editó, gana la eliminación y el movimiento queda recuperable durante 30 días.
- En V2, el usuario podrá deshacer y elegir la versión que perdió.

**Errores**

- Reloj del dispositivo desajustado: el servidor acota el reloj lógico a su propia hora, así un reloj adelantado no gana todos los conflictos.
- Fallo al guardar el registro de conflictos: la operación entera se revierte y se reintenta.

**Postcondiciones:** todos los dispositivos terminan con el mismo estado y el conflicto queda registrado. La regla está formalizada en ADR-006 y en el documento 4.

## Historias de usuario y fases

El MVP se corta en 11 historias, diez de usuario y una técnica; las de V2 y V3 quedan como historias cortas hasta que se acerque su fase. Cada historia de MVP tiene criterios de aceptación que pasan a ser pruebas automatizadas.

### MVP

| ID | Historia | Criterios de aceptación | Casos de uso |
| --- | --- | --- | --- |
| HU-01 | Como persona nueva, quiero crear mi cuenta con Apple o con correo, para guardar mis datos de forma segura | Con conexión y un correo válido entro a crear mi primera cuenta; si el correo ya existe veo la opción de iniciar sesión; la contraseña nunca se guarda en texto plano | CU-01 |
| HU-02 | Como usuario, quiero crear cuentas (efectivo, débito, crédito, ahorro), para ver cuánto tengo en cada una | Una cuenta tiene nombre, tipo y saldo inicial; el saldo es el inicial más ingresos, menos gastos, más o menos transferencias; una cuenta archivada conserva su historial | CU-05, CU-06 |
| HU-03 | Como usuario, quiero registrar un gasto en pocos toques, para no dejar de anotarlos | Se llega a «Guardar» en 3 toques o menos desde el inicio (las pulsaciones del teclado al escribir el monto no cuentan); funciona en modo avión; el monto se guarda como entero en la unidad menor | CU-08 |
| HU-04 | Como usuario, quiero editar o eliminar un movimiento y deshacer un borrado, para corregir errores | Tras eliminar puedo deshacer durante unos segundos; los saldos se recalculan; un movimiento eliminado no aparece en listas ni resúmenes | CU-09 |
| HU-05 | Como usuario, quiero buscar y filtrar mis movimientos, para encontrar uno específico | Filtro por fecha, categoría, cuenta, monto y texto, combinados; con 10 000 movimientos el resultado aparece sin saltos visibles | CU-10 |
| HU-06 | Como usuario, quiero agregar etiquetas y la foto de un recibo, para tener comprobantes | La foto se guarda en el dispositivo y se sube al sincronizar con conexión; puedo quitarla o reemplazarla | CU-11 |
| HU-07 | Como usuario, quiero categorías en español y poder crear las mías, para organizar mis gastos a mi manera | Hay categorías predefinidas al empezar; puedo crear, renombrar y archivar con ícono y color; archivar no altera movimientos antiguos | CU-13 |
| HU-08 | Como usuario, quiero ver un resumen del mes, para saber cómo voy | Muestra ingresos, gastos y balance del mes elegido; las transferencias entre mis cuentas no cuentan como gasto ni ingreso; cambiar de mes funciona sin conexión | CU-18 |
| HU-09 | Como usuario, quiero que mis datos se sincronicen solos, para no perder nada si cambio de celular | Lo creado sin conexión llega al servidor al volver la red, sin duplicados aunque se reintente; el indicador muestra al día, pendiente o con error; ante un conflicto ambos dispositivos terminan iguales | CU-21, CU-22 |
| HU-10 | Como usuario, quiero bloquear la app con Face ID y poder borrar mi cuenta, para proteger mi privacidad | Con el bloqueo activo se pide Face ID o código al abrir; al borrar la cuenta se eliminan los datos del servidor y del dispositivo, previa confirmación | CU-02, CU-03 |
| HU-11 | Como desarrollador, quiero que cada pull request pase lint, tipos, pruebas y build, para mantener el repositorio estable | Un PR con una prueba fallida no se puede fusionar; el pipeline corre en menos de 10 minutos | Transversal |

### V2

- Presupuestos por categoría con alertas al 80 % y al 100 % (CU-15, CU-16).
- Movimientos recurrentes (CU-17).
- Importar extractos CSV, revisarlos y confirmarlos sin duplicados (CU-26, CU-29).
- Sugerencia de categoría con IA, siempre editable, y reglas propias (CU-24, CU-14).
- Registro rápido desde widget y Atajos de iOS (CU-12).
- Gasto por categoría, tendencia de 6 meses y exportación a CSV (CU-19, CU-20).
- Varios dispositivos, conciliación de saldos y exportación de mis datos (CU-23, CU-07, CU-04).
- Como operador, ver métricas y reintentar trabajos fallidos (CU-30, CU-31).

* Capturar movimientos desde mensajes: pegar o compartir el texto y configurar una sola vez el Atajo de iOS, con revisión antes de que cuenten (CU-34 a CU-36).

### V3

- Escanear un recibo y confirmar lo que la IA leyó (CU-25).
- Importar extractos en PDF (CU-27).
- Conectar mi banco con las finanzas abiertas, cuando los bancos habiliten el acceso (CU-28).
- Descubrir suscripciones y que la IA aprenda de mis correcciones (CU-32, CU-33).

## Decisiones y mapa de documentos

Cinco decisiones están tomadas y cuatro siguen abiertas; los documentos 2 a 8 ya aplican las primeras.

- **Fases y prioridades: tomada.** El MVP incluye la sincronización sin conexión desde el inicio, porque es el mayor diferenciador técnico.
- **Backend: tomada.** NestJS y PostgreSQL propios (ADR-004).
- **Sincronización: tomada.** Motor propio (ADR-005), con conflictos por campo y reloj lógico híbrido (ADR-006).
- **IA: tomada.** Un categorizador propio por capas, con reglas del usuario y un clasificador Naive Bayes sembrado con un diccionario, que corre en el dispositivo y aprende de las correcciones (ADR-009); no un LLM entrenado desde cero. La lectura de recibos y extractos queda para V3.
- **Captura de movimientos: tomada.** Por ahora, pegar o compartir el texto de los mensajes y una configuración guiada, una sola vez, del Atajo de iOS; cuando los bancos abran los datos, se agrega esa fuente sin rehacer la app (ADR-014). En iPhone una app no puede leer los SMS por sí sola.
- **Conexión bancaria: en espera.** Se retoma cuando la Superfinanciera publique los estándares de finanzas abiertas y los bancos habiliten el acceso; la tubería de captura permite sumarla como una fuente más.
- **Nombre: abierta.** Luka es provisional; hay que revisar su disponibilidad en la App Store, donde los nombres tienen un máximo de 30 caracteres, y en GitHub.
- **Quién publica en la App Store: abierta.** Apple podría exigir una persona jurídica para una app con datos financieros (documento 5); se decide con asesoría legal antes del Hito 6.
- **Modelo de ingresos: abierta.** No está definido; si hubiera suscripción, debe usar compras dentro de la app (guía 3.1.1).

### Documentos del diseño

- **1 · Producto y casos de uso** (esta pestaña): visión, requisitos, casos de uso e historias.
- 2 · Modelo de datos: entidades, diagrama entidad-relación, invariantes e índices.
- 3 · Arquitectura y ADRs: stack, diagramas C4, categorizador propio, escalabilidad y 13 ADRs.
- 4 · Sincronización y API: motor de sincronización, conflictos, endpoints y contrato OpenAPI.
- 5 · Seguridad y privacidad: amenazas, privacidad (Ley 1581) y lista para la App Store.
- 6 · Pruebas, CI/CD y observabilidad: estrategia de pruebas, pipeline, observabilidad y lanzamientos.
- 7 · Roadmap y backlog: hitos, 42 issues, épicas, definición de hecho y riesgos.
- 8 · Monorepo y CLAUDE.md: `CLAUDE.md`, scripts, permisos y prompts para Claude Code.

Para pasar el diseño a Claude Code, siga los pasos de 8 · Monorepo y CLAUDE.md.
