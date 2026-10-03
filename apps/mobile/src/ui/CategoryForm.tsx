import { type CategoryInputError, isEmoji, MAX_CATEGORY_NAME } from '@luka/domain';
import { type Ref, useImperativeHandle, useState } from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme';
import { CATEGORY_ERRORS } from './categoryErrors';
import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { EmojiField } from './EmojiField';
import type { FormHandle } from './FormHandle';
import { Screen } from './Screen';
import { TextField } from './TextField';

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
  const { colors, spacing, typography } = useTheme();
  // Un ícono guardado que no es emoji (datos antiguos) empieza vacío.
  const [values, setValues] = useState({
    ...initial,
    icon: isEmoji(initial.icon) ? initial.icon : '',
  });
  useImperativeHandle(ref, () => ({ submit: () => onSubmit(values) }), [onSubmit, values]);
  const errorsFor = (field: 'name' | 'icon' | 'color') =>
    errors
      .filter((code) => CATEGORY_ERRORS[code].field === field)
      .map((code) => (
        <Text key={code} style={[typography.subhead, { color: colors.alert }]}>
          {CATEGORY_ERRORS[code].message}
        </Text>
      ));

  return (
    <Screen contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <TextField
        label="Nombre"
        leading={
          <EmojiField
            value={values.icon}
            color={values.color}
            onChange={(icon) => setValues({ ...values, icon })}
          />
        }
        value={values.name}
        onChangeText={(name) => setValues({ ...values, name })}
        maxLength={MAX_CATEGORY_NAME}
      />
      <Text style={[typography.subhead, { color: colors.muted }]}>
        Toca el ícono para elegir un emoji del teclado.
      </Text>
      {errorsFor('name')}
      {errorsFor('icon')}

      <ColorPicker value={values.color} onChange={(color) => setValues({ ...values, color })} />
      {errorsFor('color')}

      {extraAction && (
        <Button
          label={extraAction.label}
          icon="+"
          variant="secondary"
          onPress={extraAction.onPress}
        />
      )}
      {onToggleArchived && (
        <Button
          label={archived ? 'Desarchivar' : 'Archivar'}
          variant="text"
          onPress={onToggleArchived}
        />
      )}
    </Screen>
  );
}
