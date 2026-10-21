/** Solo para pruebas: JPEG mínimos armados byte a byte, con o sin ubicación (#18). */

interface JpegOptions {
  /** Exif con el puntero al bloque GPS (0x8825), o solo con la orientación. */
  exif?: 'gps' | 'plain';
  /** Orden de bytes del Exif: Motorola (MM, el del iPhone) o Intel (II). */
  littleEndian?: boolean;
  /** XMP con la latitud, como lo escriben algunos editores. */
  xmpGps?: boolean;
  /** Una imagen secundaria al final, como en MPF, con su propio Exif con GPS. */
  trailingGps?: boolean;
}

const segment = (marker: number, body: number[]) => [
  0xff,
  marker,
  (body.length + 2) >> 8,
  (body.length + 2) & 0xff,
  ...body,
];

function exif(gps: boolean, le: boolean): number[] {
  const w16 = (v: number) => (le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const w32 = (v: number) =>
    le
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]
      : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const entries = gps ? 2 : 1;
  const gpsOffset = 8 + 2 + 12 * entries + 4;
  const ifd0 = [
    ...w16(entries),
    ...w16(0x0112),
    ...w16(3),
    ...w32(1),
    ...w16(1),
    0,
    0, // orientación
    ...(gps ? [...w16(0x8825), ...w16(4), ...w32(1), ...w32(gpsOffset)] : []),
    ...w32(0),
  ];
  // Bloque GPS con LatitudeRef «N»: basta para que la etiqueta apunte a algo real.
  const gpsIfd = gps
    ? [...w16(1), ...w16(0x0001), ...w16(2), ...w32(2), 0x4e, 0, 0, 0, ...w32(0)]
    : [];
  const tiff = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...w16(42), ...w32(8), ...ifd0, ...gpsIfd];
  return segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
}

const ascii = (text: string) => Array.from({ length: text.length }, (_, k) => text.charCodeAt(k));

export function testJpeg(options: JpegOptions = {}): Uint8Array {
  const image = (meta: number[]) => [
    0xff,
    0xd8,
    ...segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...meta,
    ...segment(0xda, [1, 1, 0, 0, 0x3f, 0]),
    // Datos comprimidos: un 0xFF siempre va seguido de 0x00.
    0x12,
    0xff,
    0x00,
    0x34,
    0x56,
    0xff,
    0xd9,
  ];
  const meta = [
    ...(options.exif ? exif(options.exif === 'gps', options.littleEndian ?? false) : []),
    ...(options.xmpGps
      ? segment(0xe1, [
          ...ascii('http://ns.adobe.com/xap/1.0/'),
          0,
          ...ascii('<exif:GPSLatitude>4,42.66N</exif:GPSLatitude>'),
        ])
      : []),
  ];
  return Uint8Array.from([
    ...image(meta),
    ...(options.trailingGps ? image(exif(true, false)) : []),
  ]);
}
