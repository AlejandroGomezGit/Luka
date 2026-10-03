import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

/**
 * Contenedor desplazable de cada pantalla. React Native 0.86 no vuelve a medir el texto cuando Dynamic
 * Type cambia con la pantalla abierta y lo deja cortado (#39); por eso el contenido se vuelve a montar
 * al cambiar `fontScale`. El estado que debe sobrevivir vive por encima de este componente.
 * Con el teclado abierto, un toque en un botón u opción actúa de una vez; si no, iOS lo gasta en cerrar
 * el teclado (así una cuenta quedaba en COP aunque se tocara «Dólar (USD)»).
 * Arriba, el ajuste automático de márgenes deja libre la barra de estado y el encabezado (también el
 * título grande, que se encoge al desplazar). Abajo ese ajuste no llega con las pestañas nativas: en el
 * simulador el desplazamiento terminaba 83 pt bajo la barra flotante de iOS 26. Por eso el relleno
 * inferior suma el área segura, que dentro de las pestañas ya incluye la barra.
 */
export function Screen({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  // Con un arreglo, flatten siempre devuelve un objeto, aunque no llegue estilo.
  const content = StyleSheet.flatten([contentContainerStyle]);
  const paddingBottom = Number(
    content.paddingBottom ?? content.paddingVertical ?? content.padding ?? 0,
  );
  return (
    <ScrollView
      key={fontScale}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[content, { paddingBottom: paddingBottom + bottom }]}
    >
      {children}
    </ScrollView>
  );
}
