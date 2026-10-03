import { dateRange, parseAmount, today as localToday } from '@luka/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, SectionList, StyleSheet, Text, View } from 'react-native';
import { deviceTimeZone } from '../../clock';
import { listActiveAccounts } from '../../db/accounts';
import { listCategories } from '../../db/categories';
import { useLocalSession } from '../../db/session';
import {
  countTransactions,
  type ListCursor,
  listTransactions,
  type TransactionFilters,
  type TransactionListItem,
} from '../../db/transactions';
import { headingScale, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { countText, sectionTitle } from '../../ui/dates';
import { activeFilters, MovementFilters, type SheetFilters } from '../../ui/MovementFilters';
import { useScreenScrollProps } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { TransactionRow } from '../../ui/TransactionRow';
import { useUndo } from '../../undo';

const PAGE = 50;
const SEARCH_DELAY_MS = 250;

type Kind = NonNullable<TransactionFilters['kind']>;
const KINDS: { value: Kind | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'transfer', label: 'Transferencias' },
];

/** Filtros de la hoja, con fechas y montos ya resueltos para la consulta. */
function toQuery(
  kind: Kind | 'all',
  text: string,
  sheet: SheetFilters,
  today: string,
): TransactionFilters {
  const filters: TransactionFilters = {};
  if (kind !== 'all') filters.kind = kind;
  if (text.trim() !== '') filters.text = text;
  if (sheet.accountId) filters.accountId = sheet.accountId;
  if (sheet.categoryId) filters.categoryId = sheet.categoryId;
  if (sheet.dates)
    Object.assign(
      filters,
      'preset' in sheet.dates ? dateRange(sheet.dates.preset, today) : sheet.dates,
    );
  if (sheet.amount) {
    const { currency, min, max } = sheet.amount;
    const minor = (value: string) =>
      value === '' ? undefined : (parseAmount(value.replace(/,$/, ''), currency) ?? undefined);
    const minMinor = minor(min);
    const maxMinor = minor(max);
    filters.amount = {
      currency,
      ...(minMinor !== undefined ? { minMinor } : {}),
      ...(maxMinor !== undefined ? { maxMinor } : {}),
    };
  }
  return filters;
}

/** Agrupa una página ya ordenada por fecha en secciones por día. */
function byDay(items: TransactionListItem[]) {
  const sections: { day: string; data: TransactionListItem[] }[] = [];
  for (const item of items) {
    const last = sections.at(-1);
    if (last?.day === item.occurredOn) last.data.push(item);
    else sections.push({ day: item.occurredOn, data: [item] });
  }
  return sections;
}

/**
 * Movimientos (HU-05, CU-10): lista virtualizada por día, de a 50, con búsqueda y filtros. Al volver de
 * editar o borrar, o al deshacer, vuelve a leer lo mismo que ya había cargado con los mismos filtros, así
 * que la posición se conserva y una fila restaurada reaparece en su lugar.
 */
export default function MovementsScreen() {
  const session = useLocalSession();
  const { db, userId } = session;
  const { revision } = useUndo();
  const { colors, spacing, typography } = useTheme();
  const { key, props: scrollProps } = useScreenScrollProps({ padding: spacing.md });
  const today = localToday(session.clock, deviceTimeZone());

  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<SheetFilters>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [items, setItems] = useState<TransactionListItem[]>([]);
  const [cursor, setCursor] = useState<ListCursor | null>(null);
  const [total, setTotal] = useState(0);
  const [hasAny, setHasAny] = useState(true);

  // La búsqueda espera a que se deje de escribir; mientras tanto se ven los resultados anteriores.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text);
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  const filters = useMemo(() => toQuery(kind, search, sheet, today), [kind, search, sheet, today]);
  const loaded = useRef(PAGE);
  const lastFilters = useRef<string | null>(null);

  const reload = useCallback(() => {
    const signature = JSON.stringify(filters);
    const changed = lastFilters.current !== null && lastFilters.current !== signature;
    // Con otros filtros se empieza de nuevo; con los mismos, se vuelve a leer lo ya cargado.
    if (changed) loaded.current = PAGE;
    lastFilters.current = signature;
    const page = listTransactions(db, userId, filters, null, Math.max(PAGE, loaded.current));
    const count = countTransactions(db, userId, filters);
    setItems(page.items);
    setCursor(page.nextCursor);
    setTotal(count);
    setHasAny(countTransactions(db, userId, {}) > 0);
    if (changed) AccessibilityInfo.announceForAccessibility(countText(count));
  }, [db, userId, filters, revision]);
  useFocusEffect(reload);

  const loadMore = () => {
    if (!cursor) return;
    const page = listTransactions(db, userId, filters, cursor, PAGE);
    const next = [...items, ...page.items];
    loaded.current = next.length;
    setItems(next);
    setCursor(page.nextCursor);
  };

  const clearAll = () => {
    setKind('all');
    setText('');
    setSearch('');
    setSheet({});
  };

  const accounts = listActiveAccounts(db);
  const mains = [
    ...listCategories(db, 'expense', { includeArchived: false }),
    ...listCategories(db, 'income', { includeArchived: false }),
  ];
  const active = activeFilters(sheet);

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={headingScale.largeTitle}
        style={[typography.largeTitle, { color: colors.text }]}
      >
        Movimientos
      </Text>
      <TextField
        label="Buscar movimientos"
        value={text}
        placeholder="Nota, comercio, categoría o cuenta"
        onChangeText={setText}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <View accessibilityRole="radiogroup" style={[styles.wrap, { gap: spacing.sm }]}>
        {KINDS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={kind === option.value}
            onPress={() => {
              setKind(option.value);
            }}
          />
        ))}
      </View>
      <Button
        label={active > 0 ? `Filtros, ${String(active)} activos` : 'Filtros'}
        variant="secondary"
        onPress={() => {
          setSheetOpen(true);
        }}
      />
      <Text style={[typography.subhead, { color: colors.muted }]}>{countText(total)}</Text>
    </View>
  );

  const empty = hasAny ? (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.body, { color: colors.text }]}>
        No hay movimientos con estos filtros
      </Text>
      <Button label="Quitar filtros" variant="secondary" onPress={clearAll} />
    </View>
  ) : (
    <Text style={[typography.body, { color: colors.muted }]}>Aún no tienes movimientos</Text>
  );

  return (
    <>
      <SectionList
        key={key}
        {...scrollProps}
        accessibilityLabel={`Lista de movimientos: ${String(items.length)} de ${String(total)}`}
        sections={byDay(items)}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text
            accessibilityRole="header"
            style={[
              typography.subhead,
              styles.strong,
              {
                color: colors.muted,
                backgroundColor: colors.background,
                paddingVertical: spacing.sm,
              },
            ]}
          >
            {sectionTitle(section.day, today)}
          </Text>
        )}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.card }}>
            <TransactionRow
              item={item}
              today={today}
              onPress={(id) => {
                router.push(`/transactions/${id}`);
              }}
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={20}
        stickySectionHeadersEnabled
      />
      <MovementFilters
        key={sheetOpen ? 'abierta' : 'cerrada'}
        visible={sheetOpen}
        value={sheet}
        accounts={accounts}
        categories={mains}
        today={today}
        onApply={(next) => {
          setSheet(next);
          setSheetOpen(false);
        }}
        onClose={() => {
          setSheetOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  strong: { fontWeight: '600' },
});
