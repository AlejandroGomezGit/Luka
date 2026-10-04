# Monorepo y CLAUDE.md

Para pasar este diseño a Claude Code bastan tres cosas: los documentos en `docs/`, un `CLAUDE.md` en la raíz y un primer prompt por hito; esta pestaña trae las tres.

## Cómo pasar todo a Claude Code

Son seis pasos, y el primero lo hace usted a mano porque exportar un documento es una acción de la interfaz.

1. **Exportar los documentos.** Con cada pestaña abierta, haga clic en el nombre del documento y elija Exportar y luego Markdown; solo exporta la pestaña abierta, así que son ocho exportaciones. Guárdelas con estos nombres: `01-producto.md`, `0``2-modelo-de-datos``.md`, `03-arquitectura-adrs.md`, `04-sincronizacion-api.md`, `05-seguridad-privacidad.md`, `06-pruebas-ci-observabilidad.md`, `07-roadmap-backlog.md` y `08-monorepo-claude-md.md`.
2. **Crear el repositorio** con la carpeta `docs/` y el `CLAUDE.md` de la sección siguiente.
3. **Subirlo a GitHub** usted mismo, porque requiere iniciar sesión en su cuenta.
4. **Abrir Claude Code en la raíz del repositorio.** Lee `CLAUDE.md` al arrancar, que es donde viven las instrucciones permanentes del proyecto.
5. **Pegar el prompt del Hito 0** (sección 4) y revisar el plan antes de que escriba código.
6. **Avanzar un hito a la vez.** Cada hito termina cuando se cumple su puerta de calidad (documento 7); entonces se actualizan los documentos y se pasa al siguiente.

```bash
mkdir luka && cd luka
git init -b main
mkdir docs                     # copie aquí los ocho .md exportados
# cree CLAUDE.md en la raíz con el texto de la sección 2
# cree .claude/settings.json con el texto de la sección 3
git add . && git commit -m "docs: diseño inicial del producto"
gh auth login
gh repo create luka --private --source=. --push
```

El repositorio nace privado; se hace público cuando el README, los diagramas y los ADRs estén listos para ser leídos por un reclutador. El nombre `luka` es provisional, igual que el de la app.

## CLAUDE.md propuesto

Este archivo va en la raíz del repositorio y reúne lo que no cambia de una tarea a otra: dónde está cada decisión, las reglas que no se negocian y cómo trabajar. Claude Code lo carga al iniciar ([documentación de Claude Code](https://code.claude.com/docs/en/settings)); el detalle vive en `docs/`, no aquí.

## Variables, scripts y permisos

El repositorio incluye un `.env.example` con valores falsos y nunca un `.env` real; los scripts de la raíz son la única puerta de entrada para trabajar, de modo que Claude Code y usted usan los mismos comandos.

### Variables de entorno

| Variable | Para qué | Dónde se usa | Valor de ejemplo |
| --- | --- | --- | --- |
| `APP_ENV` | Entorno de ejecución | API y app | `local` |
| `DATABASE_URL` | Conexión a PostgreSQL | API y worker | `postgres://luka_app:luka-app-local@localhost:15432/luka` |
| `REDIS_URL` | Cola de trabajos | API y worker | `redis://localhost:6379` |
| `JWT_PRIVATE_KEY` y `JWT_PUBLIC_KEY` | Firma y verificación de tokens de acceso | API | Se generan en local y no se versionan |
| `REFRESH_TOKEN_PEPPER` | Secreto para el hash de los tokens de refresco | API | `cambia-esto-en-local` |
| `APPLE_CLIENT_ID` | Audiencia esperada del token de Sign in with Apple | API | `com.ejemplo.luka` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Almacenamiento de objetos; en desarrollo, uno local compatible con S3 | API | `http://localhost:9000` y `luka-attachments` |
| `SMTP_URL` | Envío de correos; en desarrollo, un servidor de pruebas local | API y worker | `smtp://localhost:1025` |
| `SENTRY_DSN` | Reporte de errores | API y app | Vacío en local |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Trazas y métricas | API y worker | `http://localhost:4318` |
| `EXPO_PUBLIC_API_URL` | Dirección de la API que usa la app | App | `http://localhost:3000` |

Las variables con prefijo `EXPO_PUBLIC_` terminan dentro del paquete de la app, así que jamás llevan secretos.

### Scripts de la raíz

| Comando | Qué hace |
| --- | --- |
| `pnpm dev:api` | Levanta la API con recarga automática |
| `pnpm dev:mobile` | Levanta el servidor de Expo |
| `pnpm lint` y `pnpm typecheck` | ESLint y TypeScript en todo el monorepo |
| `pnpm test` | Pruebas unitarias, de propiedades y de componentes |
| `pnpm test:api` | Pruebas de integración de la API con Testcontainers |
| `pnpm sim:sync --seeds N` | Simulador de sincronización con `N` semillas (desde H3, T-033) |
| `pnpm build` | Compila todos los paquetes y aplicaciones |
| `pnpm db:generate` | Genera migraciones SQL con `drizzle-kit` |
| `pnpm db:migrate` | Aplica las migraciones en PostgreSQL local |
| `docker compose -f infra/docker-compose.yml up -d` | Levanta PostgreSQL, Redis, almacenamiento de objetos y correo de pruebas |

### Permisos de Claude Code

El archivo `.claude/settings.json` se versiona con el repositorio. Deja pasar sin preguntar los comandos de verificación, pide confirmación antes de subir cambios y le prohíbe leer los archivos de secretos reales; `.env.example` sigue siendo legible. Según la [documentación de Claude Code](https://code.claude.com/docs/en/settings), las reglas `deny` y `ask` de un archivo versionado se aplican de inmediato, mientras que las reglas `allow` esperan a que cada persona confíe en la carpeta.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(pnpm lint)",
      "Bash(pnpm typecheck)",
      "Bash(pnpm test *)",
      "Bash(pnpm build)"
    ],
    "ask": [
      "Bash(git push *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(./.env.production)"
    ]
  }
}
```

## Prompts de arranque por hito

Cada hito empieza con un prompt que fija el alcance, la puerta de calidad y el orden de trabajo, y termina con uno de cierre; así Claude Code nunca decide solo qué construir ni cuándo dar algo por terminado.

### Plantilla

```text
Lee CLAUDE.md y los documentos de docs/ que cita. Vamos a trabajar el hito <Hn · nombre>.

