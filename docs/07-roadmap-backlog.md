# Roadmap y backlog

El MVP se construye en cinco hitos con una puerta de calidad cada uno; V2, el lanzamiento en la App Store y V3 vienen después, y cada puerta se verifica con las pruebas ya definidas.

## Hitos y puertas

El proyecto avanza por ocho hitos y no pasa al siguiente hasta cumplir la puerta del actual; el MVP cierra en el Hito 4, que ya sirve para uso personal en TestFlight, y el lanzamiento público espera al Hito 6.

&#91;embedded content: roadmap · 8 hitos con su puerta de calidad\]

No hay fechas porque el ritmo depende del tiempo que el dueño del proyecto pueda dedicarle; los hitos son una secuencia y no un calendario. Cada puerta se verifica con las pruebas del documento 6.

## Backlog inicial

Son 42 issues para los hitos 0 a 4, es decir, todo el MVP; V2 y V3 se mantienen como épicas hasta que se acerquen. Cada issue apunta a la historia, el caso de uso o el requisito que lo justifica, y Claude Code puede crearlos en GitHub con `gh issue create` a partir de esta tabla.

| ID | Issue | Hito | Etiquetas | Referencias |
| --- | --- | --- | --- | --- |
| T-001 | Inicializar el monorepo con pnpm, Turborepo y configuración compartida | H0 | `chore` `infra` | ADR-002 |
| T-002 | Pipeline de CI: lint, tipos, pruebas y build en cada pull request | H0 | `ci` | HU-11, RNF-11 |
| T-003 | Docker Compose local con PostgreSQL, Redis y almacenamiento compatible con S3 | H0 | `infra` | RNF-12 |
| T-004 | Paquete `domain`: dinero, fechas y validaciones base (INV-01 a INV-07) | H0 | `feature` `domain` | RNF-06 |
| T-005 | Paquete `contracts`: esquemas Zod y generación de OpenAPI | H0 | `feature` `api` | ADR-013 |
| T-006 | Esquemas Drizzle de PostgreSQL y SQLite con las migraciones iniciales | H0 | `feature` `db` | Documento 2 |
| T-007 | Esqueleto de la app Expo con navegación y tema | H0 | `feature` `mobile` | ADR-001 |
| T-008 | Esqueleto de la API NestJS con health checks y logs estructurados | H0 | `feature` `api` | RNF-10 |
| T-009 | README, CONTRIBUTING, SECURITY, plantilla de PR y carpeta de ADRs | H0 | `docs` | Documento 6 |
| T-010 | Base local SQLite: migraciones al abrir y acceso mediante repositorios | H1 | `feature` `mobile` `db` | ADR-003 |
| T-011 | Cuentas: crear, editar y archivar | H1 | `feature` `mobile` | CU-05, HU-02 |
| T-012 | Categorías predefinidas y propias con UUID v5 | H1 | `feature` `mobile` | CU-13, HU-07 |
| T-013 | Registrar un gasto o ingreso en tres toques | H1 | `feature` `mobile` | CU-08, HU-03 |
| T-014 | Editar, eliminar y deshacer movimientos | H1 | `feature` `mobile` | CU-09, HU-04 |
| T-015 | Transferencias entre cuentas | H1 | `feature` `mobile` | CU-06, HU-02 |
| T-016 | Lista de movimientos con paginación por llave y filtros | H1 | `feature` `mobile` | CU-10, HU-05 |
| T-017 | Resumen mensual | H1 | `feature` `mobile` | CU-18, HU-08 |
| T-018 | Etiquetas y foto del recibo en el dispositivo | H1 | `feature` `mobile` | CU-11, HU-06 |
| T-019 | Registro, inicio de sesión y refresco con Argon2id y JWT | H2 | `feature` `api` `security` | CU-01, HU-01 |
| T-020 | Sign in with Apple | H2 | `feature` `api` `mobile` | CU-01 |
| T-021 | Recuperación de contraseña por correo | H2 | `feature` `api` | RF-01 |
| T-022 | Perfil, dispositivos y consentimientos | H2 | `feature` `api` | Documento 5 |
| T-023 | Eliminar la cuenta y todos los datos | H2 | `feature` `api` `security` | CU-03, HU-10 |
| T-024 | Bloqueo de la app con Face ID | H2 | `feature` `mobile` `security` | CU-02, HU-10 |
| T-025 | Límite de tasa y cabeceras de seguridad | H2 | `feature` `api` `security` | AM-01, AM-08 |
| T-026 | Seguridad a nivel de fila y pruebas de aislamiento entre usuarios | H2 | `feature` `db` `security` | INV-08, AM-03 |
| T-027 | Reloj lógico híbrido con pruebas de propiedades | H3 | `feature` `domain` `sync` | ADR-006 |
| T-028 | Fusión de operaciones por campo y por grupo de campos | H3 | `feature` `domain` `sync` | Documento 4 |
| T-029 | Outbox y estado de sincronización en el dispositivo | H3 | `feature` `mobile` `sync` | RF-23, RF-26 |
| T-030 | `POST /v1/sync` con idempotencia y secuencia por usuario | H3 | `feature` `api` `sync` | CU-21 |
| T-031 | Descarga completa y cursor vencido (`410`) | H3 | `feature` `api` `sync` | CU-21 |
| T-032 | Registro de conflictos y aviso en la app | H3 | `feature` `api` `mobile` `sync` | CU-22 |
| T-033 | Simulador multidispositivo determinista y ejecución nocturna | H3 | `test` `sync` | RNF-05 |
| T-034 | Indicador visible del estado de sincronización | H3 | `feature` `mobile` `sync` | RF-26 |
| T-035 | Adjuntos con URLs prefirmadas | H4 | `feature` `api` `mobile` | CU-11, ADR-012 |
| T-036 | Observabilidad: OpenTelemetry, Sentry y tableros | H4 | `infra` `api` | RNF-10 |
| T-037 | Pruebas E2E con Maestro del flujo sin conexión | H4 | `test` `mobile` | RNF-04 |
| T-038 | Pruebas de carga con k6 | H4 | `test` `api` | RNF-03 |
| T-039 | Accesibilidad: Dynamic Type y VoiceOver | H4 | `feature` `mobile` | RNF-13 |
| T-040 | Terraform y despliegue de staging | H4 | `infra` | Documento 3 |
| T-041 | Builds de TestFlight con EAS | H4 | `ci` `mobile` | Documento 6 |
| T-042 | Manifiesto de privacidad y revisión de dependencias | H4 | `chore` `mobile` `security` | Documento 5 |

