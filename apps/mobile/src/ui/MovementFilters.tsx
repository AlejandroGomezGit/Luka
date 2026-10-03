import DateTimePicker from '@react-native-community/datetimepicker';
import {
  type CurrencyCode,
  type DateRangePreset,
  formatAmountInput,
  localDateFromParts,
} from '@luka/domain';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Chip } from './Chip';
import { TextField } from './TextField';

/** Filtros de la hoja (los de tipo y texto están en la pantalla). Montos como los escribe la persona. */
export interface SheetFilters {
  accountId?: string;
  categoryId?: string;
  dates?: { preset: DateRangePreset } | { from: string; to: string };
  amount?: { currency: CurrencyCode; min: string; max: string };
}

/** Cuántos grupos de la hoja están activos, para «Filtros, n activos». */
export function activeFilters(filters: SheetFilters): number {
  return [filters.accountId, filters.categoryId, filters.dates, filters.amount].filter(Boolean)
    .length;
}

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes pasado' },
  { value: 'last_30_days', label: 'Últimos 30 días' },
];

interface Props {
  visible: boolean;
  value: SheetFilters;
  accounts: readonly { id: string; name: string; currency: string }[];
  /** Categorías principales de gasto e ingreso; una principal incluye sus subcategorías. */
  categories: readonly { id: string; name: string }[];
  today: string;
  onApply: (filters: SheetFilters) => void;
  onClose: () => void;
}

/**
 * Hoja de filtros de Movimientos (HU-05): cuenta, categoría, fechas y monto. El monto lleva siempre
 * moneda: con una sola entre las cuentas activas se usa esa; con varias, se elige.
 */
export function MovementFilters(props: Props) {
  const { colors, spacing, typography } = useTheme();
  const [draft, setDraft] = useState<SheetFilters>(props.value);
  const currencies = [...new Set(props.accounts.map((a) => a.currency as CurrencyCode))];
  const amountCurrency = draft.amount?.currency ?? currencies[0] ?? 'COP';
  const custom = draft.dates && 'from' in draft.dates ? draft.dates : null;
  // Tocar de nuevo la opción elegida la quita.
  const toggle = <K extends keyof SheetFilters>(key: K, value: SheetFilters[K]) => {
    const same = JSON.stringify(draft[key]) === JSON.stringify(value);
    setDraft({ ...draft, [key]: same ? undefined : value });
  };
  const setAmount = (field: 'min' | 'max', text: string) => {
    const amount = { currency: amountCurrency, min: '', max: '', ...draft.amount };
    amount[field] = formatAmountInput(text, amountCurrency);
    const next = { ...draft };
    if (amount.min === '' && amount.max === '') delete next.amount;
    else next.amount = amount;
    setDraft(next);
  };
  const title = (text: string) => (
    <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
      {text}
    </Text>
  );
  const pick = (date: Date) =>
    localDateFromParts(date.getFullYear(), date.getMonth(), date.getDate());

  return (
    <BottomSheet visible={props.visible} title="Filtros" onClose={props.onClose}>
      {title('Cuenta')}
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {props.accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            selected={draft.accountId === a.id}
            onPress={() => toggle('accountId', a.id)}
          />
        ))}
      </View>
      {title('Categoría')}
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {props.categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={draft.categoryId === c.id}
            onPress={() => toggle('categoryId', c.id)}
          />
        ))}
      </View>
      {title('Fechas')}
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {PRESETS.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={
              draft.dates !== undefined && 'preset' in draft.dates && draft.dates.preset === p.value
            }
            onPress={() => toggle('dates', { preset: p.value })}
          />
        ))}
        <Chip
          label="Personalizado"
          selected={custom !== null}
          onPress={() => toggle('dates', custom ?? { from: props.today, to: props.today })}
        />
      </View>
      {custom && (
        <View style={[styles.wrap, { gap: spacing.md }]}>
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.subhead, { color: colors.muted }]}>Desde</Text>
            <DateTimePicker
              accessibilityLabel="Desde"
              value={new Date(`${custom.from}T12:00:00`)}
              mode="date"
              maximumDate={new Date(`${custom.to}T12:00:00`)}
              onValueChange={(_, date) => {
                setDraft({ ...draft, dates: { from: pick(date), to: custom.to } });
              }}
            />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.subhead, { color: colors.muted }]}>Hasta</Text>
            <DateTimePicker
              accessibilityLabel="Hasta"
              value={new Date(`${custom.to}T12:00:00`)}
              mode="date"
              minimumDate={new Date(`${custom.from}T12:00:00`)}
              maximumDate={new Date(`${props.today}T12:00:00`)}
              onValueChange={(_, date) => {
                setDraft({ ...draft, dates: { from: custom.from, to: pick(date) } });
              }}
            />
          </View>
        </View>
      )}
      {title('Monto')}
      {currencies.length > 1 && (
        <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
          {currencies.map((currency) => (
            <Chip
              key={currency}
              label={currency}
              selected={amountCurrency === currency}
              onPress={() => {
                setDraft({
                  ...draft,
                  amount: { min: '', max: '', ...draft.amount, currency },
                });
              }}
            />
          ))}
        </View>
      )}
      <TextField
        label="Monto mínimo"
        value={draft.amount?.min ?? ''}
        placeholder={currencies.length > 1 ? `En ${amountCurrency}` : undefined}
        onChangeText={(text) => setAmount('min', text)}
        keyboardType={amountCurrency === 'COP' ? 'number-pad' : 'decimal-pad'}
      />
      <TextField
        label="Monto máximo"
        value={draft.amount?.max ?? ''}
        onChangeText={(text) => setAmount('max', text)}
        keyboardType={amountCurrency === 'COP' ? 'number-pad' : 'decimal-pad'}
      />
      <Button label="Ver resultados" onPress={() => props.onApply(draft)} />
      <Button
        label="Quitar filtros"
        variant="text"
        onPress={() => {
          setDraft({});
          props.onApply({});
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
