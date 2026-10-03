import { today } from '@luka/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { deviceClock, deviceTimeZone } from '../../clock';
import { type AccountWithBalance, listActiveAccounts } from '../../db/accounts';
import { useLocalSession } from '../../db/session';
import { useTheme } from '../../theme';
import { AccountList } from '../../ui/AccountList';
import { Button } from '../../ui/Button';
import { GroupedCard } from '../../ui/GroupedCard';
import { ListRow } from '../../ui/ListRow';
import { Screen } from '../../ui/Screen';

/**
 * Inicio, con encabezado propio (maqueta docs/diseno/Inicio.png): fecha, título grande y «Agregar».
 * Los textos no fijan allowFontScaling={false}: siguen el tamaño de Dynamic Type.
 */
export default function Home() {
  const { db } = useLocalSession();
  const { colors, spacing, typography } = useTheme();
  const [accounts, setAccounts] = useState<AccountWithBalance[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      setAccounts(listActiveAccounts(db));
    }, [db]),
  );
  const hasAccounts = accounts === null || accounts.length > 0;

  return (
    <Screen contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <View style={[styles.header, { gap: spacing.sm }]}>
        <View style={styles.flex}>
          <Text style={[typography.subhead, styles.strong, { color: colors.muted }]}>
            Hoy es {today(deviceClock, deviceTimeZone())}
          </Text>
          <Text accessibilityRole="header" style={[typography.largeTitle, { color: colors.text }]}>
            Tus gastos
          </Text>
        </View>
        <Button
          label="Agregar"
          icon="+"
          onPress={() => router.push(hasAccounts ? '/transactions/new' : '/accounts/new')}
        />
      </View>
      {!hasAccounts && (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.body, { color: colors.text }]}>
            Para registrar gastos necesitas al menos una cuenta: efectivo, banco o tarjeta.
          </Text>
          <Button
            label="Crea tu primera cuenta"
            variant="secondary"
            onPress={() => router.push('/accounts/new')}
          />
        </View>
      )}
      {accounts && accounts.length > 0 && (
        <AccountList
          title="Mis cuentas"
          accounts={accounts}
          onSelect={(id) => router.push(`/accounts/${id}`)}
        />
      )}
      <GroupedCard title="Administrar">
        <ListRow
          icon="🏦"
          color="blue"
          title="Cuentas"
          accessibilityLabel="Cuentas"
          accessibilityHint="Abre la lista de tus cuentas"
          onPress={() => router.push('/accounts')}
          chevron
        />
        <ListRow
          icon="🏷️"
          color="purple"
          title="Categorías"
          accessibilityLabel="Categorías"
          accessibilityHint="Abre la lista de tus categorías"
          onPress={() => router.push('/categories')}
          chevron
        />
      </GroupedCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  flex: { flexGrow: 1, flexShrink: 1 },
  strong: { fontWeight: '600' },
});
