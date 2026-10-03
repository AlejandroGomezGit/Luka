import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { type AccountWithBalance, listAccounts } from '../../db/accounts';
import { useLocalSession } from '../../db/session';
import { useTheme } from '../../theme';
import { AccountList } from '../../ui/AccountList';
import { Button } from '../../ui/Button';
import { GroupedCard } from '../../ui/GroupedCard';
import { SwitchRow } from '../../ui/ListRow';
import { Screen } from '../../ui/Screen';

export default function AccountsScreen() {
  const { db } = useLocalSession();
  const { spacing } = useTheme();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  useFocusEffect(
    useCallback(() => {
      setAccounts(listAccounts(db, { includeArchived }));
    }, [db, includeArchived]),
  );

  return (
    <Screen contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <Stack.Screen options={{ title: 'Cuentas', headerLargeTitle: true }} />
      <Button label="Nueva cuenta" icon="+" onPress={() => router.push('/accounts/new')} />
      <GroupedCard>
        <SwitchRow
          title="Mostrar archivadas"
          value={includeArchived}
          onValueChange={setIncludeArchived}
        />
      </GroupedCard>
      <AccountList accounts={accounts} onSelect={(id) => router.push(`/accounts/${id}`)} />
    </Screen>
  );
}
