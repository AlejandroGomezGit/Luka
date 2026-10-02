import migrations from '@luka/schema-sqlite/migrations';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { deviceClock } from '../clock';
import { deviceRandom } from '../random';
import { useTheme } from '../theme';
import { expoDb, localDb } from './database';
import { prepareLocalData } from './prepare';
import type { WriteContext } from './write';

export interface LocalSession extends WriteContext {
  deviceId: string;
}

const SessionContext = createContext<LocalSession | null>(null);

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
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/** Base local, identidad, reloj y azar para escribir con `insertRow` y compañía. */
export function useLocalSession(): LocalSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useLocalSession se usa fuera de DatabaseProvider');
  return session;
}

function MigrationError() {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.error, { padding: spacing.lg, backgroundColor: colors.background }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        No se pudo preparar tus datos
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        Cierra la app y vuelve a abrirla. Si el problema sigue, reinstálala desde TestFlight.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 17 },
});
