import DateTimePicker from '@react-native-community/datetimepicker';
import {
  addDays,
  type CategoryKind,
  type CurrencyCode,
  formatAmountInput,
  formatMoney,
  localDateFromParts,
  parseAmount,
  type TransactionInputError,
} from '@luka/domain';
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { AccountWithBalance } from '../db/accounts';
import type { CategoryNode } from '../db/categories';
import type { TopCategory } from '../db/transactions';
import {
  isAccessibilitySize,
  radius,
  sizes,
  spacing as space,
  typography,
  useTheme,
} from '../theme';
import { AccountList } from './AccountList';
import { BottomSheet } from './BottomSheet';
import { IconBadge } from './CategoryLabel';
import { Chip, SegmentedControl } from './Chip';
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
  /** Para el título de la pantalla: «Nuevo gasto» o «Nuevo ingreso». */
  onKindChange?: (kind: 'expense' | 'income') => void;
}

const KINDS = [
  { value: 'expense' as const, label: 'Gasto' },
  { value: 'income' as const, label: 'Ingreso' },
];

/** Cómo se presenta la cuenta según el tipo de movimiento. */
const ACCOUNT_LABEL = { expense: 'Pagado con', income: 'Depositado en' } as const;

/** Símbolo de la moneda delante del monto: «$», «US$» o «€». */
const symbolOf = (currency: CurrencyCode) => formatMoney(0, currency).split(' ')[0];

/** El número escrito sin los decimales que la otra moneda no admite. */
const integerPart = (text: string) => text.split(',')[0] ?? '';

/**
 * Registrar un gasto o ingreso (HU-03, CU-08), según la maqueta docs/diseno/Agregar gasto.png. Orden:
 * tipo; cuenta («Pagado con» o «Depositado en») y fecha; monto con su moneda y el saldo de la cuenta;
 * categorías; nota. «Guardar» está en la barra superior y después de guardar el formulario queda listo
 * para otro.
 */
