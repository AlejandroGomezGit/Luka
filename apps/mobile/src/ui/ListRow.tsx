import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { isAccessibilitySize, useTheme } from '../theme';
import { IconBadge } from './CategoryLabel';

interface Props {
  title: string;
  subtitle?: string;
  /** Valor a la derecha, por ejemplo el saldo. */
  value?: string;
  /** «alert» para una deuda, en el color de alerta. */
  valueTone?: 'default' | 'alert';
  /** Emoji y token de color del ícono. */
  icon?: string;
  color?: string;
  onPress?: () => void;
  /** Flecha a la derecha: la fila abre otra pantalla. */
  chevron?: boolean;
  /** Por defecto VoiceOver lee título, subtítulo y valor en una sola frase. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * Fila de lista (T-044): 58 pt de alto mínimo; con tamaños de accesibilidad de Dynamic Type el valor
 * pasa debajo del título para que nada se corte.
 */
export function ListRow(props: Props) {
  const { title, subtitle, value, icon, color, onPress, chevron } = props;
  const { colors, sizes, spacing, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const label = props.accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ');
  const content = (
    <>
      {icon !== undefined && <IconBadge icon={icon} color={color ?? 'gray'} />}
      <View style={styles.flex}>
        <Text style={[typography.body, { color: colors.text }]}>{title}</Text>
        {subtitle && <Text style={[typography.subhead, { color: colors.muted }]}>{subtitle}</Text>}
      </View>
      {value && (
        <Text
          style={[
            typography.headline,
            { color: props.valueTone === 'alert' ? colors.alert : colors.text },
          ]}
        >
          {value}
        </Text>
      )}
      {chevron && (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[typography.title, { color: colors.muted }]}
        >
          ›
        </Text>
      )}
    </>
  );
  const style = [
    isAccessibilitySize(fontScale) ? styles.column : styles.row,
    {
      minHeight: sizes.row,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.md - spacing.xs,
    },
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={props.accessibilityHint}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label} style={style}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' },
  flex: { flexShrink: 1, flexGrow: 1 },
});
