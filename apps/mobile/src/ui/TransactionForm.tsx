import DateTimePicker from '@react-native-community/datetimepicker';
import {
  addDays,
  type CategoryKind,
  type CurrencyCode,
  formatAmountInput,
  localDateFromParts,
  parseAmount,
  type TransactionInputError,
} from '@luka/domain';
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AccountWithBalance } from '../db/accounts';
import type { CategoryNode } from '../db/categories';
import type { TopCategory } from '../db/transactions';
import { useTheme } from '../theme';
import type { FormHandle } from './FormHandle';
import { colorFor } from './palette';
import { Screen } from './Screen';
import { transactionErrorMessage } from './transactionErrors';

export interface TransactionValues {
  kind: 'expense' | 'income';
  amountMinor: number;
  accountId: string;
  categoryId: string | null;
  occurredOn: string;
  note: string;
}

export type SubmitResult =
  { ok: true; message: string } | { ok: false; errors: TransactionInputError[] };

interface Props {
  ref?: Ref<FormHandle>;
  accounts: readonly AccountWithBalance[];
  initialAccountId: string;
  /** Fecha local de hoy (AAAA-MM-DD), calculada con el reloj inyectado. */
  today: string;
  topCategories: (kind: CategoryKind) => TopCategory[];
  allCategories: (kind: CategoryKind) => CategoryNode[];
  onSubmit: (values: TransactionValues) => SubmitResult;
  onSavingChange?: (saving: boolean) => void;
}

const KINDS = [
  { kind: 'expense' as const, label: 'Gasto' },
  { kind: 'income' as const, label: 'Ingreso' },
];

/** El número escrito sin los decimales que la otra moneda no admite. */
const integerPart = (text: string) => text.split(',')[0] ?? '';

/**
 * Registrar un gasto o ingreso (HU-03, CU-08): el monto con el teclado numérico ya abierto, una de las
 * categorías más usadas y «Guardar» en la barra superior. Después de guardar queda listo para otro.
 */
