import { type CurrencyCode } from '@luka/domain';
import type { AccountWithBalance } from '../db/accounts';
import { ACCOUNT_TYPE_LABELS } from './accountTypes';
import { GroupedCard } from './GroupedCard';
import { ListRow } from './ListRow';
import { balanceText, isNegativeBalance, NEGATIVE_BALANCE_HELP, spokenBalance } from './money';

interface Props {
  accounts: readonly AccountWithBalance[];
  onSelect: (id: string) => void;
  /** Título de la sección encima de la tarjeta, por ejemplo «Mis cuentas». */
  title?: string;
}

/** Lista de cuentas (HU-02): ícono, nombre, tipo y saldo; VoiceOver lo lee en una sola frase. */
export function AccountList({ accounts, onSelect, title }: Props) {
  return (
    <GroupedCard {...(title ? { title } : {})}>
      {accounts.map((account) => {
        const type = ACCOUNT_TYPE_LABELS[account.type];
        const archived = account.archivedAt ? 'archivada' : null;
        const currency = account.currency as CurrencyCode;
        const balance = balanceText(account.type, account.balanceMinor, currency);
        const negative = isNegativeBalance(account.type, account.balanceMinor);
        return (
          <ListRow
            key={account.id}
            icon={account.icon}
            color={account.color}
            title={account.name}
            subtitle={[type, account.currency, archived].filter(Boolean).join(' · ')}
            value={balance}
            // La deuda de la tarjeta («Debes») y el saldo negativo de otra cuenta van en el color de alerta;
            // el signo, «Debes» o la ayuda también lo dicen, nunca solo el color (T-046).
            valueTone={negative || balance.startsWith('Debes') ? 'alert' : 'default'}
            // La ayuda va dentro de la fila, que ya abre la edición de la cuenta: un enlace aparte sería
            // un segundo botón anidado en el primero.
            {...(negative
              ? {
                  warning: NEGATIVE_BALANCE_HELP,
                  accessibilityHint: `${NEGATIVE_BALANCE_HELP}. Abre la edición de la cuenta.`,
                }
              : {})}
            accessibilityLabel={[
              account.name,
              type,
              spokenBalance(account.type, account.balanceMinor, currency),
              archived,
            ]
              .filter(Boolean)
              .join(', ')}
            onPress={() => onSelect(account.id)}
          />
        );
      })}
    </GroupedCard>
  );
}
