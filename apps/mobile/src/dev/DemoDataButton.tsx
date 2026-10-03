import { useState } from 'react';
import { Text } from 'react-native';
import { deviceTimeZone } from '../clock';
import { useLocalSession } from '../db/session';
import { useTheme } from '../theme';
import { Button } from '../ui/Button';
import { loadDemoData } from './demoData';

/** SOLO PARA DESARROLLO: botón de Inicio que carga 10 000 movimientos de prueba en una base vacía. */
export function DemoDataButton({ onLoaded }: { onLoaded: () => void }) {
  const session = useLocalSession();
  const { colors, typography } = useTheme();
  const [message, setMessage] = useState('');
  return (
    <>
      <Button
        label="Desarrollo: cargar 10.000 movimientos de prueba"
        variant="secondary"
        onPress={() => {
          const result = loadDemoData(session, deviceTimeZone());
          setMessage(
            result.ok ? `Listo: ${String(result.transactions)} movimientos.` : result.reason,
          );
          if (result.ok) onLoaded();
        }}
      />
      {message !== '' && (
        <Text
          accessibilityLiveRegion="polite"
          style={[typography.subhead, { color: colors.muted }]}
        >
          {message}
        </Text>
      )}
    </>
  );
}
