import { type CurrencyCode, formatMoney, today } from '@luka/domain';
import { router, Stack } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { deviceTimeZone } from '../../clock';
import { listActiveAccounts } from '../../db/accounts';
import { listCategories } from '../../db/categories';
import { useLocalSession } from '../../db/session';
import {
  createTransaction,
  lastUsedAccountId,
  savedMessage,
  topCategories,
} from '../../db/transactions';
import type { FormHandle } from '../../ui/FormHandle';
import { HeaderButton } from '../../ui/HeaderButton';
import { TransactionForm } from '../../ui/TransactionForm';

/**
 * Registrar un gasto o ingreso (HU-03): «Guardar» registra y deja el formulario listo para otro. A la
 * izquierda dice «Cancelar» mientras no se haya guardado nada y «Listo» después.
 */
export default function NewTransactionScreen() {
  const session = useLocalSession();
  const form = useRef<FormHandle>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const accounts = useMemo(() => listActiveAccounts(session.db), [session.db]);
  const initialAccountId = lastUsedAccountId(session.db);
  const todayDate = today(session.clock, deviceTimeZone());
  if (!initialAccountId) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: kind === 'expense' ? 'Nuevo gasto' : 'Nuevo ingreso',
          headerLeft: () => (
            <HeaderButton label={saved ? 'Listo' : 'Cancelar'} onPress={() => router.back()} />
          ),
          headerRight: () => (
            <HeaderButton
              label="Guardar"
              prominent
              disabled={saving}
              onPress={() => form.current?.submit()}
            />
          ),
        }}
      />
      <TransactionForm
        ref={form}
        accounts={accounts}
        initialAccountId={initialAccountId}
        today={todayDate}
        topCategories={(kind) => topCategories(session.db, session.userId, kind)}
        allCategories={(kind) => listCategories(session.db, kind, { includeArchived: false })}
        onSavingChange={setSaving}
        onKindChange={setKind}
        onSubmit={(values) => {
          const result = createTransaction(session, values, deviceTimeZone());
          if (!result.ok) return result;
          setSaved(true);
          const currency = (accounts.find((a) => a.id === values.accountId)?.currency ??
            'COP') as CurrencyCode;
          return {
            ok: true,
            message: savedMessage(
              session.db,
              session.userId,
              values.kind,
              formatMoney(values.amountMinor, currency),
              values.categoryId,
            ),
          };
        }}
      />
    </>
  );
}