Alcance: los issues <T-xxx a T-yyy> de docs/07-roadmap-backlog.md.
Puerta de calidad: <criterio de la puerta>.

Antes de escribir código:
1. Resume en pocas líneas el plan del primer issue y los archivos que tocarás.
2. Dime las dudas o contradicciones que encuentres en los documentos.

Luego trabaja un issue a la vez, en su propia rama, con pruebas. Al terminar cada uno, ejecuta lint, typecheck y las pruebas y muéstrame el resultado real. No hagas push sin que yo lo apruebe.
```

### Hito 0 · Cimientos

```plain
Lee CLAUDE.md y docs/03-arquitectura-adrs.md, docs/06-pruebas-ci-observabilidad.md y docs/07-roadmap-backlog.md.

Vamos a construir el Hito 0 (Cimientos): los issues T-001 a T-009. Puerta de calidad: pipeline de CI en verde con al menos una prueba por paquete y la infraestructura local levantando con docker compose.

Empieza por T-001. Antes de escribir código, dime el plan, los archivos que vas a crear y cualquier duda sobre la configuración de Metro con pnpm (riesgo R-06).

Cuando T-001 esté listo, prepara la creación de los milestones H0 a H4 y de los issues T-001 a T-042 en GitHub con gh, usando la tabla del documento 07 y la plantilla de issue. Muéstrame la lista antes de crearlos.
```

### Hito 1 · Núcleo local

```text
Lee CLAUDE.md, docs/01-producto.md y docs/02-modelo-de-datos.md.

Hito 1 (Núcleo local): issues T-010 a T-018. Puerta de calidad: HU-02 a HU-08 con sus pruebas y la app funcionando completa, sin servidor, en el simulador.

Usa el documento 02 para el esquema y los invariantes, y el documento 01 para CU-05, CU-06, CU-08, CU-09, CU-10, CU-11, CU-13 y CU-18. Escribe primero las pruebas de los criterios de aceptación de cada historia y luego la implementación.
```

### Hito 3 · Sincronización

```text
Lee CLAUDE.md, docs/04-sincronizacion-api.md completo y los ADR-005 y ADR-006.

Hito 3 (Sincronización): issues T-027 a T-034. Puerta de calidad: simulación de 1 000 semillas sin divergencia (RNF-05) y E2E sin conexión en verde.

Empieza por las pruebas de propiedades de T-027 y T-028, antes de implementar el reloj lógico híbrido y la fusión. No avances a T-030 hasta que esas propiedades pasen. Construye el simulador (T-033) antes de dar el motor por terminado y no ajustes una propiedad para que pase: si falla, el motor está mal.
```

### Cierre de cualquier hito

```text
Verifica la puerta de calidad del hito <Hn> según docs/07-roadmap-backlog.md y dime, punto por punto, qué se cumple y qué no, con la evidencia (salida de las pruebas, métricas).

Revisa que docs/ refleje lo que se implementó y propón las actualizaciones necesarias. Lista la deuda técnica que quedó y los riesgos de la tabla que cambiaron. No empieces el hito siguiente.
```

Para los hitos 2 y 4 se usa la plantilla con sus issues (T-019 a T-026 y T-035 a T-042) y sus puertas del roadmap.

## Cómo mantener los documentos al día

Desde el Hito 0, la copia de `docs/` en el repositorio es la oficial y este documento queda como el diseño inicial; si ambos divergen, manda el repositorio.

- **Un cambio de arquitectura exige un ADR** en `docs/adr/` (por ejemplo `015-titulo.md`), con contexto, decisión, alternativas y consecuencias. Los 14 ADRs del documento 3 se convierten en archivos durante el Hito 0 (T-009).
- **Un cambio de comportamiento actualiza el documento afectado en el mismo pull request**, no después.
- **Cierre de hito.** El prompt de cierre pide revisar que `docs/` refleje lo implementado antes de abrir el siguiente hito.
- **Índice.** Un `docs/README.md` lista los documentos y los ADRs con una línea cada uno, y el `README.md` de la raíz enlaza ahí.
- **Fuentes que caducan.** La lista de la App Store (documento 5) se basa en guías consultadas el 1 de octubre de 2026; se vuelve a verificar antes de cada envío a revisión.
- **Decisiones abiertas** que el diseño dejó pendientes: nombre definitivo de la app, cuándo retomar la conexión bancaria (depende de los estándares de la Superfinanciera), quién publica en la App Store y modelo de ingresos. Cada una se cierra con un ADR cuando se decida.
