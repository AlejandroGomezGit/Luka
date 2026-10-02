import {
  type AccountInputError,
  type AccountType,
  type CurrencyCode,
  formatMoney,
  MAX_ACCOUNT_NAME,
  MINOR_UNITS,
  parseAmount,
} from '@luka/domain';
import { type Ref, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AccountFormValues } from '../db/accounts';
import { useTheme } from '../theme';
import { accountErrorMessage } from './accountErrors';
import {
  ACCOUNT_DEFAULTS,
  ACCOUNT_TYPE_HINTS,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  CURRENCY_LABELS,
} from './accountTypes';
import { ColorPicker } from './ColorPicker';
import { EmojiField } from './EmojiField';
import type { FormHandle } from './FormHandle';
import { colorFor } from './palette';
import { Screen } from './Screen';

interface Props {
  ref?: Ref<FormHandle>;
  initial: AccountFormValues;
  errors: readonly AccountInputError[];
  onSubmit: (values: AccountFormValues) => void;
  /** Solo al editar: archivar o desarchivar; no hay eliminar. */
  archived?: boolean;
  onToggleArchived?: () => void;
}

/** Monto para el campo de texto, sin símbolo: «500.000» o «1.234,56». */
const amountText = (minor: number, currency: CurrencyCode) =>
  formatMoney(minor, currency).replace(/^\S+ /, '');

/**
 * Formulario de cuenta (HU-02), compacto: tipo y moneda son opciones en fila y «Guardar» está en la barra
 * superior de la pantalla. No pide número de cuenta ni de tarjeta.
 */
export function AccountForm({ ref, initial, errors, onSubmit, archived, onToggleArchived }: Props) {
  const { colors, scheme, spacing } = useTheme();
  const [values, setValues] = useState(initial);
  const [amount, setAmount] = useState(amountText(initial.openingAmountMinor, initial.currency));
  const [amountError, setAmountError] = useState(false);
  const isCard = values.type === 'credit_card';
  const amountLabel = isCard ? 'Deuda actual' : 'Saldo inicial';

  const submit = () => {
    const minor = parseAmount(amount.trim() === '' ? '0' : amount, values.currency);
    setAmountError(minor === null);
    if (minor !== null) onSubmit({ ...values, openingAmountMinor: minor });
  };
  useImperativeHandle(ref, () => ({ submit }));

  const shown = [...errors, ...(amountError ? (['amount_invalid'] as const) : [])];
  const errorsFor = (field: string) =>
    shown
      .map((code) => ({ code, ...accountErrorMessage(code, values.currency) }))
      .filter((error) => error.field === field)
      .map((error) => (
        <Text key={error.code} style={[styles.error, { color: colorFor('red', scheme) }]}>
          {error.message}
        </Text>
      ));

  const chooseType = (type: AccountType) => {
    // Si la persona no cambió el ícono ni el color, siguen al tipo elegido.
    const defaults = ACCOUNT_DEFAULTS[values.type];
    const untouched = values.icon === defaults.icon && values.color === defaults.color;
    setValues({ ...values, type, ...(untouched ? ACCOUNT_DEFAULTS[type] : {}) });
  };

  const chip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    hint?: string,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.accent : colors.muted }]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
      {hint && <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text>}
    </Pressable>
  );

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
          maxLength={MAX_ACCOUNT_NAME}
          style={[styles.input, styles.flex, { color: colors.text, borderColor: colors.muted }]}
        />
      </View>
      {errorsFor('name')}
      {errorsFor('icon')}

      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
        Tipo
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {ACCOUNT_TYPE_ORDER.map((type) =>
          chip(
            type,
            ACCOUNT_TYPE_LABELS[type],
            values.type === type,
            () => chooseType(type),
            ACCOUNT_TYPE_HINTS[type],
          ),
        )}
      </View>
      {errorsFor('type')}

      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
        Moneda
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {(Object.keys(MINOR_UNITS) as CurrencyCode[]).map((currency) =>
          chip(currency, CURRENCY_LABELS[currency], values.currency === currency, () =>
            setValues({ ...values, currency }),
          ),
        )}
      </View>
      {errorsFor('currency')}

      <Text style={[styles.label, { color: colors.text }]}>{amountLabel}</Text>
      <TextInput
        accessibilityLabel={amountLabel}
        value={amount}
        onChangeText={setAmount}
        keyboardType={values.currency === 'COP' ? 'number-pad' : 'decimal-pad'}
        style={[styles.input, { color: colors.text, borderColor: colors.muted }]}
      />
      <Text style={[styles.hint, { color: colors.muted }]}>
        {isCard ? 'Lo que debes hoy en la tarjeta. ' : ''}Puedes corregirlo después; cambia el saldo
        de la cuenta.
      </Text>
      {errorsFor('amount')}

      <ColorPicker value={values.color} onChange={(color) => setValues({ ...values, color })} />
      {errorsFor('color')}

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
      {errorsFor('archive')}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '600' },
  text: { fontSize: 17 },
  hint: { fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flex: 1 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 8, padding: 12 },
  chip: { borderWidth: 2, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  error: { fontSize: 15 },
  secondary: { fontSize: 17, textAlign: 'center', padding: 12 },
});
