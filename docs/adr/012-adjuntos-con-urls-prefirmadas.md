# ADR-012: Adjuntos en almacenamiento de objetos con URLs prefirmadas

- **Estado:** Aceptada
- **Fecha:** 1 de octubre de 2026

## Contexto

Las fotos de recibos pesan mucho más que los datos de un movimiento. Si pasan por la API, la cargan de binarios y limitan su escala.

## Decisión

Los archivos van a un almacenamiento de objetos compatible con S3. La API registra el adjunto y entrega una URL prefirmada, con tipo y tamaño máximos y caducidad corta; la app sube y descarga directamente.

## Alternativas descartadas

- **Subir por la API:** más simple al inicio, pero la API maneja binarios y escala peor.

## Consecuencias

- La API sigue sin estado y liviana; el bucket es privado.
- La foto se guarda primero en el dispositivo y se sube al sincronizar con conexión.
- **Hito 0:** en local, RustFS reemplaza a MinIO, que dejó de publicar imágenes de su edición libre; valida credenciales y firmas como S3.