## Épicas de V2, lanzamiento y V3

Dieciséis épicas cubren todo lo que queda después del MVP; cada una se divide en issues cuando su hito sea el siguiente, no antes, para no planificar sobre supuestos que van a cambiar.

| ID | Épica | Hito | Requisitos | Casos de uso | Dependencias |
| --- | --- | --- | --- | --- | --- |
| E-01 | Presupuestos y alertas push | H5 | RF-16, RF-17 | CU-15, CU-16 | Token push, worker y APNs |
| E-02 | Movimientos recurrentes | H5 | RF-18 | CU-17 | Worker e identificadores UUID v5 deterministas |
| E-03 | Importar CSV y revisar | H5 | RF-32, RF-34 | CU-26, CU-29 | `import_batches` e índice de duplicados |
| E-04 | Categorizador completo y reglas del usuario | H5 | RF-15, RF-28, RF-31 | CU-14, CU-24 | `token_stats`, `category_rules` y diccionario |
| E-05 | Registro rápido: widget y Atajos | H5 | RF-13 | CU-12 | App Intents de iOS, por validar con Expo |
| E-06 | Reportes y exportación a CSV | H5 | RF-21, RF-22 | CU-19, CU-20 | Resumen por categoría |
| E-07 | Varios dispositivos y conciliación | H5 | RF-07, RF-27 | CU-23, CU-07 | `DELETE /v1/devices/{id}` y notificación silenciosa |
| E-08 | Panel de operación | H5 | RF-36 | CU-30, CU-31 | `/v1/admin/*` y rol de operador |
| E-09 | Exportar todos mis datos | H5 | RF-04 | CU-04 | `GET /v1/export` |
| E-10 | Dividir un movimiento entre categorías | H5 | RF-12 | Sin redactar | Se redacta el caso de uso si se prioriza (prioridad Could) |
| E-11 | Lanzamiento en la App Store | H6 | Lista del documento 5 | Ninguno | Decisión sobre quién publica, política de privacidad y asesoría legal |
| E-12 | Escanear recibos | H7 | RF-30, RF-31 | CU-25 | Reconocimiento de texto en el dispositivo y `ai_external` |
| E-13 | Importar extractos en PDF | H7 | RF-33, RF-34 | CU-27 | Lectura de PDF y `ai_external` |
| E-14 | Conexión bancaria | H7 | RF-35 | CU-28 | Estándares de finanzas abiertas de la Superfinanciera, en espera de su publicación, `bank_connection` y la decisión de E-11 |
| E-15 | Suscripciones detectadas y aprendizaje | H7 | RF-19, RF-29 | CU-32, CU-33 | Historial de movimientos y `token_stats` |
| E-16 | Captura de movimientos desde mensajes | H5 | RF-37 a RF-40 | CU-34 a CU-36 y CU-29 | Tubería de captura (ADR-014), App Intents de E-05, muestras reales por banco y la validación del Atajo en un iPhone (R-13) |

## Etiquetas, definición de hecho y plantilla de issue

Un issue está terminado solo cuando cumple la lista de «definición de hecho»; las etiquetas y los hitos de GitHub permiten filtrar el trabajo sin abrir cada issue.

