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
import type { TopCategory, TransactionValues } from '../db/transactions';
import {
  isAccessibilitySize,
  radius,
  sizes,
  spacing as space,
  typography,
  useTheme,
} from '../theme';
import { AccountList } from './AccountList';
import { AccountRow } from './AccountRow';
import { BottomSheet } from './BottomSheet';
import { Chip, SegmentedControl } from './Chip';
import type { FormHandle } from './FormHandle';
import { Button } from './Button';
import { amountText, balanceText } from './money';
import { colorFor } from './palette';
import { Screen } from './Screen';
import { TextField } from './TextField';
import { transactionErrorMessage } from './transactionErrors';

export type Kind = 'expense' | 'income' | 'transfer';
export type { TransactionValues };

export type SubmitResult =
  { ok: true; message: string } | { ok: false; errors: TransactionInputError[] };

interface Props {
  ref?: Ref<FormHandle>;
  /** «edit» abre con `initial`, no ofrece cambiar a o desde transferencia y muestra «Eliminar movimiento». */
  mode?: 'create' | 'edit';
  initial?: TransactionValues;
  onDelete?: () => void;
  /** Nombre de una categoría que ya no se ofrece (archivada), para mostrar la del movimiento. */
  categoryName?: (id: string) => string | null;
  /**
   * Cuentas activas y, al editar, también la archivada del movimiento: se muestra con «(archivada)» pero
   * las hojas solo ofrecen las activas.
   */
  accounts: readonly AccountWithBalance[];
  initialAccountId: string;
  /** Fecha local de hoy (AAAA-MM-DD), calculada con el reloj inyectado. */
  today: string;
  topCategories: (kind: CategoryKind) => TopCategory[];
  allCategories: (kind: CategoryKind) => CategoryNode[];
  onSubmit: (values: TransactionValues) => SubmitResult;
  onSavingChange?: (saving: boolean) => void;
  /** Para el título de la pantalla: «Nuevo gasto», «Nuevo ingreso» o «Nueva transferencia». */
  onKindChange?: (kind: Kind) => void;
  /** Destino por defecto de una transferencia desde esa cuenta (lastTransferDestination). */
  transferDestination?: (fromId: string) => string | null;
}

const NEEDS_TWO_ACCOUNTS = 'Para transferir necesitas al menos dos cuentas activas.';

/** Cómo se presenta la cuenta según el tipo de movimiento. */
const ACCOUNT_LABEL = {
  expense: 'Pagado con',
  income: 'Depositado en',
  transfer: 'Desde',
} as const;

/** Símbolo de la moneda delante del monto: «$», «US$» o «€». */
const symbolOf = (currency: CurrencyCode) => formatMoney(0, currency).split(' ')[0];

/** El número escrito sin los decimales que la otra moneda no admite. */
const integerPart = (text: string) => text.split(',')[0] ?? '';

/**
 * Registrar un gasto o ingreso (HU-03, CU-08), según la maqueta docs/diseno/Agregar gasto.png, o una
 * transferencia (CU-06). Orden: tipo; cuenta («Pagado con», «Depositado en» o «Desde») y fecha; en una
 * transferencia, «Hacia»; monto con su moneda y el saldo de la cuenta; con monedas distintas, cuánto
 * llega; categorías (no en transferencias); nota. «Guardar» está en la barra superior y después de
 * guardar el formulario queda listo para otro.
 */
