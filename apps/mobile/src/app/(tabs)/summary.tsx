import {
  type CurrencyCode,
  formatMoney,
  monthOf,
  monthRange,
  percentages,
  shiftMonth,
  today as localToday,
  topWithRest,
} from '@luka/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { deviceTimeZone } from '../../clock';
import { useLocalSession } from '../../db/session';
import { type MonthSummary, monthlySummary, summaryCurrencies } from '../../db/summary';
import { headingScale, radius, sizes, useTheme } from '../../theme';
import { Chip, SegmentedControl } from '../../ui/Chip';
import { GroupedCard } from '../../ui/GroupedCard';
import { ListRow } from '../../ui/ListRow';
import { MonthPicker } from '../../ui/MonthPicker';
import { SERIES_COLORS } from '../../ui/palette';
import { Screen } from '../../ui/Screen';
import { monthTitle } from '../../ui/dates';
import { useUndo } from '../../undo';

const KINDS = [
  { value: 'expense' as const, label: 'Gastos' },
  { value: 'income' as const, label: 'Ingresos' },
];
const TOP = 6;
const plural = (n: number) => `${String(n)} ${n === 1 ? 'movimiento' : 'movimientos'}`;

/**
 * Resumen del mes (HU-08, CU-18), según docs/diseno/Resumen del mes.png: ingresos, gastos y balance; las
 * 6 categorías principales más grandes y «Otras categorías», con porcentajes que suman 100. La barra no
 * dice nada que la lista no diga, así que VoiceOver la salta. Tocar una categoría abre Movimientos con
 * esa categoría, ese mes y esa moneda.
 */
export default function SummaryScreen() {
  const session = useLocalSession();
  const { revision } = useUndo();
  const { colors, scheme, spacing, typography } = useTheme();
  const current = monthOf(localToday(session.clock, deviceTimeZone()));
  const [month, setMonth] = useState(current);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [currencies, setCurrencies] = useState<CurrencyCode[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>('COP');
  const [summary, setSummary] = useState<MonthSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      const available = summaryCurrencies(session.db);
      const chosen = available.includes(currency) ? currency : (available[0] ?? 'COP');
      setCurrencies(available);
      setCurrency(chosen);
      setSummary(monthlySummary(session.db, session.userId, month, chosen));
    }, [session, month, currency, revision]),
  );

  const money = (minor: number) => formatMoney(minor, currency);
  const list = summary ? summary[kind] : [];
  const { top, rest } = topWithRest(list, TOP);
  const shares = percentages([
    ...top.map((c) => c.amountMinor),
    ...(rest ? [rest.amountMinor] : []),
  ]);
  const series = SERIES_COLORS[scheme];
  const ofWhat = kind === 'expense' ? 'de los gastos' : 'de los ingresos';
  const total = summary ? (kind === 'expense' ? summary.expenseMinor : summary.incomeMinor) : 0;
  const restCount = rest ? list.slice(TOP).reduce((n, c) => n + c.count, 0) : 0;
  const empty = summary !== null && summary.incomeCount + summary.expenseCount === 0;

  return (
    <Screen contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={headingScale.largeTitle}
        style={[typography.largeTitle, { color: colors.text }]}
      >
        Resumen
      </Text>
      <MonthPicker
        month={month}
        current={current}
        onChange={(next) => {
          setMonth(shiftMonth(month, next === 'next' ? 1 : -1));
        }}
      />
      {currencies.length > 1 && (
        <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
          {currencies.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={currency === c}
              onPress={() => {
                setCurrency(c);
              }}
            />
          ))}
        </View>
      )}
      {summary && (
        <GroupedCard>
          <ListRow title="Ingresos" value={money(summary.incomeMinor)} />
          <ListRow title="Gastos" value={money(summary.expenseMinor)} />
          <ListRow
            title="Balance"
            value={money(summary.balanceMinor)}
            valueTone={summary.balanceMinor < 0 ? 'alert' : 'default'}
          />
        </GroupedCard>
      )}
      <Text style={[typography.subhead, { color: colors.muted }]}>
        Los reembolsos cuentan como ingresos y las transferencias entre tus cuentas no cuentan.
      </Text>
      {empty ? (
        <Text style={[typography.body, { color: colors.muted }]}>
          {`Sin movimientos en ${monthTitle(month).toLowerCase()}`}
        </Text>
      ) : (
        <>
          <SegmentedControl options={KINDS} value={kind} onChange={setKind} />
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.subhead, { color: colors.muted }]}>
              {kind === 'expense' ? 'Gastaste' : 'Recibiste'}
            </Text>
            <Text
              style={[typography.amount, { color: colors.text }]}
              maxFontSizeMultiplier={headingScale.largeTitle}
            >
              {money(total)}
            </Text>
          </View>
          {total > 0 && (
            // La barra repite lo que dice la lista: VoiceOver la salta.
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.bar, { gap: spacing.xs / 2 }]}
            >
              {[...top, ...(rest ? [rest] : [])].map((c, i) => (
                <View
                  key={i}
                  style={{ flex: c.amountMinor, backgroundColor: series[i] ?? colors.muted }}
                />
              ))}
            </View>
          )}
          {list.length > 0 && (
            <GroupedCard>
              {top.map((c, i) => {
                const label = `${c.name}, ${money(c.amountMinor)}, ${plural(c.count)}, ${String(shares[i] ?? 0)} % ${ofWhat}`;
                const { from, to } = monthRange(month);
                return (
                  <ListRow
                    key={c.id ?? 'sin-categoria'}
                    swatch={series[i] ?? colors.muted}
                    icon={c.icon}
                    color={c.color}
                    title={c.name}
                    subtitle={`${plural(c.count)} · ${String(shares[i] ?? 0)}\u00a0%`}
                    value={money(c.amountMinor)}
                    accessibilityLabel={label}
                    {...(c.id
                      ? {
                          accessibilityHint: 'Abre estos movimientos',
                          onPress: () => {
                            router.navigate({
                              pathname: '/movements',
                              params: { categoryId: c.id ?? '', from, to, kind, currency },
                            });
                          },
                        }
                      : {})}
                  />
                );
              })}
              {rest && (
                <ListRow
                  swatch={series[TOP] ?? colors.muted}
                  icon="🗂️"
                  color="gray"
                  title="Otras categorías"
                  subtitle={`${plural(restCount)} · ${String(shares[TOP] ?? 0)}\u00a0%`}
                  value={money(rest.amountMinor)}
                  accessibilityLabel={`Otras categorías, ${money(rest.amountMinor)}, ${plural(restCount)}, ${String(shares[TOP] ?? 0)} % ${ofWhat}`}
                />
              )}
            </GroupedCard>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  bar: {
    flexDirection: 'row',
    height: sizes.swatch,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
