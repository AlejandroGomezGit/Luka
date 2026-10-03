import { today } from '@luka/domain';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { deviceClock, deviceTimeZone } from '../clock';
import { type AccountWithBalance, listActiveAccounts } from '../db/accounts';
import { useLocalSession } from '../db/session';
import { useTheme } from '../theme';
import { AccountList } from '../ui/AccountList';
import { Screen } from '../ui/Screen';

// Los textos no fijan allowFontScaling={false}: siguen el tamaño de Dynamic Type.
export default function Home() {
  const { db } = useLocalSession();
  const { colors, spacing } = useTheme();
  const [accounts, setAccounts] = useState<AccountWithBalance[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      setAccounts(listActiveAccounts(db));
    }, [db]),
  );
  const hasAccounts = accounts === null || accounts.length > 0;

  return (
    <Screen contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Tus gastos
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        Hoy es {today(deviceClock, deviceTimeZone())}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Agregar"
        onPress={() => router.push(hasAccounts ? '/transactions/new' : '/accounts/new')}
        style={[styles.primary, { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.primaryText, { color: colors.background }]}>Agregar</Text>
      </Pressable>
      {!hasAccounts && (
        <>
          <Text style={[styles.body, { color: colors.text }]}>
            Para registrar gastos necesitas al menos una cuenta: efectivo, banco o tarjeta.
          </Text>
          <Link href="/accounts/new" style={[styles.body, styles.strong, { color: colors.accent }]}>
            Crea tu primera cuenta
          </Link>
        </>
      )}
      {accounts && accounts.length > 0 && (
        <AccountList accounts={accounts} onSelect={(id) => router.push(`/accounts/${id}`)} />
      )}
      <Link href="/accounts" style={[styles.body, { color: colors.accent }]}>
        Cuentas
      </Link>
      <Link href="/categories" style={[styles.body, { color: colors.accent }]}>
        Categorías
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 17 },
  strong: { fontWeight: '600' },
  primary: { borderRadius: 12, padding: 16, alignItems: 'center' },
  primaryText: { fontSize: 20, fontWeight: '700' },
});
