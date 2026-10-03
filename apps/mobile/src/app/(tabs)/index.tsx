import { today } from '@luka/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { deviceClock, deviceTimeZone } from '../../clock';
import { type AccountWithBalance, listActiveAccounts } from '../../db/accounts';
import { useLocalSession } from '../../db/session';
import { listRecentTransactions, type TransactionListItem } from '../../db/transactions';
import { headingScale, isAccessibilitySize, useTheme } from '../../theme';
import { AccountList } from '../../ui/AccountList';
import { Button } from '../../ui/Button';
import { GroupedCard } from '../../ui/GroupedCard';
import { ListRow } from '../../ui/ListRow';
import { Screen } from '../../ui/Screen';
import { TransactionRow } from '../../ui/TransactionRow';
import { useUndo } from '../../undo';

/**
 * Solo en desarrollo: con __DEV__ en false el require desaparece del bundle de producción, y el build lo
 * comprueba buscando la marca del cargador en dist.
 */
const DemoDataButton = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('../../dev/DemoDataButton') as typeof import('../../dev/DemoDataButton'))
      .DemoDataButton
  : null;

/**
 * Inicio, con encabezado propio (maqueta docs/diseno/Inicio.png): fecha, título grande y «Agregar».
 * Los textos no fijan allowFontScaling={false}: siguen el tamaño de Dynamic Type.
 */
export default function Home() {
  const session = useLocalSession();
  const { db } = session;
  const { revision } = useUndo();
  const { colors, spacing, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [accounts, setAccounts] = useState<AccountWithBalance[] | null>(null);
  const [recent, setRecent] = useState<TransactionListItem[]>([]);

  // También vuelve a leer al borrar o deshacer (revision), aunque Inicio ya esté a la vista.
  const reload = useCallback(() => {
    setAccounts(listActiveAccounts(db));
    setRecent(listRecentTransactions(db, session.userId));
  }, [db, session.userId, revision]);
  useFocusEffect(reload);
  const hasAccounts = accounts === null || accounts.length > 0;

  return (
    <Screen contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      {/* Con tamaños de accesibilidad, «Agregar» pasa debajo del título para que nada se aplaste. */}
      <View
        style={[
          isAccessibilitySize(fontScale) ? styles.column : styles.header,
          { gap: spacing.sm },
        ]}
      >
        <View style={styles.flex}>
          <Text style={[typography.subhead, styles.strong, { color: colors.muted }]}>
            Hoy es {today(deviceClock, deviceTimeZone())}
          </Text>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={headingScale.largeTitle}
            style={[typography.largeTitle, { color: colors.text }]}
          >
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
      {accounts && accounts.length > 0 && (
        <GroupedCard
          title="Recientes"
          action={{ label: 'Ver todos', onPress: () => router.navigate('/movements') }}
        >
          {recent.length === 0 ? (
            <Text style={[typography.body, { padding: spacing.md, color: colors.muted }]}>
              Aún no tienes movimientos
            </Text>
          ) : (
            recent.map((item) => (
              <TransactionRow
                key={item.id}
                item={item}
                today={today(session.clock, deviceTimeZone())}
                onPress={(id) => router.push(`/transactions/${id}`)}
              />
            ))
          )}
        </GroupedCard>
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
      {DemoDataButton && <DemoDataButton onLoaded={reload} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end' },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  flex: { flexGrow: 1, flexShrink: 1 },
  strong: { fontWeight: '600' },
});
