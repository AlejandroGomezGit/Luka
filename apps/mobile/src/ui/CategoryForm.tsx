import {
  COLOR_TOKENS,
  type CategoryInputError,
  ICON_TOKENS,
  MAX_CATEGORY_NAME,
} from '@luka/domain';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { CategoryLabel } from './CategoryLabel';
import { CATEGORY_ERRORS } from './categoryErrors';
import { colorFor } from './palette';
import { ICON_LABELS, SYMBOLS } from './symbols';

export interface CategoryValues {
  name: string;
  icon: string;
  color: string;
}

interface Props {
  initial: CategoryValues;
  errors: readonly CategoryInputError[];
  onSubmit: (values: CategoryValues) => void;
  /** Solo al editar: estado y acción de archivar. No hay opción de eliminar (INV-07, HU-07). */
  archived?: boolean;
  onToggleArchived?: () => void;
}

/** Formulario de categoría (HU-07). Las cuadrículas se reparten en más filas con Dynamic Type grande. */
export function CategoryForm({ initial, errors, onSubmit, archived, onToggleArchived }: Props) {
  const { colors, scheme, spacing } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [values, setValues] = useState(initial);
  // Celdas de al menos 44 puntos (área táctil de Apple) que crecen con el texto hasta el doble: así
  // con Dynamic Type grande la cuadrícula pasa a más filas sin dejar un solo ícono por fila.
  const cell = Math.round(44 * Math.min(Math.max(1, fontScale), 2));
  const errorsFor = (field: 'name' | 'icon' | 'color') =>
    errors
      .filter((code) => CATEGORY_ERRORS[code].field === field)
      .map((code) => (
        <Text key={code} style={[styles.error, { color: colorFor('red', scheme) }]}>
          {CATEGORY_ERRORS[code].message}
        </Text>
      ));

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View accessibilityLiveRegion="polite">
        <CategoryLabel
          name={values.name || 'Nueva categoría'}
          icon={values.icon}
          color={values.color}
        />
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Nombre</Text>
      <TextInput
        accessibilityLabel="Nombre"
        value={values.name}
        onChangeText={(name) => setValues({ ...values, name })}
        maxLength={MAX_CATEGORY_NAME}
        style={[styles.input, { color: colors.text, borderColor: colors.muted }]}
      />
      {errorsFor('name')}

      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
        Ícono
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.grid, { gap: spacing.sm }]}>
        {ICON_TOKENS.map((token) => {
          const selected = values.icon === token;
          return (
            <Pressable
              key={token}
              accessibilityRole="radio"
              accessibilityLabel={ICON_LABELS[token]}
              accessibilityState={{ selected }}
              onPress={() => setValues({ ...values, icon: token })}
              style={[
                styles.cell,
                { width: cell, height: cell, borderColor: selected ? colors.text : 'transparent' },
              ]}
            >
              <SymbolView
                name={SYMBOLS[token]}
                tintColor={colorFor(values.color, scheme)}
                size={Math.round(cell * 0.55)}
              />
            </Pressable>
          );
        })}
      </View>
      {errorsFor('icon')}

      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
        Color
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.grid, { gap: spacing.sm }]}>
        {COLOR_TOKENS.map(({ token, name }) => {
          const selected = values.color === token;
          return (
            <Pressable
              key={token}
              accessibilityRole="radio"
              accessibilityLabel={name}
              accessibilityState={{ selected }}
              onPress={() => setValues({ ...values, color: token })}
              style={[
                styles.cell,
                { width: cell, height: cell, borderColor: selected ? colors.text : 'transparent' },
              ]}
            >
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: colorFor(token, scheme),
                    width: cell * 0.6,
                    height: cell * 0.6,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      {errorsFor('color')}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Guardar"
        onPress={() => onSubmit(values)}
        style={[styles.primary, { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.primaryText, { color: colors.background }]}>Guardar</Text>
      </Pressable>
      {onToggleArchived && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={archived ? 'Desarchivar' : 'Archivar'}
          onPress={onToggleArchived}
        >
          <Text style={[styles.secondary, { color: colors.accent }]}>
            {archived ? 'Desarchivar' : 'Archivar'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '600' },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 8, padding: 12 },
  error: { fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 10 },
  swatch: { borderRadius: 999 },
  primary: { borderRadius: 10, padding: 14, alignItems: 'center' },
  primaryText: { fontSize: 17, fontWeight: '600' },
  secondary: { fontSize: 17, textAlign: 'center', padding: 12 },
});
