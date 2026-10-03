import migrations from '@luka/schema-sqlite/migrations';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { deviceClock } from '../clock';
import { deviceRandom } from '../random';
import { spacing, typography, useTheme } from '../theme';
import { expoDb, localDb } from './database';
import { prepareLocalData } from './prepare';
import { type LocalSession, LocalSessionProvider } from './session';

/** Aplica las migraciones antes de mostrar la app y crea la identidad local en el primer arranque. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(expoDb, migrations);
  const session = useMemo<LocalSession | null>(() => {
    if (!success) return null;
    const profile = prepareLocalData(localDb, deviceClock, deviceRandom);
    return { db: localDb, clock: deviceClock, random: deviceRandom, ...profile };
  }, [success]);

  if (error) return <MigrationError />;
  if (!session) return null;
  return <LocalSessionProvider value={session}>{children}</LocalSessionProvider>;
}

function MigrationError() {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.error, { padding: spacing.lg, backgroundColor: colors.background }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        No se pudo preparar tus datos
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        Cierra la app y vuelve a abrirla. Si el problema sigue, no la reinstales todavía:
        reinstalarla borra los datos guardados en este iPhone que aún no se han sincronizado.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  title: typography.title,
  body: typography.body,
});
