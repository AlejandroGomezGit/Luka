import type { ReactNode } from 'react';
import { ScrollView, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Contenedor desplazable de cada pantalla. React Native 0.86 no vuelve a medir el texto cuando Dynamic
 * Type cambia con la pantalla abierta y lo deja cortado (#39); por eso el contenido se vuelve a montar
 * al cambiar `fontScale`. El estado que debe sobrevivir vive por encima de este componente.
 * Con el teclado abierto, un toque en un botón u opción actúa de una vez; si no, iOS lo gasta en cerrar
 * el teclado (así una cuenta quedaba en COP aunque se tocara «Dólar (USD)»).
 * El ajuste automático de márgenes deja libre el espacio de la barra de estado, del encabezado (también
 * el título grande, que se encoge al desplazar) y de la barra de pestañas flotante de iOS 26, así el
 * final de la lista y los botones de abajo nunca quedan tapados.
 */
export function Screen({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <ScrollView
      key={fontScale}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </ScrollView>
  );
}
