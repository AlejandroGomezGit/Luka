# Seguridad y privacidad

Luka guarda datos financieros personales, así que el diseño asume que la API será atacada y que un celular puede perderse; cada amenaza relevante tiene una mitigación y una prueba que la verifica.

## Amenazas y mitigaciones

Catorce amenazas cubren lo que importa proteger: las cuentas, las sesiones, los datos financieros, la integridad de la sincronización y los datos que quedan en el celular. Cada una tiene una mitigación en el diseño y una forma de verificarla.

| ID | Amenaza | Mitigación | Cómo se verifica |
| --- | --- | --- | --- |
| AM-01 | Adivinar o robar contraseñas con intentos masivos | Argon2id, límite de intentos con espera creciente por cuenta e IP, por cuenta desde todas las IP y por IP (ADR-015), mensajes de error genéricos y la misma respuesta exista o no el correo | Pruebas de integración de los límites (T-025), con Redis caído incluido |
| AM-02 | Robo de un token de sesión | Token de acceso de 15 minutos, refresco de un solo uso con detección de reutilización, tokens en el Keychain, revocación por dispositivo | Pruebas de integración de la rotación |
| AM-03 | Leer datos de otro usuario | `user_id` en toda consulta, seguridad a nivel de fila en PostgreSQL forzada en cada tabla, rol de la API sin `BYPASSRLS`, claves foráneas compuestas (`user_id`, `id`) e identificadores UUID | Pruebas de aislamiento en CI con dos usuarios, tabla por tabla, y prueba de catálogo (T-026, INV-08) |
| AM-04 | Inyección SQL o datos mal formados | Consultas parametrizadas con Drizzle, validación con Zod en cada entrada, límites de tamaño | Análisis estático y pruebas de contrato |
| AM-05 | Celular perdido o robado | Protección de datos de iOS, bloqueo con Face ID, revocar el dispositivo desde otra sesión | Prueba manual en dispositivo |
| AM-06 | Interceptar el tráfico | TLS 1.2 o superior, HSTS y App Transport Security de iOS sin excepciones | Escaneo de TLS en staging |
| AM-07 | Repetir o manipular operaciones de sincronización | `opId` idempotente, validación del registro resultante, reloj acotado por el servidor, lotes limitados | Pruebas de propiedades y de integración |
| AM-08 | Abuso de la API: fuerza bruta, scraping, saturación | Límite de tasa por IP (IPv6 por /64) y por usuario, más estricto en `/v1/auth/*` (ADR-015), cuerpo de 1 MB como máximo, tiempo máximo por petición y `TRUST_PROXY` explícito | k6 y pruebas de `429` (T-025) |
| AM-09 | Secretos filtrados en el repositorio o en los logs | Escaneo de secretos en CI, gestor de secretos, logs sin datos financieros | gitleaks sobre todo el historial en cada PR y push a `main`, con hallazgos revisados solo por huella exacta en `.gitleaksignore` (T-043), y prueba del redactado de logs (T-019) |
| AM-10 | Dependencia vulnerable o comprometida | Actualización automática, auditoría en CI, archivo de bloqueo y SBOM | osv-scanner en cada PR, push a `main` y cada lunes; falla con cualquier vulnerabilidad conocida salvo excepciones con motivo que caducan en 90 días o menos (T-043) |
| AM-11 | Adjuntos maliciosos o excesivos | URL prefirmada con tipo y tamaño máximos, caducidad corta, bucket privado | Prueba de integración de subida |
| AM-12 | Compartir datos con terceros sin permiso | Categorizador en el dispositivo; IA externa y banco solo con consentimiento explícito | Pruebas E2E de consentimiento |
| AM-13 | Pérdida de datos por borrado accidental o fallo de la base | Copias de seguridad automáticas, restauración probada y borrado lógico de 30 días | Simulacro de restauración |
| AM-14 | Los mensajes de texto con datos financieros que procesa la app (V2) | Se procesan solo en el dispositivo, el texto original queda local con borrado a los 30 días y no se envía a servidores ni a terceros | Prueba que verifica que el texto no sale en ninguna petición de red |

## Autenticación y sesiones

La sesión se apoya en tokens de vida corta y en un refresco de un solo uso, de modo que robar uno de ellos da una ventana pequeña y deja rastro. Los tiempos son valores de partida que se pueden ajustar.

