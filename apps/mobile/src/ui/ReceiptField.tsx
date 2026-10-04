import { useRef, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import type { ReceiptFile } from '../db/attachments';
import { expoReceiptIO } from '../files/expoReceiptIO';
import { captureReceipt, type ReceiptError, type ReceiptSource } from '../files/receipts';
import { useTheme } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

const MESSAGES: Record<ReceiptError, string> = {
  cancelled: 'No elegiste ninguna foto.',
  camera_denied: 'Luka no tiene permiso para usar la cámara. Puedes darlo en Ajustes.',
  no_space: 'No hay espacio suficiente en el iPhone para guardar la foto.',
  resize_failed: 'No se pudo procesar la foto. Prueba con otra.',
  save_failed: 'No se pudo guardar la foto. Inténtalo de nuevo.',
};

interface Props {
  value: ReceiptFile | null;
  onChange: (receipt: ReceiptFile | null) => void;
  /** Id de la foto nueva; es también el nombre del archivo y el id de su fila. */
  newId: () => string;
}

/**
 * Foto del recibo de un movimiento (HU-06): una sola, con «Quitar» y «Reemplazar». Elegir de la galería
 * no pide permiso; la cámara sí, y si se niega se ofrece abrir Ajustes.
 */
export function ReceiptField({ value, onChange, newId }: Props) {
  const { colors, radius, sizes, spacing, typography } = useTheme();
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<ReceiptError | null>(null);
  // La opción elegida en la hoja: el selector se abre cuando la hoja terminó de cerrarse, porque iOS no
  // presenta la galería mientras otra pantalla se está cerrando (en el iPhone no se abría).
  const chosen = useRef<ReceiptSource | null>(null);
  const choose = (source: ReceiptSource) => {
    chosen.current = source;
    setChoosing(false);
  };

  const take = async (source: ReceiptSource) => {
    const result = await captureReceipt(expoReceiptIO, source, newId());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange(result.receipt);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
        Foto del recibo
      </Text>
      {value ? (
        <View style={[styles.row, { gap: spacing.md }]}>
          <Image
            accessible
            accessibilityRole="image"
            accessibilityLabel="Foto del recibo"
            source={{ uri: expoReceiptIO.fileUri(value.id) }}
            style={{
              width: sizes.thumbnail,
              height: sizes.thumbnail,
              borderRadius: radius.control,
              backgroundColor: colors.card,
            }}
          />
          <View style={[styles.flex, { gap: spacing.sm }]}>
            <Button label="Reemplazar" variant="secondary" onPress={() => setChoosing(true)} />
            <Button label="Quitar" variant="secondary" onPress={() => onChange(null)} />
          </View>
        </View>
      ) : (
        <Button
          label="Agregar foto del recibo"
          variant="secondary"
          onPress={() => setChoosing(true)}
        />
      )}
      {error && (
        <>
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.subhead, { color: colors.alert }]}
          >
            {MESSAGES[error]}
          </Text>
          {error === 'camera_denied' && (
            <Button
              label="Abrir Ajustes"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          )}
        </>
      )}
      <BottomSheet
        visible={choosing}
        title="Foto del recibo"
        onClose={() => setChoosing(false)}
        onDismiss={() => {
          const source = chosen.current;
          chosen.current = null;
          if (source) void take(source);
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <Button label="Tomar foto" variant="secondary" onPress={() => choose('camera')} />
          <Button
            label="Elegir de la galería"
            variant="secondary"
            onPress={() => choose('library')}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
