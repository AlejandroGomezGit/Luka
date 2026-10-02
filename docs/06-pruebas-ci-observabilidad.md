# Pruebas, CI/CD y observabilidad

Ningún cambio llega a producción sin pasar pruebas automáticas, y todo lo que corre en producción deja logs, métricas y trazas con el mismo id de correlación.

## Estrategia de pruebas

La mayor parte de la confianza viene de pruebas rápidas y deterministas sobre el dominio y la sincronización, y unas pocas pruebas lentas de punta a punta cubren los flujos que no pueden fallar. Cada criterio de aceptación de una historia de usuario termina en una prueba cuyo nombre incluye el id de la historia, por ejemplo `HU-03`.

| Nivel | Qué cubre | Herramienta | Meta | Cuándo corre |
| --- | --- | --- | --- | --- |
| Unitarias | Dinero, fechas, invariantes y utilidades de `packages/domain` | Jest | Cobertura de 80 % o más en `domain` (RNF-11) | Cada PR |
| Propiedades | Idempotencia, orden de llegada, convergencia y reloj lógico (documento 4) | fast-check | Todas las propiedades en verde | Cada PR |
| Categorizador | Calidad del acierto con un conjunto de prueba etiquetado y reservado | Jest | El acierto no empeora entre versiones | Cada PR que toque el categorizador |
| Componentes de la app | Pantallas y formularios de HU-02 a HU-08, con casos felices y de error | Jest y React Native Testing Library | Cada criterio de aceptación con su prueba | Cada PR |
| Integración de la API | Endpoints contra PostgreSQL y Redis reales | `inject` de Fastify (sin abrir un puerto) y Testcontainers | Por endpoint: éxito, validación, autenticación y aislamiento entre usuarios | Cada PR |
| Contrato | La API cumple el OpenAPI y la app cumple el contrato | Pruebas de contrato sobre el OpenAPI generado | Ningún cambio que rompa sin subir de versión | Cada PR |
| Migraciones | Esquemas de PostgreSQL y SQLite | Scripts de CI | Aplicar desde cero y desde la versión anterior | Cada PR que cambie el esquema |
| Simulación de sincronización | Convergencia con varios dispositivos, relojes desfasados y red defectuosa | Simulador propio | 50 semillas por PR y 1 000 de noche | PR y nocturno |
| E2E móvil | Registro, gasto sin conexión, sincronización y eliminación de cuenta | Maestro en el simulador de iOS | Flujos críticos en verde | Antes de cada versión |
| Seguridad | Secretos, dependencias, análisis estático y escaneo dinámico (documento 5) | gitleaks, osv-scanner, CodeQL, ZAP | Sin hallazgos críticos | PR y nocturno |
| Carga | Sincronización con 1 000 usuarios simulados (RNF-03) | k6 | p95 menor a 300 ms | De noche y antes de lanzar |
| Accesibilidad | VoiceOver, Dynamic Type y contraste (RNF-13) | Accessibility Inspector y revisión manual | Flujos principales sin bloqueos | Antes de cada versión |
| Lectores de mensajes | Cada banco reconoce sus mensajes y extrae monto, comercio, fecha y tarjeta, incluidos los formatos de monto colombianos | Jest con muestras reales sin datos personales | Una muestra por cada formato; ningún lector sin muestras | Cada PR que toque la captura |

**Reglas para que las pruebas sirvan**

- El reloj y el azar se inyectan en el código; ninguna prueba depende de la hora real ni de datos al azar sin semilla.
- Los datos de prueba salen de fábricas (builders) compartidas, no de archivos copiados a mano.
- Una prueba inestable se arregla o se desactiva con un issue en menos de una semana; nunca se vuelve a ejecutar «hasta que pase».
- La pirámide se respeta: muchas pruebas de dominio y propiedades, pocas de punta a punta.

* La automatización de Atajos la ejecuta el sistema y no se puede automatizar en CI; se prueba a mano con un mensaje real antes de cada versión que toque la captura.

## Pipeline de integración y despliegue

Un cambio recorre el mismo camino en la API y en la app hasta la fusión; después, la API llega a producción con una etiqueta aprobada a mano y la app pasa por TestFlight y por la revisión de Apple.

&#91;embedded content: pipeline CI/CD · API y app iOS\]

Si cualquier verificación falla, el cambio vuelve al autor y no se fusiona. Las pruebas nocturnas (simulación con 1 000 semillas, carga y escaneo ZAP) no frenan el PR, pero un fallo abre un issue con prioridad antes del siguiente hito.

## Reglas del repositorio

`main` siempre está listo para desplegar, y las reglas de GitHub lo hacen cumplir en lugar de depender de la disciplina.

| Tema | Regla | Para qué sirve |
| --- | --- | --- |
| Ramas | `main` protegida; ramas cortas con prefijo `feat/`, `fix/`, `chore/`, `docs/` o `ci/` | Cambios pequeños y reversibles |
| Fusión | Solo por pull request, con CI en verde e historial lineal; sin push directo | Nada llega a `main` sin pasar el pipeline |
| Tamaño | Un PR resuelve un issue y apunta a menos de 400 líneas cambiadas | Revisiones que realmente se leen |
| Commits | Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `ci:`, `chore:` | Changelog y versiones automáticos |
| Plantilla de PR | Qué cambia, historia o caso de uso relacionado, capturas si hay interfaz y la lista de «definición de hecho» | Trazabilidad con los documentos |
| Revisión | Como el proyecto es de una sola persona, cada PR pasa por autorrevisión con la lista de la plantilla y por el CI | Compensar la falta de un segundo revisor |
| Versiones | SemVer; la API en `/v1`; etiquetas `api-vX.Y.Z` y `app-vX.Y.Z` | Saber qué corre en cada entorno |
| Changelog | Generado con release-please a partir de los commits | Historia legible sin trabajo manual |
| Dependencias | pnpm con archivo de bloqueo y actualizaciones automáticas agrupadas | Menos deuda y menos vulnerabilidades |
| Documentación | Un cambio de arquitectura exige un ADR y uno de comportamiento exige actualizar el documento afectado | Que `docs/` nunca contradiga al código |

