/**
 * Operaciones de archivo de la foto del recibo con los módulos de Expo (SDK 57, incluidos en Expo Go).
 * La lógica y sus casos de error están en receipts.ts, probada con un sistema de archivos en memoria.
 */
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { ReceiptIO } from './receipts';

const folder = () => new Directory(Paths.document, 'attachments');
const fileOf = (id: string) => new File(folder(), `${id}.jpg`);

export const expoReceiptIO: ReceiptIO = {
  pick: async (source) => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return 'camera_denied';
    }
    // La galería no pide permiso en iOS: el selector del sistema solo entrega la foto elegida.
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? undefined : result.assets[0];
    return asset ? { uri: asset.uri } : 'cancelled';
  },
  shrink: async (uri, maxSide) => {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    const scale = Math.min(1, maxSide / Math.max(original.width, original.height));
    // Volver a codificar la imagen deja fuera el GPS y los demás metadatos (prueba de concepto de T-018).
    const resized = await ImageManipulator.manipulate(uri)
      .resize({ width: Math.round(original.width * scale) })
      .renderAsync();
    const saved = await resized.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return saved.uri;
  },
  freeBytes: () => Paths.availableDiskSpace,
  save: async (tempUri, id) => {
    const dir = folder();
    if (!dir.exists) dir.create();
    const dest = fileOf(id);
    await new File(tempUri).move(dest);
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await dest.bytes());
    const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    return { sizeBytes: dest.size, sha256 };
  },
  fileUri: (id) => fileOf(id).uri,
  remove: (uri) => {
    const file = new File(uri);
    if (file.exists) file.delete();
  },
  savedIds: () => {
    const dir = folder();
    if (!dir.exists) return [];
    return dir
      .list()
      .filter((entry) => entry instanceof File && entry.name.endsWith('.jpg'))
      .map((entry) => entry.name.slice(0, -'.jpg'.length));
  },
};
