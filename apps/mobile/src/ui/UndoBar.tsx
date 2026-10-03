import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAccessibilitySize, radius, spacing, useTheme } from '../theme';
import { Button } from './Button';

/** Segundos que dura el aviso en uso normal (HU-04). */
export const UNDO_SECONDS = 8;

/**
 * Alto de la barra de pestañas de iOS sobre el área segura. La de NativeTabs no se puede medir (DT-01);
 * en el simulador mide 49 pt sobre los 34 del indicador de inicio.
 */
const TAB_BAR_HEIGHT = 49;

interface Props {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** Sobre las pestañas el aviso sube por encima de la barra, sin taparla. */
  aboveTabBar: boolean;
}

/**
 * Aviso «Deshacer» (HU-04, CU-09). Se anuncia al lector de pantalla. En uso normal se cierra solo a los
 * 8 segundos; con VoiceOver activo o con un tamaño de texto de accesibilidad se queda hasta que la
 * persona lo cierre o deshaga (WCAG 2.2.1). Usa los colores de tarjeta, con contraste verificado.
 */
export function UndoBar({ message, onUndo, onDismiss, aboveTabBar }: Props) {
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const [screenReader, setScreenReader] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (active) setScreenReader(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const stays = screenReader !== false || isAccessibilitySize(fontScale);
  useEffect(() => {
    if (stays) return;
    const timer = setTimeout(onDismiss, UNDO_SECONDS * 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [stays, onDismiss, message]);

  return (
    <View
      testID="undo-bar"
      style={[
        styles.bar,
        {
          bottom: bottom + (aboveTabBar ? TAB_BAR_HEIGHT : 0) + spacing.sm,
          backgroundColor: colors.card,
          borderColor: colors.separator,
          borderRadius: radius.card,
        },
      ]}
    >
      <Text style={[typography.body, styles.message, { color: colors.text }]}>{message}</Text>
      <View style={styles.actions}>
        <Button label="Deshacer" onPress={onUndo} />
        <Button label="Cerrar aviso" icon="✕" variant="text" onPress={onDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  message: { flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
