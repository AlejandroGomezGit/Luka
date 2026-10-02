import { type CurrencyCode } from '@luka/domain';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { AccountWithBalance } from '../db/accounts';
import { isAccessibilitySize, useTheme } from '../theme';
import { ACCOUNT_TYPE_LABELS } from './accountTypes';
import { CategoryLabel } from './CategoryLabel';
import { balanceText } from './money';

interface Props {
  accounts: readonly AccountWithBalance[];
  onSelect: (id: string) => void;
}

/** Lista de cuentas (HU-02): ícono, nombre, tipo y saldo; VoiceOver lo lee en una sola frase. */
export function AccountList({ accounts, onSelect }: Props) {
  const { colors, spacing } = useTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ gap: spacing.sm }}>
      {accounts.map((account) => {
        const type = ACCOUNT_TYPE_LABELS[account.type];
        const balance = balanceText(
          account.type,
          account.balanceMinor,
          account.currency as CurrencyCode,
        );
        const label = [account.name, type, balance, account.archivedAt ? 'archivada' : null]
          .filter(Boolean)
          .join(', ');
        return (
          <Pressable
            key={account.id}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onSelect(account.id)}
            style={[
              isAccessibilitySize(fontScale) ? styles.column : styles.row,
              { paddingVertical: spacing.sm, gap: spacing.sm },
            ]}
          >
            <View style={styles.flex}>
              <CategoryLabel name={account.name} icon={account.icon} color={account.color} />
              <Text style={[styles.detail, { color: colors.muted }]}>
                {account.archivedAt ? `${type} · archivada` : type}
              </Text>
            </View>
            <Text style={[styles.balance, { color: colors.text }]}>{balance}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { flexDirection: 'column', alignItems: 'flex-start' },
  flex: { flexShrink: 1, flexGrow: 1 },
  detail: { fontSize: 15 },
  balance: { fontSize: 17, fontWeight: '600' },
});
