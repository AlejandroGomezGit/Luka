# Ícono de Luka · Monograma A (Coral)

Diseño original elegido el 3 de octubre de 2026: una «L» formada por dos láminas de vidrio que se cruzan sobre un fondo coral. Donde se cruzan, el vidrio se ve más brillante.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `luka-icono-claro-1024.png` | Ícono principal, 1024 × 1024 px, sin transparencia y sin esquinas redondeadas (iOS las aplica). Sirve como respaldo y para la App Store. |
| `luka-icono-oscuro-1024.png` | Referencia de la variante oscura. |
| `luka-icono-tenido-1024.png` | Referencia de la variante teñida (iOS tiñe el ícono con el color que elija la persona). |
| `luka-icono-*.svg` | Las mismas tres variantes en vector, para editar o volver a exportar. |
| `capas/fondo.svg` | Capa de fondo plana para Icon Composer. |
| `capas/l-vertical.svg`, `capas/l-horizontal.svg` | Las dos láminas de la L, planas y en blanco, cada una en su propia capa. |

## Colores y geometría

- Fondo: degradado diagonal de `#FF9466` (arriba a la izquierda) a `#E2386F` (abajo a la derecha).
- Lámina vertical: rectángulo de 200 × 580 px en (280, 220), esquinas de 100 px.
- Lámina horizontal: rectángulo de 470 × 200 px en (280, 600), esquinas de 100 px.
- Medidas sobre un lienzo de 1024 × 1024 px. La L queda centrada ópticamente.
- Variante oscura: fondo casi negro (`#1E1E26` a `#08080B`) con las láminas teñidas de coral.

## Versión final para iOS 26

Las capas de `capas/` son planas a propósito: en iOS 26 el efecto de vidrio (brillo, translucidez y sombra) lo agrega el sistema a partir de las capas que se arman en Icon Composer, la herramienta de Apple para íconos. Los PNG de esta carpeta muestran una aproximación de ese efecto.

1. Abrir Icon Composer (viene con Xcode 26 o se descarga del sitio de Apple para desarrolladores).
2. Usar `fondo.svg` como fondo, o poner el degradado con los dos colores de arriba.
3. Agregar `l-vertical.svg` y `l-horizontal.svg` en grupos separados, para que el cruce se vea como dos vidrios superpuestos.
4. Revisar las vistas clara, oscura y teñida, y los tamaños pequeños.
5. Exportar el archivo `.icon` y guardarlo en el repositorio junto a este LEEME.

## Uso en la app

- Cómo se declara el ícono en Expo SDK 57 (archivo `.icon` de Icon Composer o PNG de 1024 px) hay que verificarlo en la documentación de esa versión.
- En Expo Go siempre se ve el ícono de Expo Go: el de Luka solo aparece en un build de desarrollo o en TestFlight.
- El diseño es original y no usa fuentes ni imágenes de terceros, lo que simplifica el inventario de licencias del Hito 6.