export function TransactionForm(props: Props) {
  const { ref, accounts, initialAccountId, today, onSubmit, onSavingChange } = props;
  const { colors, scheme, spacing } = useTheme();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(initialAccountId);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [occurredOn, setOccurredOn] = useState(today);
  const [note, setNote] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<TransactionInputError[]>([]);
  const [message, setMessage] = useState('');
  // Evita guardar dos veces si se toca «Guardar» de nuevo antes de que la pantalla se redibuje.
  const saving = useRef(false);
  const currency = (accounts.find((a) => a.id === accountId)?.currency ?? 'COP') as CurrencyCode;

  useEffect(() => {
    saving.current = false;
    onSavingChange?.(false);
  }, [amount, onSavingChange]);

  const submit = () => {
    if (saving.current) return;
    const text = amount.replace(/,$/, '');
    const amountMinor = text === '' ? 0 : (parseAmount(text, currency) ?? 0);
    if (amountMinor <= 0) {
      setErrors(['amount_not_positive']);
      return;
    }
    saving.current = true;
    onSavingChange?.(true);
    const result = onSubmit({ kind, amountMinor, accountId, categoryId, occurredOn, note });
    if (!result.ok) {
      saving.current = false;
      onSavingChange?.(false);
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setMessage(result.message);
    AccessibilityInfo.announceForAccessibility(result.message);
    setAmount('');
    setCategoryId(null);
    setNote('');
  };
  useImperativeHandle(ref, () => ({ submit }));

  const chip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    a11y?: string,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.accent : colors.muted }]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );

  const categoryChip = (category: TopCategory) => (
    <Pressable
      key={category.id}
      accessibilityRole="radio"
      accessibilityLabel={category.accessibilityLabel}
      accessibilityState={{ selected: categoryId === category.id }}
      onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
      style={[
        styles.chip,
        styles.row,
        {
          gap: spacing.sm,
          borderColor: categoryId === category.id ? colors.accent : colors.muted,
          backgroundColor: `${colorFor(category.color, scheme)}1A`,
        },
      ]}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.text}
      >
        {category.icon}
      </Text>
      <Text style={[styles.text, { color: colors.text }]}>{category.label}</Text>
    </Pressable>
  );

  const errorText = errors.map((code) => (
    <Text key={code} style={[styles.error, { color: colorFor('red', scheme) }]}>
      {transactionErrorMessage(code)}
    </Text>
  ));
  const yesterday = addDays(today, -1);

  return (
    <Screen contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {KINDS.map((option) =>
          chip(option.kind, option.label, kind === option.kind, () => {
            setKind(option.kind);
            setCategoryId(null);
          }),
        )}
      </View>

      <View style={[styles.row, { gap: spacing.sm }]}>
        <TextInput
          accessibilityLabel="Monto"
          autoFocus
          value={amount}
          placeholder="0"
          onChangeText={(text) => setAmount(formatAmountInput(text, currency))}
          keyboardType={currency === 'COP' ? 'number-pad' : 'decimal-pad'}
          style={[styles.amount, { color: colors.text, borderColor: colors.muted }]}
        />
        <Text style={[styles.currency, { color: colors.muted }]}>{currency}</Text>
      </View>
      {errorText}

      <View style={[styles.wrap, { gap: spacing.sm }]}>
        {props.topCategories(kind).map(categoryChip)}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setShowAll(!showAll)}>
        <Text style={[styles.text, { color: colors.accent }]}>
          {showAll ? 'Ocultar categorías' : 'Todas las categorías'}
        </Text>
      </Pressable>
      {showAll &&
        props.allCategories(kind).map((main) => (
          <View key={main.id} style={{ gap: spacing.sm }}>
            <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
              {main.icon} {main.name}
            </Text>
            <View style={[styles.wrap, { gap: spacing.sm }]}>
              {main.children.map((child, index) =>
                categoryChip({
                  id: child.id,
                  // El «General» u «Otros» va al final de cada principal (listCategories).
                  label: index === main.children.length - 1 ? main.name : child.name,
                  accessibilityLabel:
                    index === main.children.length - 1 ? main.name : `${child.name}, ${main.name}`,
                  icon: child.icon,
                  color: child.color,
                }),
              )}
            </View>
          </View>
        ))}

      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
        Cuenta
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {accounts.map((account) =>
          chip(
            account.id,
            `${account.icon} ${account.name}`,
            accountId === account.id,
            () => {
              if (account.currency !== currency) {
                // Se conserva el número escrito y se reformatea para la otra moneda.
                setAmount(formatAmountInput(integerPart(amount), account.currency as CurrencyCode));
              }
              setAccountId(account.id);
            },
            `${account.name}, ${account.currency}`,
          ),
        )}
      </View>

      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
        Fecha
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {chip('today', 'Hoy', occurredOn === today, () => setOccurredOn(today))}
        {chip('yesterday', 'Ayer', occurredOn === yesterday, () => setOccurredOn(yesterday))}
        {chip(
          'other',
          occurredOn !== today && occurredOn !== yesterday ? occurredOn : 'Otra fecha',
          occurredOn !== today && occurredOn !== yesterday,
          () => setShowPicker(true),
        )}
      </View>
      {showPicker && (
        <DateTimePicker
          value={new Date(`${occurredOn}T12:00:00`)}
          mode="date"
          display="inline"
          maximumDate={new Date(`${today}T23:59:59`)}
          onValueChange={(_, date) => {
            setShowPicker(false);
            // Componentes locales de la fecha elegida, nunca toISOString.
            setOccurredOn(localDateFromParts(date.getFullYear(), date.getMonth(), date.getDate()));
          }}
          onDismiss={() => setShowPicker(false)}
        />
      )}

      <TextInput
        accessibilityLabel="Nota"
        placeholder="Nota (opcional)"
        value={note}
        onChangeText={setNote}
        maxLength={200}
        style={[styles.input, { color: colors.text, borderColor: colors.muted }]}
      />

      <Text accessibilityLiveRegion="polite" style={[styles.text, { color: colors.accent }]}>
        {message}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '600' },
  text: { fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  amount: {
    flex: 1,
    fontSize: 28,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  currency: { fontSize: 17, fontWeight: '600' },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 8, padding: 12 },
  chip: { borderWidth: 2, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  error: { fontSize: 15 },
});
