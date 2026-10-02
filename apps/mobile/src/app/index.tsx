import { today } from '@luka/domain';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { deviceClock, deviceTimeZone } from '../clock';
import { useTheme } from '../theme';
import { Screen } from '../ui/Screen';

// Los textos no fijan allowFontScaling={false}: siguen el tamaño de Dynamic Type.
export default function Home() {
  const { colors, spacing } = useTheme();
  return (
    <Screen contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Tus gastos
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        Hoy es {today(deviceClock, deviceTimeZone())}
      </Text>
      {/* Acceso temporal hasta definir la navegación en T-013. */}
      <Link href="/categories" style={[styles.body, { color: colors.accent }]}>
        Categorías
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 17 },
});
