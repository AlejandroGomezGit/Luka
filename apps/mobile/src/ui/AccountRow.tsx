import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AccountWithBalance } from '../db/accounts';
import { radius, sizes, spacing, typography, useTheme } from '../theme';
import { IconBadge } from './CategoryLabel';

interface Props {
  /** «Pagado con», «Depositado en», «Desde» o «Hacia». */
  label: string;
  account: AccountWithBalance;
  onPress: () => void;
  hint: string;
  /** Con tamaños de accesibilidad: ícono arriba, texto debajo y sin flecha. */
  stacked: boolean;
  /** Ocupa el ancho que deja libre en una fila, por ejemplo junto a la fecha. */
  fill?: boolean;
}

/** Fila grande y tocable con la cuenta de un movimiento; abre la hoja para elegir otra (CU-08, CU-06). */
export function AccountRow({ label, account, onPress, hint, stacked, fill = false }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${account.name}, ${account.currency}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={[
        styles.card,
        stacked ? styles.column : [styles.row, fill && styles.flex],
        { backgroundColor: colors.card },
      ]}
    >
      <IconBadge icon={account.icon} color={account.color} />
      <View style={styles.flex}>
        <Text style={[typography.subhead, { color: colors.muted }]}>{label}</Text>
        <Text style={[typography.headline, { color: colors.text }]}>
          {account.name} · {account.currency}
        </Text>
      </View>
      {/* La flecha indica que la fila abre la lista de cuentas; apilada, la tarjeta ya lo muestra. */}
      {!stacked && <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    minHeight: sizes.row,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md - spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  flex: { flex: 1 },
  chevron: { ...typography.title, transform: [{ rotate: '90deg' }] },
});
