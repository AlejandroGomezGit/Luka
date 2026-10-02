import { today } from '@luka/domain';
import { StyleSheet, Text, View } from 'react-native';
import { deviceClock, deviceTimeZone } from '../clock';
import { useTheme } from '../theme';

// Los textos no fijan allowFontScaling={false}: siguen el tamaño de Dynamic Type.
export default function Home() {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.container, { padding: spacing.lg, gap: spacing.sm }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Tus gastos
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        Hoy es {today(deviceClock, deviceTimeZone())}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 17 },
});
