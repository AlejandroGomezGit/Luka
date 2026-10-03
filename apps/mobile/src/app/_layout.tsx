import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '../db/DatabaseProvider';
import { useTheme } from '../theme';
import { UndoProvider } from '../undo';

export default function RootLayout() {
  const { colors } = useTheme();
  return (
    <DatabaseProvider>
      <UndoProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerLargeTitleShadowVisible: false,
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {/* Inicio tiene encabezado propio; «Inicio» es el texto del botón para volver. */}
          <Stack.Screen name="(tabs)" options={{ title: 'Inicio', headerShown: false }} />
        </Stack>
      </UndoProvider>
      <StatusBar style="auto" />
    </DatabaseProvider>
  );
}
