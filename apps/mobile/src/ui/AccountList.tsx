import { type CurrencyCode } from '@luka/domain';
import type { AccountWithBalance } from '../db/accounts';
import { ACCOUNT_TYPE_LABELS } from './accountTypes';
import { GroupedCard } from './GroupedCard';
import { ListRow } from './ListRow';
import { balanceText } from './money';

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
        const balance = balanceText(
          account.type,
          account.balanceMinor,
          account.currency as CurrencyCode,
        );
        return (
          <ListRow
            key={account.id}
            icon={account.icon}
            color={account.color}
            title={account.name}
            subtitle={[type, account.currency, archived].filter(Boolean).join(' · ')}
            value={balance}
            // Una deuda (tarjeta o saldo negativo) va en el color de alerta, además de decir «Debes».
            valueTone={balance.startsWith('Debes') ? 'alert' : 'default'}
            accessibilityLabel={[account.name, type, balance, archived].filter(Boolean).join(', ')}
            onPress={() => onSelect(account.id)}
          />
        );
      })}
    </GroupedCard>
  );
}
