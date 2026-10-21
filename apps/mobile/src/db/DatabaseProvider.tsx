import migrations from '@luka/schema-sqlite/migrations';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { secureTokenStore } from '../auth/tokenStore';
import { deviceClock } from '../clock';
import { expoReceiptIO } from '../files/expoReceiptIO';
import { purgeReceiptFiles } from '../files/receipts';
import { deviceRandom } from '../random';
import { spacing, typography, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { expoDb, localDb } from './database';
import { prepareLocalData } from './prepare';
import { type LocalSession, LocalSessionProvider } from './session';
import { fillSearchInBackground } from './transactions';

/**
 * Aplica las migraciones antes de mostrar la app y crea la identidad local en el primer arranque, después
 * de borrar del Keychain los tokens de una instalación anterior (asíncrono; si falla, pantalla de error
 * con «Reintentar»).
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(expoDb, migrations);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!success) return;
    let current = true;
    setPrepareFailed(false);
    prepareLocalData(localDb, deviceClock, deviceRandom, secureTokenStore()).then(
      (profile) => {
        if (current)
          setSession({ db: localDb, clock: deviceClock, random: deviceRandom, ...profile });
      },
      () => {
        if (current) setPrepareFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [success, attempt]);

  // Después del primer render y sin bloquearlo (regla de tablas derivadas): texto de búsqueda que falte,
  // por lotes, y archivos de fotos que ya no tienen una foto vigente (HU-06).
  useEffect(() => {
    if (!session) return;
    fillSearchInBackground(session.db);
    void purgeReceiptFiles(session.db, expoReceiptIO);
  }, [session]);

  if (error) return <MigrationError />;
  if (prepareFailed) return <MigrationError onRetry={() => setAttempt((n) => n + 1)} />;
  if (!session) return null;
  return <LocalSessionProvider value={session}>{children}</LocalSessionProvider>;
}

/** Sin `onRetry`, falló la migración; con él, la preparación del arranque (por ejemplo, el Keychain). */
function MigrationError({ onRetry }: { onRetry?: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.error, { padding: spacing.lg, backgroundColor: colors.background }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        No se pudo preparar tus datos
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        {onRetry
          ? 'Vuelve a intentarlo o cierra la app y ábrela de nuevo.'
          : 'Cierra la app y vuelve a abrirla.'}{' '}
        Si el problema sigue, no la reinstales todavía: reinstalarla borra los datos guardados en
        este iPhone que aún no se han sincronizado.
      </Text>
      {onRetry && <Button label="Reintentar" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  title: typography.title,
  body: typography.body,
});
