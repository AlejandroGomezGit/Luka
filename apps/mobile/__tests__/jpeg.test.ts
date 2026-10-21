import { jpegHasLocation } from '../src/files/jpeg';
import { testJpeg } from '../src/files/testing';

describe('HU-06 #18 ubicación en el JPEG del recibo', () => {
  it('HU-06 #18 un JPEG con el bloque GPS en el Exif trae ubicación; el mismo sin él, no', () => {
    expect(jpegHasLocation(testJpeg({ exif: 'gps' }))).toBe(true);
    expect(jpegHasLocation(testJpeg({ exif: 'plain' }))).toBe(false);
  });

  it('HU-06 #18 también con Exif en orden Intel, sin Exif, con GPS en XMP o en una imagen secundaria al final', () => {
    expect(jpegHasLocation(testJpeg({ exif: 'gps', littleEndian: true }))).toBe(true);
    expect(jpegHasLocation(testJpeg({ exif: 'plain', littleEndian: true }))).toBe(false);
    expect(jpegHasLocation(testJpeg())).toBe(false);
    expect(jpegHasLocation(testJpeg({ xmpGps: true }))).toBe(true);
    expect(jpegHasLocation(testJpeg({ exif: 'plain', trailingGps: true }))).toBe(true);
  });

  it('HU-06 #18 si no es un JPEG legible responde null: no se puede asegurar que no traiga ubicación', () => {
    const clean = testJpeg({ exif: 'plain' });
    // Un PNG, un archivo vacío y un JPEG cortado antes de empezar la imagen.
    expect(
      jpegHasLocation(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBeNull();
    expect(jpegHasLocation(new Uint8Array())).toBeNull();
    expect(jpegHasLocation(clean.subarray(0, 30))).toBeNull();
    // Un segmento que dice medir más que el archivo.
    const longer = clean.slice();
    longer[4] = 0x7f;
    expect(jpegHasLocation(longer)).toBeNull();
    // Un Exif con la cabecera TIFF dañada.
    const exifAt = clean.findIndex((b, i) => b === 0xff && clean[i + 1] === 0xe1);
    const broken = clean.slice();
    broken[exifAt + 10] = 0x00;
    expect(jpegHasLocation(broken)).toBeNull();
  });
});