export function TransactionForm(props: Props) {
  const { ref, accounts, initialAccountId, today, onSubmit, onSavingChange, onKindChange } = props;
  const { colors, scheme, spacing } = useTheme();
  // Con tamaños de accesibilidad, la cuenta y la fecha se apilan para que el nombre quepa.
  const stacked = isAccessibilitySize(useWindowDimensions().fontScale);
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

  const chooseKind = (next: 'expense' | 'income') => {
    setKind(next);
    setCategoryId(null);
    onKindChange?.(next);
  };

  // Ruta de la categoría elegida, «Alimentación › Supermercado»; el «General» muestra solo la principal.
  const categoryPath = (() => {
    for (const main of categoryId ? props.allCategories(kind) : []) {
      const index = main.children.findIndex((child) => child.id === categoryId);
      if (index === -1) continue;
      const child = main.children[index];
      return index === main.children.length - 1 || !child
        ? main.name
        : `${main.name} › ${child.name}`;
    }
    return '';
  })();

  const chooseDate = (date: string) => {
    setOccurredOn(date);
    setShowPicker(false);
    setSheet(null);
  };

  // La elegida va rellena con el color de acento y un ✓; las demás, con su color al 10 %.
  const categoryChip = (category: TopCategory) => {
    const selected = categoryId === category.id;
    return (
      <Pressable
        key={category.id}
        accessibilityRole="radio"
        accessibilityLabel={category.accessibilityLabel}
        accessibilityState={{ selected }}
        onPress={() => setCategoryId(selected ? null : category.id)}
        style={[
          styles.pill,
          styles.row,
          {
            gap: spacing.sm,
            backgroundColor: selected ? colors.accent : `${colorFor(category.color, scheme)}1A`,
          },
        ]}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.text, { color: colors.onAccent }]}
        >
          {selected ? '✓' : category.icon}
        </Text>
        <Text style={[styles.text, { color: selected ? colors.onAccent : colors.text }]}>
          {category.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Screen contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <SegmentedControl options={KINDS} value={kind} onChange={chooseKind} />

      {account && (
        <View style={[stacked ? styles.column : styles.row, { gap: spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${ACCOUNT_LABEL[kind]} ${account.name}, ${account.currency}`}
            accessibilityHint="Cambia la cuenta"
            onPress={() => setSheet('account')}
            style={[
              styles.card,
              stacked ? styles.column : [styles.row, styles.flex],
              { backgroundColor: colors.card },
            ]}
          >
            <IconBadge icon={account.icon} color={account.color} />
            <View style={styles.flex}>
              <Text style={[styles.caption, { color: colors.muted }]}>{ACCOUNT_LABEL[kind]}</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {account.name} · {account.currency}
              </Text>
            </View>
            {/* Chevron: indica que la fila abre la lista de cuentas; apilada, la tarjeta ya lo muestra. */}
            {!stacked && <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Fecha: ${dateLabel}`}
            accessibilityHint="Cambia la fecha"
            onPress={() => setSheet('date')}
            style={[styles.card, styles.row, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.value, { color: colors.text }]}>📅 {dateLabel}</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.row, styles.center, { gap: spacing.sm }]}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          maxFontSizeMultiplier={AMOUNT_MAX_SCALE}
          style={[styles.amount, { color: colors.text }]}
        >
          {symbolOf(currency)}
        </Text>
        {/* La key cambia con la moneda: el campo se vuelve a montar y el teclado cambia al instante. */}
        <TextInput
          key={currency}
          accessibilityLabel="Monto"
          autoFocus
          value={amount}
          placeholder="0"
          onChangeText={(text) => setAmount(formatAmountInput(text, currency))}
          keyboardType={currency === 'COP' ? 'number-pad' : 'decimal-pad'}
          maxFontSizeMultiplier={AMOUNT_MAX_SCALE}
          style={[styles.amount, styles.amountInput, { color: colors.text }]}
        />
        <Text style={[styles.currency, { color: colors.muted }]}>{currency}</Text>
      </View>
      {account && (
        <Text style={[styles.caption, styles.centerText, { color: colors.muted }]}>
          Saldo de la cuenta: {balanceText(account.type, account.balanceMinor, currency)}
        </Text>
      )}
      {errors.map((code) => (
        <Text key={code} style={[styles.caption, { color: colors.alert }]}>
          {transactionErrorMessage(code)}
        </Text>
      ))}

      <View style={[styles.wrap, styles.between, { gap: spacing.sm }]}>
        <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
          Categoría
        </Text>
        <Text style={[styles.caption, { color: colors.muted }]}>{categoryPath}</Text>
      </View>
      <View style={[styles.wrap, { gap: spacing.sm }]}>
        {props.topCategories(kind).map(categoryChip)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showAll ? 'Ocultar categorías' : 'Todas las categorías'}
          onPress={() => setShowAll(!showAll)}
          style={[styles.pill, { backgroundColor: `${colors.accent}26` }]}
        >
          <Text style={[styles.text, { color: colors.accentText }]}>
            {showAll ? 'Ocultar' : 'Todas ›'}
          </Text>
        </Pressable>
      </View>
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

      <View style={[styles.card, styles.row, { gap: spacing.md, backgroundColor: colors.card }]}>
        <Text style={[styles.text, { color: colors.text }]}>Nota</Text>
        <TextInput
          accessibilityLabel="Nota"
          placeholder="Opcional"
          placeholderTextColor={colors.muted}
          value={note}
          onChangeText={setNote}
          maxLength={200}
          style={[styles.text, styles.flex, { color: colors.text }]}
        />
      </View>

      <Text accessibilityLiveRegion="polite" style={[styles.text, { color: colors.accentText }]}>
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
          <Chip label="Hoy" selected={occurredOn === today} onPress={() => chooseDate(today)} />
          <Chip
            label="Ayer"
            selected={occurredOn === yesterday}
            onPress={() => chooseDate(yesterday)}
          />
          <Chip label="Otra fecha" selected={showPicker} onPress={() => setShowPicker(true)} />
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

/** El monto ya es grande: con Dynamic Type crece hasta 1,5 veces para no salirse de la pantalla. */
const AMOUNT_MAX_SCALE = 1.5;

const styles = StyleSheet.create({
  label: typography.headline,
  text: typography.body,
  caption: typography.subhead,
  value: typography.headline,
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  between: { justifyContent: 'space-between', alignItems: 'baseline' },
  card: {
    borderRadius: radius.card,
    minHeight: sizes.row,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: space.md - space.xs,
  },
  chevron: { ...typography.title, transform: [{ rotate: '90deg' }] },
  amount: typography.amount,
  amountInput: { minWidth: sizes.touch, flexShrink: 1, padding: 0 },
  currency: { ...typography.title, fontWeight: '600' },
  pill: {
    borderRadius: radius.pill,
    minHeight: sizes.touch,
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
});
