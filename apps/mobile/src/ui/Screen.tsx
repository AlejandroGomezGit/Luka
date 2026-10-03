import type { ReactNode } from 'react';
import { ScrollView, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Contenedor desplazable de cada pantalla. React Native 0.86 no vuelve a medir el texto cuando Dynamic
 * Type cambia con la pantalla abierta y lo deja cortado (#39); por eso el contenido se vuelve a montar
 * al cambiar `fontScale`. El estado que debe sobrevivir vive por encima de este componente.
 * Con el teclado abierto, un toque en un botón u opción actúa de una vez; si no, iOS lo gasta en cerrar
 * el teclado (así una cuenta quedaba en COP aunque se tocara «Dólar (USD)»).
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
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </ScrollView>
  );
}
