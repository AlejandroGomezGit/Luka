import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '../db/DatabaseProvider';
import { useTheme } from '../theme';

export default function RootLayout() {
  const { colors } = useTheme();
  return (
    <DatabaseProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Luka' }} />
      </Stack>
      <StatusBar style="auto" />
    </DatabaseProvider>
  );
}
