import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Screen } from './Screen';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  /**
   * Cuando la hoja terminó de cerrarse. Para abrir otra pantalla del sistema (por ejemplo el selector de
   * fotos): iOS no la presenta mientras la hoja se está cerrando.
   */
  onDismiss?: () => void;
  children: ReactNode;
}

/** Hoja inferior para elegir una opción sin salir del formulario; tocar fuera o «Cancelar» la cierra. */
export function BottomSheet({ visible, title, onClose, onDismiss, children }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      {...(onDismiss ? { onDismiss } : {})}
    >
      <Pressable
        accessibilityLabel="Cerrar"
        style={[styles.backdrop, { backgroundColor: colors.scrim }]}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
          },
        ]}
      >
        <View style={[styles.header, { padding: spacing.md }]}>
          <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={[typography.headline, { color: colors.accentText }]}>Cancelar</Text>
          </Pressable>
        </View>
        <Screen
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.lg,
            gap: spacing.sm,
          }}
        >
          {children}
        </Screen>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: { maxHeight: '70%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
