import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { type AccountWithBalance, listAccounts } from '../../db/accounts';
import { useLocalSession } from '../../db/session';
import { useTheme } from '../../theme';
import { AccountList } from '../../ui/AccountList';
import { Screen } from '../../ui/Screen';

export default function AccountsScreen() {
  const { db } = useLocalSession();
  const { colors, spacing } = useTheme();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  useFocusEffect(
    useCallback(() => {
      setAccounts(listAccounts(db, { includeArchived }));
    }, [db, includeArchived]),
  );

  return (
    <Screen contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Stack.Screen options={{ title: 'Cuentas' }} />
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Text style={[styles.text, { color: colors.text }]}>Mostrar archivadas</Text>
        <Switch
          accessibilityLabel="Mostrar archivadas"
          value={includeArchived}
          onValueChange={setIncludeArchived}
        />
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/accounts/new')}>
        <Text style={[styles.text, { color: colors.accent }]}>Nueva cuenta</Text>
      </Pressable>
      <AccountList accounts={accounts} onSelect={(id) => router.push(`/accounts/${id}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { fontSize: 17 },
});