| Grupo | Etiquetas | Uso |
| --- | --- | --- |
| Tipo | `feature`, `bug`, `chore`, `docs`, `test`, `ci`, `infra` | Qué clase de trabajo es |
| Área | `mobile`, `api`, `domain`, `db`, `sync`, `security` | Qué parte del sistema toca |
| Fase | `mvp`, `v2`, `v3` | A qué versión pertenece |
| Prioridad | `P0`, `P1`, `P2` | `P0` bloquea el hito en curso |
| Estado | `blocked`, `needs-decision` | Espera algo o requiere una decisión del dueño |

Los hitos de GitHub (Milestones) se llaman igual que en el roadmap, por ejemplo «H3 · Sincronización».

### Definición de hecho

- [ ] Cumple los criterios de aceptación de la historia o del caso de uso, con una prueba por cada criterio.
- [ ] Lint, tipos, pruebas y build pasan en CI.
- [ ] Si toca `packages/domain`, su cobertura sigue en 80 % o más.
- [ ] Si cambia el esquema, la migración se probó desde cero y desde la versión anterior.
- [ ] Si cambia el contrato de la API, el OpenAPI se regeneró y las pruebas de contrato pasan.
- [ ] No hay datos financieros en los logs ni secretos en el código.
- [ ] Si hay interfaz, funciona con Dynamic Type y VoiceOver y, cuando aplica, sin conexión.
- [ ] La documentación afectada está actualizada y, si cambió la arquitectura, hay un ADR.

### Plantilla de issue

```markdown
## Contexto
Historia (HU-xx), caso de uso (CU-xx) o requisito (RF-xx, RNF-xx) que lo justifica.

## Qué hay que hacer
Descripción corta y concreta.

## Criterios de aceptación
- [ ] Dado ..., cuando ..., entonces ...
- [ ] ...

## Fuera de alcance
Lo que este issue no incluye.

## Pruebas
Qué pruebas lo demuestran y en qué nivel.

## Notas
Dependencias, decisiones abiertas y documentos que hay que actualizar.
```

## Riesgos del proyecto

El riesgo que más puede cambiar el plan es quién publica la app en la App Store; los demás son manejables con las puertas de calidad de cada hito.

| ID | Riesgo | Por qué importa | Mitigación | Se revisa en |
| --- | --- | --- | --- | --- |
| R-01 | La revisión de Apple trata a Luka como app financiera y exige una persona jurídica (5.1.1 (ix), 3.2.1 (viii)) | Puede bloquear el lanzamiento | Decidirlo con asesoría legal antes del H6 y preparar las notas para el revisor | H4 |
| R-02 | El alcance supera lo que una sola persona puede hacer | Retrasos y calidad desigual | Hitos con puertas; V2 y V3 sin detalle hasta que lleguen; recortar V2 antes que la calidad del MVP | Cierre de cada hito |
| R-03 | El motor de sincronización no converge o resulta demasiado complejo | Pérdida de confianza en los datos | Pruebas de propiedades y simulador desde el inicio; si falla en el H3, reevaluar con un ADR | H3 |
| R-04 | El reconocimiento de texto en el dispositivo no funciona bien con Expo | Retrasa los recibos de V3 | Validar un prototipo en el H4; alternativa: respaldo de IA externa con consentimiento | H4 |
| R-05 | Los bancos tardan en habilitar el acceso a sus datos | La conexión bancaria no se puede entregar | Seguir el cronograma de la Superfinanciera; V3 puede salir sin esa épica y la tubería de captura permite sumarla después | Antes del H7 |
| R-06 | La configuración de Metro con pnpm falla en el monorepo | Frena el H0 | Validarlo en T-001 y T-007; alternativa: enlazado `hoisted` de pnpm | H0 |
| R-07 | Apple rechaza la app por privacidad o inicio de sesión | Demora el lanzamiento | Lista del documento 5, cuenta de demostración, notas y TestFlight previo | H6 |
| R-08 | Los costos de infraestructura superan los ingresos | Hace inviable operar | Etapa 0 de bajo costo, seguimiento mensual y decidir el modelo de ingresos antes del H6; si hay suscripción, debe usar compras dentro de la app (3.1.1) | H5 |
| R-09 | Incumplir la Ley 1581 de 2012 | Multas y cierre de operaciones | Tabla de cumplimiento del documento 5 y asesoría legal | H6 |
| R-10 | Un error de sincronización pierde datos de un usuario | Daño directo a las personas | Pruebas de propiedades, copias de seguridad y exportación de datos (E-09) antes del lanzamiento | H5 |
| R-11 | La calidad del código generado con Claude Code varía | Deuda técnica y errores sutiles | `CLAUDE.md`, issues pequeños, pruebas obligatorias y revisión de cada PR | Cierre de cada hito |
| R-12 | Las guías de Apple cambian | Una lista vieja deja de servir | Volver a verificar las guías antes de cada envío | Cada envío |
| R-13 | La automatización de Atajos no corre sola o iOS cambia cómo funciona | La captura automática pierde su gracia | Validarla en un iPhone real en el H5; si siempre pide confirmación, queda como un atajo de un toque y se refuerza pegar o compartir | H5 |
