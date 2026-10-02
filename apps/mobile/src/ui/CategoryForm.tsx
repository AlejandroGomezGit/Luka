import { type CategoryInputError, MAX_CATEGORY_NAME } from '@luka/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { CategoryLabel } from './CategoryLabel';
import { CATEGORY_ERRORS } from './categoryErrors';
import { ColorPicker } from './ColorPicker';
import { IconPicker } from './IconPicker';
import { colorFor } from './palette';
import { Screen } from './Screen';

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
  const [values, setValues] = useState(initial);
  const errorsFor = (field: 'name' | 'icon' | 'color') =>
    errors
      .filter((code) => CATEGORY_ERRORS[code].field === field)
      .map((code) => (
        <Text key={code} style={[styles.error, { color: colorFor('red', scheme) }]}>
          {CATEGORY_ERRORS[code].message}
        </Text>
      ));

  return (
    <Screen contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
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

      <IconPicker
        value={values.icon}
        color={values.color}
        onChange={(icon) => setValues({ ...values, icon })}
      />
      {errorsFor('icon')}

      <ColorPicker value={values.color} onChange={(color) => setValues({ ...values, color })} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '600' },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 8, padding: 12 },
  error: { fontSize: 15 },
  primary: { borderRadius: 10, padding: 14, alignItems: 'center' },
  primaryText: { fontSize: 17, fontWeight: '600' },
  secondary: { fontSize: 17, textAlign: 'center', padding: 12 },
});