| Elemento | Decisión | Detalle |
| --- | --- | --- |
| Contraseñas | Argon2id | Parámetros según la hoja de referencia de OWASP vigente al implementar; mínimo de 10 caracteres, sin reglas de composición obligatorias y con comprobación contra listas de contraseñas filtradas |
| Token de acceso | JWT de 15 minutos | Firmado con clave asimétrica guardada en el gestor de secretos y con rotación; lleva solo `sub`, `deviceId`, `iat` y `exp` |
| Token de refresco | Opaco, 30 días, de un solo uso | En el servidor se guarda solo su hash, ligado a un dispositivo y a una familia; si se reutiliza uno ya rotado, se revoca toda la familia |
| Almacenamiento en el dispositivo | Keychain con `expo-secure-store` | Los tokens nunca van en SQLite ni en logs |
| Sign in with Apple | Validación del token de identidad | Se verifica la firma con las claves públicas de Apple, además de `iss`, `aud`, `exp` y el nonce; el identificador es `apple_sub` y el correo puede ser privado |
| Recuperación de contraseña | Código de un solo uso de 15 minutos por correo | La respuesta es idéntica exista o no la cuenta; al cambiar la contraseña se revocan todas las sesiones |
| Intentos fallidos | 5 en 15 minutos por cuenta y por IP | Luego, espera creciente |
| Acciones sensibles | Reautenticación reciente | Eliminar la cuenta, exportar datos o cambiar el correo piden contraseña o Face ID, con una sesión de menos de 5 minutos |
| Cerrar sesión | Revoca el refresco del dispositivo | Existe también «cerrar todas las sesiones» |
| Bloqueo de la app | Face ID o código del dispositivo mediante `LocalAuthentication` | Es una capa local y no reemplaza la sesión; la app recibe solo «éxito» o «fallo», nunca datos biométricos |

## Datos: clasificación, cifrado y retención

Casi todo lo que guarda Luka es información financiera personal, así que se trata como sensible por defecto: nunca viaja sin cifrar, nunca aparece en los logs y cada dato tiene un plazo de vida.

| Dato | Sensibilidad | Dónde vive | Protección | Retención |
| --- | --- | --- | --- | --- |
| Hash de la contraseña | Alta | Servidor | Argon2id; nunca se registra | Hasta eliminar la cuenta |
| Tokens de refresco | Alta | Hash en el servidor; Keychain en el dispositivo | Un solo uso y revocables | Hasta caducar o revocar |
| Movimientos, cuentas, categorías y notas | Alta | Dispositivo y PostgreSQL | Cifrado en reposo del proveedor, seguridad a nivel de fila y protección de datos de iOS | Mientras exista la cuenta; borrado lógico de 30 días |
| Fotos de recibos | Alta | Dispositivo (`Documents/attachments/`, dentro de la app) y almacenamiento de objetos (desde T-035) | En el iPhone: reducidas a 1.600 px y sin metadatos de ubicación, con la protección de datos de iOS; la carpeta entra en la copia de seguridad de iCloud y del Mac, igual que la base local. En el servidor: bucket privado, cifrado en reposo y URLs prefirmadas de corta vida | El archivo se borra del iPhone cuando ya no se puede deshacer el borrado (o se quita la foto); la fila, igual que el movimiento (borrado lógico de 30 días) |
| Correo y nombre | Media | Servidor | Cifrado en reposo; fuera de los logs | Hasta eliminar la cuenta |
| Token push | Media | Servidor | Se borra al revocar el dispositivo | Hasta revocar |
| Consentimientos | Media | Servidor | Solo se agregan filas, no se editan | Se define con asesoría legal (ver abajo) |
| Logs y trazas | Baja | Plataforma de observabilidad | Solo ids; sin importes, comercios, notas ni correos | 30 días |
| Credenciales del agregador bancario (V3) | Crítica | Solo servidor | Cifradas con una clave gestionada; nunca llegan al dispositivo | Hasta que el usuario desconecte |
| Texto original de los mensajes capturados (V2) | Alta | Solo dispositivo | Local; nunca se sincroniza ni sale del teléfono | 30 días |
| Texto de búsqueda de los movimientos (`transaction_search`) | Alta, porque repite notas y comercios | Solo dispositivo | Protección de datos de iOS como la base local; nunca se sincroniza ni se registra en logs | Se borra con su movimiento (cascada) y con la base; se reconstruye desde los movimientos |

