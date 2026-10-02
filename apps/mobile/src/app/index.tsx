import { today } from '@luka/domain';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { deviceClock, deviceTimeZone } from '../clock';
import { listActiveAccounts } from '../db/accounts';
import { useLocalSession } from '../db/session';
import { useTheme } from '../theme';
import { Screen } from '../ui/Screen';

// Los textos no fijan allowFontScaling={false}: siguen el tamaño de Dynamic Type.
export default function Home() {
  const { db } = useLocalSession();
  const { colors, spacing } = useTheme();
  const [hasAccounts, setHasAccounts] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setHasAccounts(listActiveAccounts(db).length > 0);
    }, [db]),
  );

  return (
    <Screen contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Tus gastos
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        Hoy es {today(deviceClock, deviceTimeZone())}
      </Text>
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
      {/* Accesos temporales hasta definir la navegación en T-013. */}
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
});
