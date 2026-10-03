import { Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { isAccessibilitySize, useTheme } from '../theme';
import { IconBadge } from './CategoryLabel';

interface Props {
  title: string;
  subtitle?: string;
  /** Valor a la derecha, por ejemplo el saldo. */
  value?: string;
  /** Segunda línea bajo el valor, por ejemplo lo que llega en otra moneda («→ US$ 25,00»). */
  valueDetail?: string;
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
        <View style={styles.value}>
          <Text
            style={[
              typography.headline,
              styles.right,
              { color: props.valueTone === 'alert' ? colors.alert : colors.text },
            ]}
          >
            {value}
          </Text>
          {props.valueDetail && (
            <Text style={[typography.subhead, styles.right, { color: colors.muted }]}>
              {props.valueDetail}
            </Text>
          )}
        </View>
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

/** Fila con un interruptor, por ejemplo «Mostrar archivadas»; VoiceOver lee el título en el interruptor. */
export function SwitchRow({
  title,
  value,
  onValueChange,
}: {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors, sizes, spacing, typography } = useTheme();
  return (
    <View
      style={[
        styles.row,
        styles.between,
        { minHeight: sizes.row, paddingHorizontal: spacing.md, gap: spacing.sm },
      ]}
    >
      <Text style={[typography.body, styles.flex, { color: colors.text }]}>{title}</Text>
      {/* En iOS 26 el interruptor nativo no coincide con el tamaño que mide React Native: se centra aparte. */}
      <View style={[styles.center, { minHeight: sizes.touch }]}>
        <Switch
          accessibilityLabel={title}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: colors.accent }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  center: { justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' },
  flex: { flexShrink: 1, flexGrow: 1 },
  value: { flexShrink: 0 },
  right: { textAlign: 'right' },
});
