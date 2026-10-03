import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { headingScale, useTheme } from '../theme';

interface Props {
  /** Título de la sección, encima de la tarjeta; o un encabezado propio en `header`. */
  title?: string;
  header?: ReactNode;
  /** Enlace a la derecha del título, por ejemplo «Ver todos». */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  children: ReactNode;
}

/** Tarjeta agrupada (T-044): fondo de tarjeta, radio 20 y un separador fino entre filas. */
export function GroupedCard({ title, header, action, children }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={{ gap: spacing.sm }}>
      {(title ?? header ?? action) && (
        <View style={[styles.header, { gap: spacing.sm, paddingHorizontal: spacing.xs }]}>
          {header ?? (
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={headingScale.title}
              style={[typography.title, { color: colors.text }]}
            >
              {title}
            </Text>
          )}
          {action && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              onPress={action.onPress}
              hitSlop={12}
            >
              <Text style={[typography.body, { color: colors.accentText }]}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      <View
        testID="grouped-card"
        style={[styles.card, { backgroundColor: colors.card, borderRadius: radius.card }]}
      >
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <View
                testID="separator"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.separator,
                  { marginLeft: spacing.md, backgroundColor: colors.separator },
                ]}
              />
            )}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  card: { overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth },
});