**En tránsito.** TLS 1.2 o superior, HSTS y App Transport Security de iOS sin excepciones. El pinning de certificados no entra en el MVP: sus riesgos operativos pesan más que su beneficio hasta que haya una razón concreta.

**En reposo.** Cifrado gestionado de la base de datos, del almacenamiento de objetos y de las copias de seguridad, con claves en un servicio de gestión de claves. En el dispositivo, la base queda bajo la protección de datos de iOS.

**Secretos.** Viven en un gestor de secretos por entorno, nunca en el repositorio ni en la imagen Docker, y se rotan al menos una vez al año y siempre que alguien con acceso salga del proyecto.

**Logs sin datos financieros.** Una lista de campos prohibidos (`amount_minor`, `merchant`, `note`, `email`, tokens) se aplica en un redactor central y una prueba automática verifica que ningún log los contenga.

**Notificaciones push.** El texto es genérico y no lleva importes ni comercios; Apple pide además que las notificaciones no se usen para enviar información personal o confidencial, y que no sean necesarias para que la app funcione (guía 4.5.4).

## Privacidad y cumplimiento

Luka queda sujeta a la [Ley 1581 de 2012](https://relatoria.colombiacompra.gov.co/normativa/ley-1581-de-2012/) apenas tenga usuarios distintos de su autor, porque la ley excluye solo las bases de datos de uso exclusivamente personal o doméstico (art. 2). Esta sección traduce la ley en funciones del producto y no es asesoría legal: lo marcado «validar» se lleva a un abogado antes del lanzamiento.

| Obligación | Qué hace Luka | Artículo |
| --- | --- | --- |
| Autorización previa, expresa e informada, que se pueda consultar después | Pantalla de aceptación al registrarse, con la versión del texto, y una fila en `consents` con su fecha | 3 y 9 |
| Informar finalidad, derechos e identidad del responsable al pedir la autorización | Resumen corto antes de aceptar y política completa enlazada | 12 |
| Derechos del titular: conocer, actualizar, rectificar, acceder gratis, revocar y suprimir | Perfil editable, exportación (RF-04), eliminación de la cuenta (RF-03) y revocación de consentimientos | 8 |
| Responder consultas en 10 días hábiles (prorrogables 5) y reclamos en 15 (prorrogables 8) | Correo de privacidad y un procedimiento interno con esos plazos; casi todo se resuelve al instante desde la app | 14 y 15 |
| Manual interno de políticas y procedimientos | Documento `docs/privacidad/politica-tratamiento.md` en el repositorio | 17 (k) |
| Informar a la autoridad si hay violaciones de los códigos de seguridad con riesgo para los datos | Procedimiento de incidentes de la última sección; plazos y formato: validar | 17 (n) |
| Transferencia internacional solo a países con nivel adecuado, o con autorización expresa e inequívoca del titular | Si la nube queda fuera de Colombia, la aceptación de privacidad incluye de forma explícita esa transferencia: validar | 26 |
| Datos de niños, niñas y adolescentes: tratamiento proscrito salvo datos públicos | App para mayores de 18 años, con confirmación de edad al registrarse y clasificación de edad honesta | 7 |
| Registro Nacional de Bases de Datos de la SIC | Validar si la inscripción aplica y cuándo, y preparar la política de tratamiento que exige | 25 |
| Datos sensibles, que incluyen los biométricos | Luka no pide datos sensibles; Face ID lo procesa iOS y la app solo recibe éxito o fallo | 5 y 6 |

La ley prevé multas de hasta 2 000 salarios mínimos mensuales, suspensión y cierre de operaciones para quien incumpla (art. 23), razón suficiente para tratar esta tabla como requisito y no como trámite.

### Consentimientos

Cada permiso es una fila de `consents` que la persona puede revocar desde Ajustes; revocar desactiva la función y deja registro. Apple exige además que retirar un consentimiento sea fácil de encontrar y de entender (guía 5.1.1 (ii)).

| `purpose` | Cuándo se pide | Qué autoriza | Fase |
| --- | --- | --- | --- |
| `terms` | Al registrarse | Términos de uso | MVP |
| `privacy` | Al registrarse | Tratamiento de datos para prestar el servicio, con finalidad, derechos, responsable y transferencia internacional | MVP |
| `ai_external` | La primera vez que se use el respaldo de IA externa | Enviar un documento a un tercero para interpretarlo | V3 |
| `bank_connection` | Al conectar un banco | Leer movimientos mediante el agregador | V3 |

### Eliminación de la cuenta

Borrar la cuenta (CU-03) elimina todo lo que Luka guarda sobre la persona, no solo la desactiva.

| Dato | Cuándo se elimina | Cómo se verifica |
| --- | --- | --- |
| Filas de PostgreSQL de todas las tablas del usuario | Al confirmar, en una sola transacción | Prueba de integración que cuenta cero filas por `user_id` |
| Adjuntos en el almacenamiento de objetos | De inmediato, con un trabajo que reintenta hasta confirmar | Prueba que verifica que no queda ningún objeto del usuario |
| Trabajos pendientes en la cola | Se cancelan al confirmar | Prueba de integración |
| Tokens y dispositivos | De inmediato | Prueba: el token deja de funcionar |
| Base local en cada dispositivo | En la siguiente sincronización, que recibe `403` con `account_deleted` y borra los datos locales | Prueba E2E |
| Fotos de recibos en cada dispositivo (`Documents/attachments/`) | Junto con la base local: se borra la carpeta entera | Prueba E2E: la carpeta no existe después |
| Copias de seguridad | Salen por rotación; propuesta: 35 días como máximo | Revisión de la política de retención del proveedor |
| Logs | No contienen datos financieros y se eliminan a los 30 días | Prueba del redactado de logs |
| Prueba de la autorización (`consents`) | Se conserva solo el tiempo que indique la asesoría legal | Decisión pendiente: validar |

## Lista para la App Store

Luka cumple casi todo lo que Apple exige de forma natural, pero hay un riesgo de fondo que se debe decidir antes de enviar la primera versión. Las guías consultadas son las del 8 de junio de 2026; esta lista se vuelve a verificar antes de cada envío.

**Riesgo a decidir: quién publica la app.** Las guías piden que las apps de servicios en campos muy regulados, como banca y servicios financieros, o que requieran información sensible, las envíe la entidad legal que presta el servicio y no un desarrollador individual (5.1.1 (ix)). Otra regla dice lo mismo de las apps de trading, inversión o manejo de dinero, que además deben tener las licencias que correspondan (3.2.1 (viii)). Luka no guarda ni mueve dinero, pero lleva datos financieros personales y en V3 se conecta a bancos, así que la revisión podría tratarla como app financiera. Hay dos caminos: publicar desde una persona jurídica o publicar como individuo y explicar en las notas para el revisor que Luka es un registro personal de gastos que no mueve dinero ni es una institución financiera. Conviene decidirlo con asesoría legal antes del Hito 6.

- [ ] **Cuenta de Apple Developer.** Cuesta 99 USD al año y se puede inscribir como individuo o como organización; la organización exige verificar la entidad legal, normalmente con un número D-U-N-S, a confirmar en el formulario de inscripción. Conviene inscribirse con tiempo ([Apple Developer Program](https://developer.apple.com/programs/)).
- [ ] **Quién publica.** Decidir persona jurídica o individuo según el riesgo de arriba (5.1.1 (ix) y 3.2.1 (viii)).
- [ ] **Política de privacidad** enlazada en App Store Connect y dentro de la app, que diga qué datos se recogen, cómo, todos sus usos, cómo se conservan y se borran, y cómo revocar el consentimiento o pedir la eliminación (5.1.1 (i)).
- [ ] **Eliminar la cuenta dentro de la app**, porque Luka permite crearla (5.1.1 (v)); ya está en el MVP como CU-03.
- [ ] **Consentimiento antes de compartir datos con terceros**, incluida la IA de terceros, y pedir solo los datos necesarios (5.1.2 (i) y 5.1.1 (iii)); lo cubre la tabla `consents`.
- [ ] **Cuenta de demostración activa** con datos de ejemplo y servicios en línea durante toda la revisión (2.1 (a) y «Before You Submit»).
- [ ] **Metadatos exactos:** capturas con datos ficticios y no de una persona real (2.3.9), nombre único de hasta 30 caracteres (2.3.7), clasificación por edad honesta (2.3.6) y datos de privacidad correctos en App Store Connect (2.3).
- [ ] **Manifiesto de privacidad.** Desde el 1 de mayo de 2024 App Store Connect no acepta apps que usan ciertas APIs sin describir su motivo en el manifiesto; hay que revisar los módulos de Expo y las dependencias ([Apple](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)).
- [ ] **Permisos con su motivo en español** (5.1.1): solo la cámara, con «Luka usa la cámara solo para fotografiar recibos y guardarlos en el movimiento que elijas.» (T-018). La galería usa el selector del sistema y no pide permiso, así que el Info.plist no lleva textos de fotos ni de micrófono; se comprueba con `npx expo config --type introspect`. Expo Go muestra su propio texto: el de Luka solo se ve en un build propio (T-041).
- [ ] **Face ID con `LocalAuthentication`**, como pide la guía 2.5.13.
- [ ] **Notificaciones opcionales y sin información sensible** (4.5.4).
- [ ] **Inicio de sesión.** Cuenta propia más Sign in with Apple no activa la regla 4.8; si algún día se agrega un inicio de sesión social, esa regla pide una opción equivalente que limite los datos y permita ocultar el correo, y Sign in with Apple lo cumple.
- [ ] **IPv6.** La app debe funcionar en redes solo IPv6 (2.5.5): verificar que la API y su dominio respondan por IPv6.
- [ ] **Contacto y URL de soporte** fáciles de encontrar (1.5).
- [ ] **Betas por TestFlight**, no en la tienda (2.2), con hasta 10 000 testers externos ([Apple Developer Program](https://developer.apple.com/programs/)).
- [ ] **Medidas de seguridad apropiadas** para la información del usuario (1.6): este documento.
- [ ] **Notas para el revisor** que expliquen lo que no es obvio: sincronización sin conexión, categorizador local e importación de CSV.

* [ ] **Atajos y mensajes (V2).** Las acciones de Atajos deben ser las que la persona espera de la app y resolverse de la forma más directa, sin anuncios ni pasos de marketing (2.5.11); el texto de los mensajes se procesa en el dispositivo y no se comparte con terceros sin consentimiento (5.1.2 (i)).

**Fuentes consultadas:** [App Review Guidelines de Apple](https://developer.apple.com/app-store/review/guidelines/) (versión del 8 de junio de 2026), [Apple Developer Program](https://developer.apple.com/programs/), [Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api) y [Ley 1581 de 2012](https://relatoria.colombiacompra.gov.co/normativa/ley-1581-de-2012/).

## Seguridad en el desarrollo e incidentes

La seguridad se automatiza en el pipeline para que no dependa de acordarse de ella, y los incidentes tienen un procedimiento escrito antes de que ocurra el primero.

| Control | Herramienta | Cuándo corre |
| --- | --- | --- |
| Escaneo de secretos | gitleaks | En cada PR y en cada push (desde T-043) |
| Análisis estático de seguridad | CodeQL de GitHub | En cada PR, cuando el repositorio sea público: el plan gratuito no lo permite en repositorios privados |
| Auditoría de dependencias | osv-scanner y actualizaciones automáticas con Renovate | En cada PR y cada semana (desde T-043) |
| Escaneo de imágenes de contenedor | Trivy | Al construir la imagen |
| Escaneo dinámico básico | OWASP ZAP contra staging | De noche |
| Inventario de componentes (SBOM) | CycloneDX | En cada versión |
| Rama protegida | GitHub: PR obligatorio y CI en verde | Siempre, desde que el repositorio sea público (#9); mientras sea privado, el plan gratuito no lo permite |
| Secretos de producción | GitHub Environments con aprobación manual | Al desplegar |
| Revisión de este documento | Amenazas y mitigaciones | Al cierre de cada hito |

### Respuesta a incidentes

1. **Detectar.** Alertas de Sentry y de métricas, o un reporte privado de vulnerabilidad en GitHub, como indica `SECURITY.md`. Ese reporte se activa cuando el repositorio sea público.
2. **Contener.** Revocar tokens y dispositivos, rotar secretos y, si hace falta, apagar un endpoint con un interruptor de funcionalidad.
3. **Evaluar.** Determinar qué datos, de cuántas personas y desde cuándo, con los logs y el id de correlación.
4. **Notificar.** La ley exige informar a la autoridad de protección de datos cuando hay violaciones de los códigos de seguridad con riesgo para los datos de los titulares (art. 17 (n) de la Ley 1581); los plazos y el formato se validan con asesoría legal. Avisar también a las personas afectadas.
5. **Corregir y restaurar.** Arreglar la causa, restaurar desde copia de seguridad si hace falta y agregar la prueba que habría detectado el fallo.
6. **Aprender.** Escribir un postmortem sin culpables y, si cambia la arquitectura, un ADR.
