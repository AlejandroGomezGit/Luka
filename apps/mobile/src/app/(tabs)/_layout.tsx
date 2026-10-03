// Deuda técnica: en SDK 57 NativeTabs es inestable; al subir a SDK 58 se importa desde
// 'expo-router/native-tabs' (documento 07, deuda técnica).
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '../../theme';

/**
 * Barra de pestañas nativa de iOS (T-044): en iOS 26 flota con Liquid Glass. Ícono SF Symbol y nombre;
 * la pestaña activa usa el acento del modo claro u oscuro.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs tintColor={colors.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="movements">
        <NativeTabs.Trigger.Label>Movimientos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="summary">
        <NativeTabs.Trigger.Label>Resumen</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
