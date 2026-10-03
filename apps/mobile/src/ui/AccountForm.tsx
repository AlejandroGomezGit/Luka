import {
  type AccountInputError,
  isEmoji,
  type AccountType,
  type CurrencyCode,
  formatAmountInput,
  MAX_ACCOUNT_NAME,
  MINOR_UNITS,
  parseAmount,
} from '@luka/domain';
import { type Ref, useImperativeHandle, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { Button } from './Button';
import { Chip } from './Chip';
import { ColorPicker } from './ColorPicker';
import { EmojiField } from './EmojiField';
import type { FormHandle } from './FormHandle';
import { amountText } from './money';
import { Screen } from './Screen';
import { TextField } from './TextField';

interface Props {
  ref?: Ref<FormHandle>;
  initial: AccountFormValues;
  errors: readonly AccountInputError[];
  onSubmit: (values: AccountFormValues) => void;
  /** Solo al editar: archivar o desarchivar; no hay eliminar. */
  archived?: boolean;
  onToggleArchived?: () => void;
}

/**
 * Formulario de cuenta (HU-02), compacto: tipo y moneda son opciones en fila y «Guardar» está en la barra
 * superior de la pantalla. No pide número de cuenta ni de tarjeta.
 */
export function AccountForm({ ref, initial, errors, onSubmit, archived, onToggleArchived }: Props) {
  const { colors, spacing, typography } = useTheme();
  // Un ícono guardado que no es emoji (datos antiguos) empieza vacío.
  const [values, setValues] = useState({
    ...initial,
    icon: isEmoji(initial.icon) ? initial.icon : '',
  });
  const [amount, setAmount] = useState(amountText(initial.openingAmountMinor, initial.currency));
  const [amountError, setAmountError] = useState(false);
  const isCard = values.type === 'credit_card';
  const amountLabel = isCard ? 'Deuda actual' : 'Saldo inicial';

  const submit = () => {
    // Una coma final (decimales empezados pero vacíos) no impide guardar.
    const text = amount.replace(/,$/, '');
    const minor = parseAmount(text === '' ? '0' : text, values.currency);
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
        <Text key={error.code} style={[typography.subhead, { color: colors.alert }]}>
          {error.message}
        </Text>
      ));

  const chooseType = (type: AccountType) => {
    // Si la persona no cambió el ícono ni el color, siguen al tipo elegido.
    const defaults = ACCOUNT_DEFAULTS[values.type];
    const untouched = values.icon === defaults.icon && values.color === defaults.color;
    setValues({ ...values, type, ...(untouched ? ACCOUNT_DEFAULTS[type] : {}) });
  };

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
        maxLength={MAX_ACCOUNT_NAME}
      />
      {errorsFor('name')}
      {errorsFor('icon')}

      <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
        Tipo
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {ACCOUNT_TYPE_ORDER.map((type) => (
          <Chip
            key={type}
            label={ACCOUNT_TYPE_LABELS[type]}
            selected={values.type === type}
            onPress={() => chooseType(type)}
            {...(ACCOUNT_TYPE_HINTS[type] ? { hint: ACCOUNT_TYPE_HINTS[type] } : {})}
          />
        ))}
      </View>
      {errorsFor('type')}

      <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
        Moneda
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {(Object.keys(MINOR_UNITS) as CurrencyCode[]).map((currency) => (
          <Chip
            key={currency}
            label={CURRENCY_LABELS[currency]}
            selected={values.currency === currency}
            onPress={() => {
              setValues({ ...values, currency });
              setAmount(formatAmountInput(amount, currency));
            }}
          />
        ))}
      </View>
      {errorsFor('currency')}

      <TextField
        label={amountLabel}
        value={amount}
        onChangeText={(text) => setAmount(formatAmountInput(text, values.currency))}
        keyboardType={values.currency === 'COP' ? 'number-pad' : 'decimal-pad'}
      />
      <Text style={[typography.subhead, { color: colors.muted }]}>
        {isCard ? 'Lo que debes hoy en la tarjeta. ' : ''}Puedes corregirlo después; cambia el saldo
        de la cuenta.
      </Text>
      {errorsFor('amount')}

      <ColorPicker value={values.color} onChange={(color) => setValues({ ...values, color })} />
      {errorsFor('color')}

      {onToggleArchived && (
        <Button
          label={archived ? 'Desarchivar' : 'Archivar'}
          variant="text"
          onPress={onToggleArchived}
        />
      )}
      {errorsFor('archive')}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
