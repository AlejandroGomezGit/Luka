import { formatMoney } from '@luka/domain';
import type { TransactionListItem } from '../db/transactions';
import { dayLabel } from './dates';
import { ListRow } from './ListRow';

const KIND_LABEL = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  adjustment: 'Ajuste',
};

/**
 * Un movimiento en una lista (HU-04; T-016 la reutiliza). Gasto o ingreso: categoría, fecha y cuenta, y el
 * monto con signo. Transferencia: «Efectivo → Dolares» y, con monedas distintas, los dos montos
 * («$ 100.000» y debajo «→ US$ 25,00»). VoiceOver
 * lee tipo, monto, categoría o cuentas, y fecha, con la pista «Toca para editar».
 */
export function TransactionRow({
  item,
  today,
  onPress,
}: {
  item: TransactionListItem;
  /** Fecha local de hoy, para decir «Hoy» o «Ayer». */
  today: string;
  onPress: (id: string) => void;
}) {
  const day = dayLabel(item.occurredOn, today);
  const sent = formatMoney(Math.abs(item.amountMinor), item.currency);
  const common = { onPress: () => onPress(item.id), accessibilityHint: 'Toca para editar' };

  if (item.kind === 'transfer') {
    const arrives =
      item.toCurrency && item.toCurrency !== item.currency && item.toAmountMinor !== null
        ? formatMoney(item.toAmountMinor, item.toCurrency)
        : null;
    const to = item.toAccountName ?? '';
    return (
      <ListRow
        {...common}
        icon="🔁"
        color="gray"
        title={`${item.accountName} → ${to}`}
        subtitle={`${day} · Transferencia`}
        value={sent}
        // Con monedas distintas, lo que llega va debajo para no partir «Efectivo → Dolares».
        {...(arrives ? { valueDetail: `→ ${arrives}` } : {})}
        accessibilityLabel={[
          'Transferencia',
          sent,
          `de ${item.accountName} a ${to}`,
          ...(arrives ? [`llegan ${arrives}`] : []),
          day.toLowerCase(),
        ].join(', ')}
      />
    );
  }

  const amount = item.amountMinor < 0 ? formatMoney(item.amountMinor, item.currency) : `+${sent}`;
  const category = item.category?.label ?? 'Sin categoría';
  return (
    <ListRow
      {...common}
      icon={item.category?.icon ?? '🏷️'}
      color={item.category?.color ?? 'gray'}
      title={category}
      subtitle={`${day} · ${item.accountName}`}
      value={amount}
      accessibilityLabel={[
        KIND_LABEL[item.kind],
        amount,
        item.category?.accessibilityLabel ?? category,
        item.accountName,
        day.toLowerCase(),
      ].join(', ')}
    />
  );
}
