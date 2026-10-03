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
import { AccountList } from './AccountList';
import { BottomSheet } from './BottomSheet';
import type { FormHandle } from './FormHandle';
import { balanceText } from './money';
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

/** Cómo se presenta la cuenta según el tipo de movimiento. */
const ACCOUNT_LABEL = { expense: 'Pagado con', income: 'Depositado en' } as const;

/** El número escrito sin los decimales que la otra moneda no admite. */
const integerPart = (text: string) => text.split(',')[0] ?? '';

/**
 * Registrar un gasto o ingreso (HU-03, CU-08). Orden: tipo; cuenta («Pagado con» o «Depositado en») y
 * fecha; monto con su moneda y el saldo de la cuenta; categorías; nota. «Guardar» está en la barra
 * superior y después de guardar el formulario queda listo para otro.
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
  const [sheet, setSheet] = useState<'account' | 'date' | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<TransactionInputError[]>([]);
  const [message, setMessage] = useState('');
  // Evita guardar dos veces si se toca «Guardar» de nuevo antes de que la pantalla se redibuje.
  const saving = useRef(false);
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const currency = (account?.currency ?? 'COP') as CurrencyCode;
  const yesterday = addDays(today, -1);
  const dateLabel = occurredOn === today ? 'Hoy' : occurredOn === yesterday ? 'Ayer' : occurredOn;

  useEffect(() => {
    saving.current = false;
    onSavingChange?.(false);
  }, [amount, onSavingChange]);

  const submit = () => {
    if (saving.current || !account) return;
    const text = amount.replace(/,$/, '');
    const amountMinor = text === '' ? 0 : (parseAmount(text, currency) ?? 0);
    if (amountMinor <= 0) {
      setErrors(['amount_not_positive']);
      return;
    }
    saving.current = true;
    onSavingChange?.(true);
    const result = onSubmit({
      kind,
      amountMinor,
      accountId: account.id,
      categoryId,
      occurredOn,
      note,
    });
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

  const chooseAccount = (id: string) => {
    const next = accounts.find((a) => a.id === id);
    if (next && next.currency !== currency) {
      // Se conserva el número escrito y se reformatea para la otra moneda.
      setAmount(formatAmountInput(integerPart(amount), next.currency as CurrencyCode));
    }
    setAccountId(id);
    setSheet(null);
  };

  const chooseDate = (date: string) => {
    setOccurredOn(date);
    setShowPicker(false);
    setSheet(null);
  };

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityLabel={label}
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

      {account && (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${ACCOUNT_LABEL[kind]} ${account.name}, ${account.currency}`}
            accessibilityHint="Cambia la cuenta"
            onPress={() => setSheet('account')}
            style={[styles.field, styles.flex, { borderColor: colors.muted }]}
          >
            <Text style={[styles.caption, { color: colors.muted }]}>{ACCOUNT_LABEL[kind]}</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {account.icon} {account.name} · {account.currency}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Fecha: ${dateLabel}`}
            accessibilityHint="Cambia la fecha"
            onPress={() => setSheet('date')}
            style={[styles.field, { borderColor: colors.muted }]}
          >
            <Text style={[styles.caption, { color: colors.muted }]}>Fecha</Text>
            <Text style={[styles.value, { color: colors.text }]}>{dateLabel}</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.row, { gap: spacing.sm }]}>
        {/* La key cambia con la moneda: el campo se vuelve a montar y el teclado cambia al instante. */}
        <TextInput
          key={currency}
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
      {account && (
        <Text style={[styles.caption, { color: colors.muted }]}>
          Saldo: {balanceText(account.type, account.balanceMinor, currency)}
        </Text>
      )}
      {errors.map((code) => (
        <Text key={code} style={[styles.error, { color: colorFor('red', scheme) }]}>
          {transactionErrorMessage(code)}
        </Text>
      ))}

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

      <BottomSheet
        visible={sheet === 'account'}
        title="Elige la cuenta"
        onClose={() => setSheet(null)}
      >
        <AccountList accounts={accounts} onSelect={chooseAccount} />
      </BottomSheet>
      <BottomSheet visible={sheet === 'date'} title="Elige la fecha" onClose={() => setSheet(null)}>
        <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
          {chip('today', 'Hoy', occurredOn === today, () => chooseDate(today))}
          {chip('yesterday', 'Ayer', occurredOn === yesterday, () => chooseDate(yesterday))}
          {chip('other', 'Otra fecha', showPicker, () => setShowPicker(true))}
        </View>
        {showPicker && (
          <DateTimePicker
            value={new Date(`${occurredOn}T12:00:00`)}
            mode="date"
            display="inline"
            maximumDate={new Date(`${today}T23:59:59`)}
            onValueChange={(_, date) => {
              // Componentes locales de la fecha elegida, nunca toISOString.
              chooseDate(localDateFromParts(date.getFullYear(), date.getMonth(), date.getDate()));
            }}
            onDismiss={() => setShowPicker(false)}
          />
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '600' },
  text: { fontSize: 17 },
  caption: { fontSize: 15 },
  value: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flex: 1 },
  field: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
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
