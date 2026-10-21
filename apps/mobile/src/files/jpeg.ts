/**
 * Ubicación en un JPEG (HU-06, #18): la foto del recibo se guarda sin GPS. Recorre la estructura del
 * archivo y cada bloque Exif o XMP, también los de imágenes secundarias pegadas al final (MPF), y busca
 * el puntero al bloque GPS (etiqueta 0x8825) o las propiedades GPS de XMP.
 */

const GPS_IFD_TAG = 0x8825;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]; // «Exif\0\0»
const XMP_GPS = ['GPSLatitude', 'GPSLongitude'].map((name) =>
  Array.from({ length: name.length }, (_, k) => name.charCodeAt(k)),
);

const matches = (bytes: Uint8Array, at: number, pattern: readonly number[]) =>
  pattern.every((value, k) => bytes[at + k] === value);
const u16 = (bytes: Uint8Array, at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);

/** El IFD0 de un bloque TIFF (el cuerpo del Exif) tiene la etiqueta GPS; null si está dañado. */
function tiffHasGps(tiff: DataView): boolean | null {
  if (tiff.byteLength < 8) return null;
  const order = tiff.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const le = order === 0x4949;
  if (tiff.getUint16(2, le) !== 42) return null;
  const offset = tiff.getUint32(4, le);
  if (offset + 2 > tiff.byteLength) return null;
  const count = tiff.getUint16(offset, le);
  if (offset + 2 + 12 * count > tiff.byteLength) return null;
  for (let k = 0; k < count; k++) {
    if (tiff.getUint16(offset + 2 + 12 * k, le) === GPS_IFD_TAG) return true;
  }
  return false;
}

/** Recorre los segmentos de la cabecera hasta el inicio de la imagen (SOS); false si están mal formados. */
function wellFormed(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) return false;
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xff) {
      i++; // relleno permitido entre segmentos
      continue;
    }
    if (marker === 0xda) return true;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = u16(bytes, i + 2);
    if (length < 2 || i + 2 + length > bytes.length) return false;
    i += 2 + length;
  }
  return false;
}

/**
 * true si el JPEG trae ubicación, false si no, y null si no es un JPEG legible: entonces no se puede
 * asegurar que no la traiga.
 */
export function jpegHasLocation(bytes: Uint8Array): boolean | null {
  if (!wellFormed(bytes)) return null;
  let readable = true;
  for (let i = 0; i + 4 < bytes.length; i++) {
    const byte = bytes[i];
    // Cada segmento APP1 con Exif, en la imagen principal o en una secundaria.
    if (byte === 0xff && bytes[i + 1] === 0xe1 && matches(bytes, i + 4, EXIF_HEADER)) {
      const length = u16(bytes, i + 2);
      const start = i + 4 + EXIF_HEADER.length;
      const end = i + 2 + length;
      if (length < 2 + EXIF_HEADER.length || end > bytes.length) return null;
      const gps = tiffHasGps(new DataView(bytes.buffer, bytes.byteOffset + start, end - start));
      if (gps) return true;
      if (gps === null) readable = false;
    } else if (byte === 0x47 && XMP_GPS.some((pattern) => matches(bytes, i, pattern))) {
      return true;
    }
  }
  return readable ? false : null;
}