## Observabilidad

Cada petición deja logs, métricas y una traza con el mismo id de correlación, de modo que un reporte de un usuario se sigue desde la app hasta la fila de la base de datos sin adivinar. Nada de lo que se captura contiene datos financieros.

| Pilar | Qué se captura | Herramienta | Reglas |
| --- | --- | --- | --- |
| Logs | JSON con `requestId`, id interno del usuario, ruta, estado, duración, `deviceId` y `schema_version` | Pino hacia la plataforma de logs | Sin importes, comercios, notas ni correos (documento 5); 30 días |
| Métricas | Tasa, errores y duración por endpoint, más las de negocio: operaciones aplicadas por segundo, conflictos por cada 1 000 operaciones, `rejected` por código, retraso de la cola, tamaño de `sync_ops` y conexiones usadas de PostgreSQL | OpenTelemetry hacia Prometheus y Grafana, o el equivalente del proveedor | Etiquetas con poca variedad; nunca ids de usuario |
| Trazas | De la app a la API y a la base de datos mediante `traceparent` | OpenTelemetry | Muestreo del 100 % en staging y el 10 % en producción, como punto de partida |
| Errores y caídas | Excepciones de la API y de la app, y fallos de iOS | Sentry | Se eliminan datos sensibles antes de enviar; los símbolos se suben desde el CI |
| Salud | `/healthz` indica si el proceso vive y `/readyz` si PostgreSQL y Redis responden | Balanceador y monitoreo externo | `/readyz` falla antes de que la API reciba tráfico roto |

**La telemetría de la app es opcional.** Los reportes de fallos y las métricas que salen del dispositivo se activan solo si la persona lo acepta en la incorporación o en Ajustes, porque Apple exige consentimiento para recoger datos de uso aunque sean anónimos (guía 5.1.1 (ii)). Sin esa aceptación, la observabilidad se apoya únicamente en lo que ve el servidor.

**Tableros mínimos.** Uno de salud de la API, uno de sincronización (conflictos, rechazos, duplicados y `410` por hora) y uno de trabajos en segundo plano. Se construyen en el Hito 4 y se revisan al cierre de cada hito.

## Objetivos de servicio y alertas

Cada objetivo tiene una alerta que avisa antes de incumplirlo. Los valores son iniciales y se ajustan con los primeros meses de datos reales.

| Indicador | Objetivo | Alerta | Gravedad |
| --- | --- | --- | --- |
| Disponibilidad de la API (RNF-14) | 99,5 % mensual | Más de 2 % de respuestas `5xx` durante 5 minutos | Alta |
| Latencia de `POST /v1/sync` (RNF-03) | p95 menor a 300 ms | p95 mayor a 500 ms durante 10 minutos | Media |
| Éxito de la sincronización | 99 % o más de operaciones sin rechazo | Más de 1 % de `rejected` en 15 minutos | Media |
| Retraso de la cola de trabajos | Menos de 5 minutos | Más de 15 minutos | Media |
| Conexiones a PostgreSQL | Menos del 80 % del límite | Más del 80 % durante 10 minutos | Media |
| Sesiones de la app sin fallos | 99 % o más, entre quienes aceptaron compartir diagnósticos | Caída bajo 98 % tras una versión | Media |
| Copias de seguridad | Una correcta por día | Falla una copia | Alta |
| Certificados TLS | Renovados con más de 14 días de margen | Quedan menos de 14 días | Baja |

Una disponibilidad de 99,5 % al mes deja un presupuesto de unas 3 horas y 36 minutos de caída en un mes de 30 días. Cuando el presupuesto se agota, se detienen las funcionalidades nuevas hasta recuperar la estabilidad.

## Lanzamientos, reversas y copias de seguridad

Todo lanzamiento tiene un camino de vuelta probado antes de salir, porque en una app financiera un error se corrige más rápido de lo que se perdona.

| Tema | Decisión | Detalle |
| --- | --- | --- |
| Despliegue de la API | Progresivo, con verificación de salud | Se sustituyen las instancias de a una y solo se continúa si `/readyz` responde |
| Reversa de la API | Volver a desplegar la imagen anterior por su etiqueta | Las migraciones se escriben primero para expandir y luego para contraer (documento 2), así la versión anterior sigue funcionando con el esquema nuevo |
| Versión de la app | EAS Build, TestFlight, revisión de Apple y liberación por fases en App Store Connect | Un defecto grave se frena pausando la liberación y publicando una corrección |
| Actualizaciones OTA | Solo para correcciones de JavaScript sin cambios de esquema local | Las funciones nuevas viajan en una versión revisada por Apple, porque la guía 2.5.2 no permite descargar código que introduzca o cambie funcionalidades |
| Interruptores de funcionalidad | Un conjunto pequeño de banderas que la API entrega a la app al iniciar | Permiten apagar de inmediato `ai_external`, la conexión bancaria o la importación sin publicar una versión |
| Copias de seguridad | Automáticas, con recuperación a un punto en el tiempo | Retención de 35 días, coherente con la eliminación de cuentas (documento 5); objetivo inicial de pérdida de datos de 15 minutos y de recuperación de 4 horas |
| Simulacro de restauración | Cada trimestre, en un entorno aparte | Se mide cuánto tarda y se corrige el procedimiento si falla |
| Migraciones destructivas | Solo dos versiones después de dejar de usar la columna | Evita perder datos si hay que volver atrás |