export function TransactionForm(props: Props) {
  const { ref, accounts, initialAccountId, today, onSubmit, onSavingChange, onKindChange } = props;
  const { initial, mode = 'create' } = props;
  const editing = mode === 'edit';
  const { colors, scheme, spacing } = useTheme();
  // Con tamaños de accesibilidad, la cuenta y la fecha se apilan para que el nombre quepa.
  const stacked = isAccessibilitySize(useWindowDimensions().fontScale);
  const currencyOf = (id: string | null) =>
    (accounts.find((a) => a.id === id)?.currency ?? 'COP') as CurrencyCode;
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'expense');
  const [amount, setAmount] = useState(
    initial ? amountText(initial.amountMinor, currencyOf(initial.accountId)) : '',
  );
  const [accountId, setAccountId] = useState(initialAccountId);
  const [toAccountId, setToAccountId] = useState<string | null>(
    initial?.kind === 'transfer' ? initial.toAccountId : null,
  );
  // Con monedas distintas, lo que llegó; con la misma moneda no se pide.
  const [toAmount, setToAmount] = useState(
    initial?.kind === 'transfer' &&
      initial.toAmountMinor !== null &&
      currencyOf(initial.toAccountId) !== currencyOf(initial.accountId)
      ? amountText(initial.toAmountMinor, currencyOf(initial.toAccountId))
      : '',
  );
  const [amountWidth, setAmountWidth] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(
    initial && initial.kind !== 'transfer' ? initial.categoryId : null,
  );
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [showAll, setShowAll] = useState(false);
  const [sheet, setSheet] = useState<'account' | 'toAccount' | 'date' | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<TransactionInputError[]>([]);
  const [message, setMessage] = useState('');
  // Evita guardar dos veces si se toca «Guardar» de nuevo antes de que la pantalla se redibuje.
  const saving = useRef(false);
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const currency = (account?.currency ?? 'COP') as CurrencyCode;
  // Las hojas solo ofrecen cuentas activas; la archivada del movimiento solo se muestra (INV-06).
  const activeAccounts = accounts.filter((a) => a.archivedAt === null);
  const canTransfer = activeAccounts.length >= 2;
  const isTransfer = kind === 'transfer';
  const toAccount = isTransfer ? accounts.find((a) => a.id === toAccountId) : undefined;
  const toCurrency = toAccount?.currency as CurrencyCode | undefined;
  // Con monedas distintas no hay tasa de cambio: la persona escribe cuánto llega.
  const differentCurrency = toCurrency !== undefined && toCurrency !== currency;
  const destinationFor = (fromId: string) =>
    props.transferDestination?.(fromId) ?? activeAccounts.find((a) => a.id !== fromId)?.id ?? null;
  const kinds = [
    { value: 'expense' as const, label: 'Gasto' },
    { value: 'income' as const, label: 'Ingreso' },
    // Al editar, un gasto o ingreso no pasa a ser transferencia (HU-04).
    ...(editing
      ? []
      : [
          {
            value: 'transfer' as const,
            label: 'Transferencia',
            disabled: !canTransfer,
            ...(canTransfer ? {} : { hint: NEEDS_TWO_ACCOUNTS }),
          },
        ]),
  ];
  // Al editar y cambiar de gasto a ingreso (o al revés), la categoría anterior no sirve: se pide otra.
  const askCategory =
    editing && initial !== undefined && kind !== initial.kind && categoryId === null;
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
    const arrives = toAmount.replace(/,$/, '');
    const result = onSubmit(
      isTransfer && toAccount
        ? {
            kind,
            amountMinor,
            accountId: account.id,
            toAccountId: toAccount.id,
            // Vacío o inválido llega como null y el dominio lo explica (to_amount_not_positive).
            toAmountMinor: differentCurrency
              ? arrives === ''
                ? null
                : parseAmount(arrives, toCurrency)
              : null,
            occurredOn,
            note,
          }
        : {
            kind: kind === 'income' ? 'income' : 'expense',
            amountMinor,
            accountId: account.id,
            categoryId,
            occurredOn,
            note,
          },
    );
    if (!result.ok) {
      saving.current = false;
      onSavingChange?.(false);
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setMessage(result.message);
    AccessibilityInfo.announceForAccessibility(result.message);
    // Al editar, la pantalla se cierra al guardar: no hay otro registro que preparar.
    if (editing) return;
    setAmount('');
    setToAmount('');
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
    // El origen nunca es también el destino.
    if (isTransfer && id === toAccountId) setToAccountId(destinationFor(id));
    setSheet(null);
  };

  const chooseToAccount = (id: string) => {
    const next = accounts.find((a) => a.id === id);
    // Lo que llegaba en otra moneda ya no vale: el monto de llegada se vuelve a pedir.
    if (next && next.currency !== toCurrency) setToAmount('');
    setToAccountId(id);
    setSheet(null);
  };

  const chooseKind = (next: Kind) => {
    setKind(next);
    setCategoryId(null);
    if (next === 'transfer' && (toAccountId === null || toAccountId === accountId)) {
      setToAccountId(destinationFor(accountId));
    }
    onKindChange?.(next);
  };

  // Ruta de la categoría elegida, «Alimentación › Supermercado»; el «General» muestra solo la principal.
  const categoryPath = (() => {
    for (const main of categoryId && !isTransfer ? props.allCategories(kind) : []) {
      const index = main.children.findIndex((child) => child.id === categoryId);
      if (index === -1) continue;
      const child = main.children[index];
      return index === main.children.length - 1 || !child
        ? main.name
        : `${main.name} › ${child.name}`;
    }
    return categoryId ? (props.categoryName?.(categoryId) ?? '') : '';
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
      {!(editing && isTransfer) && (
        <SegmentedControl options={kinds} value={kind} onChange={chooseKind} />
      )}
      {!canTransfer && !editing && (
        <Text style={[styles.caption, { color: colors.muted }]}>{NEEDS_TWO_ACCOUNTS}</Text>
      )}

      {account && (
        <View style={[stacked ? styles.column : styles.row, { gap: spacing.sm }]}>
          <AccountRow
            label={ACCOUNT_LABEL[kind]}
            account={account}
            hint={isTransfer ? 'Cambia la cuenta de origen' : 'Cambia la cuenta'}
            onPress={() => setSheet('account')}
            stacked={stacked}
            fill
          />
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

      {toAccount && (
        <AccountRow
          label="Hacia"
          account={toAccount}
          hint="Cambia la cuenta de destino"
          onPress={() => setSheet('toAccount')}
          stacked={stacked}
        />
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
        {/*
         * iOS no ensancha a tiempo un campo de ancho automático: al pasar de «6000» a «6.000» desplaza el
         * texto y oculta el primer dígito. Un texto invisible con el mismo estilo mide lo escrito y el
         * campo toma ese ancho.
         */}
        <Text
          testID="amount-mirror"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          maxFontSizeMultiplier={AMOUNT_MAX_SCALE}
          onLayout={(event) => setAmountWidth(Math.ceil(event.nativeEvent.layout.width))}
          style={[styles.amount, styles.mirror]}
        >
          {amount || '0'}
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
          style={[
            styles.amount,
            styles.amountInput,
            // Lo medido más el cursor.
            { color: colors.text, width: amountWidth + CARET_WIDTH },
          ]}
        />
        <Text style={[styles.currency, { color: colors.muted }]}>{currency}</Text>
      </View>
      {account && (
        <Text style={[styles.caption, styles.centerText, { color: colors.muted }]}>
          Saldo de la cuenta: {balanceText(account.type, account.balanceMinor, currency)}
        </Text>
      )}
      {differentCurrency && toAccount && (
        <TextField
          key={toCurrency}
          label={`Llega a ${toAccount.name} · ${toCurrency}`}
          value={toAmount}
          placeholder="0"
          onChangeText={(text) => setToAmount(formatAmountInput(text, toCurrency))}
          keyboardType={toCurrency === 'COP' ? 'number-pad' : 'decimal-pad'}
        />
      )}
      {errors.map((code) => (
        <Text key={code} style={[styles.caption, { color: colors.alert }]}>
          {transactionErrorMessage(code)}
        </Text>
      ))}

      {!isTransfer && (
        <>
          <View style={[styles.wrap, styles.between, { gap: spacing.sm }]}>
            <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
              Categoría
            </Text>
            <Text style={[styles.caption, { color: colors.muted }]}>{categoryPath}</Text>
          </View>
          {askCategory && (
            <Text style={[styles.caption, { color: colors.alert }]}>
              {`Elige una categoría de ${kind === 'income' ? 'ingreso' : 'gasto'}.`}
            </Text>
          )}
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
                        index === main.children.length - 1
                          ? main.name
                          : `${child.name}, ${main.name}`,
                      icon: child.icon,
                      color: child.color,
                    }),
                  )}
                </View>
              </View>
            ))}
        </>
      )}

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

      {props.onDelete && (
        <Button label="Eliminar movimiento" variant="destructive" onPress={props.onDelete} />
      )}

      <BottomSheet
        visible={sheet === 'account'}
        title="Elige la cuenta"
        onClose={() => setSheet(null)}
      >
        <AccountList accounts={activeAccounts} onSelect={chooseAccount} />
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'toAccount'}
        title="Elige la cuenta de destino"
        onClose={() => setSheet(null)}
      >
        <AccountList
          accounts={activeAccounts.filter((a) => a.id !== accountId)}
          onSelect={chooseToAccount}
        />
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
const CARET_WIDTH = 4;

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
  mirror: { position: 'absolute', opacity: 0 },
  currency: { ...typography.title, fontWeight: '600' },
  pill: {
    borderRadius: radius.pill,
    minHeight: sizes.touch,
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
});
