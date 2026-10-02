import { type CategoryInputError, MAX_CATEGORY_NAME } from '@luka/domain';
import { type Ref, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { CATEGORY_ERRORS } from './categoryErrors';
import { ColorPicker } from './ColorPicker';
import { EmojiField } from './EmojiField';
import type { FormHandle } from './FormHandle';
import { colorFor } from './palette';
import { Screen } from './Screen';

export interface CategoryValues {
  name: string;
  icon: string;
  color: string;
}

interface Props {
  ref?: Ref<FormHandle>;
  initial: CategoryValues;
  errors: readonly CategoryInputError[];
  onSubmit: (values: CategoryValues) => void;
  /** Solo al editar: estado y acción de archivar. No hay opción de eliminar (INV-07, HU-07). */
  archived?: boolean;
  onToggleArchived?: () => void;
  /** Acción secundaria opcional, por ejemplo «Agregar subcategoría» al editar una principal. */
  extraAction?: { label: string; onPress: () => void };
}

/** Formulario de categoría (HU-07), compacto: «Guardar» está en la barra superior de la pantalla. */
export function CategoryForm({
  ref,
  initial,
  errors,
  onSubmit,
  archived,
  onToggleArchived,
  extraAction,
}: Props) {
  const { colors, scheme, spacing } = useTheme();
  const [values, setValues] = useState(initial);
  useImperativeHandle(ref, () => ({ submit: () => onSubmit(values) }), [onSubmit, values]);
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
      <Text style={[styles.label, { color: colors.text }]}>Nombre</Text>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <EmojiField
          value={values.icon}
          color={values.color}
          onChange={(icon) => setValues({ ...values, icon })}
        />
        <TextInput
          accessibilityLabel="Nombre"
          value={values.name}
          onChangeText={(name) => setValues({ ...values, name })}
          maxLength={MAX_CATEGORY_NAME}
          style={[styles.input, { color: colors.text, borderColor: colors.muted }]}
        />
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Toca el ícono para elegir un emoji del teclado.
      </Text>
      {errorsFor('name')}
      {errorsFor('icon')}

      <ColorPicker value={values.color} onChange={(color) => setValues({ ...values, color })} />
      {errorsFor('color')}

      {extraAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={extraAction.label}
          onPress={extraAction.onPress}
        >
          <Text style={[styles.secondary, { color: colors.accent }]}>{extraAction.label}</Text>
        </Pressable>
      )}
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
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 17, borderWidth: 1, borderRadius: 8, padding: 12 },
  hint: { fontSize: 15 },
  error: { fontSize: 15 },
  secondary: { fontSize: 17, textAlign: 'center', padding: 12 },
});
