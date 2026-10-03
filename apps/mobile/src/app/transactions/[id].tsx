import { today } from '@luka/domain';
import { transactions } from '@luka/schema-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { deviceTimeZone } from '../../clock';
import { listAccounts } from '../../db/accounts';
import { getCategory, listCategories } from '../../db/categories';
import { useLocalSession } from '../../db/session';
import {
  categoryLabels,
  getTransaction,
  topCategories,
  transactionValues,
  updateTransaction,
} from '../../db/transactions';
import { restore, softDelete } from '../../db/write';
import type { FormHandle } from '../../ui/FormHandle';
import { HeaderButton } from '../../ui/HeaderButton';
import { type Kind, TransactionForm } from '../../ui/TransactionForm';
import { useUndo } from '../../undo';

const TITLES: Record<Kind, string> = {
  expense: 'Editar gasto',
  income: 'Editar ingreso',
  transfer: 'Editar transferencia',
};

/**
 * Editar o eliminar un movimiento (HU-04, CU-09). «Guardar» guarda y vuelve; «Eliminar movimiento» lo
 * borra sin confirmación (borrado lógico) y ofrece «Deshacer» en la raíz de la app.
 */
export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useLocalSession();
  const { offer } = useUndo();
  const form = useRef<FormHandle>(null);
  const [saving, setSaving] = useState(false);
  const row = useMemo(() => getTransaction(session.db, id), [session.db, id]);
  const [kind, setKind] = useState<Kind>(
    row?.kind === 'transfer' ? 'transfer' : row?.kind === 'income' ? 'income' : 'expense',
  );
  // Activas y, si el movimiento está en una cuenta archivada, también esa para mostrarla.
  const accounts = useMemo(
    () =>
      listAccounts(session.db, { includeArchived: true }).filter(
        (a) => a.archivedAt === null || a.id === row?.accountId || a.id === row?.toAccountId,
      ),
    [session.db, row],
  );
  if (!row || row.deletedAt) return null;

  const categoryName = (categoryId: string) => {
    const sub = getCategory(session.db, categoryId);
    const main = sub?.parentId ? getCategory(session.db, sub.parentId) : undefined;
    if (!sub || !main) return null;
    const { label } = categoryLabels(session.userId, sub, main);
    return sub.archivedAt || main.archivedAt ? `${label} (archivada)` : label;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: TITLES[kind],
          headerLeft: () => <HeaderButton label="Cancelar" onPress={() => router.back()} />,
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
        mode="edit"
        initial={transactionValues(row)}
        accounts={accounts}
        initialAccountId={row.accountId}
        today={today(session.clock, deviceTimeZone())}
        topCategories={(k) => topCategories(session.db, session.userId, k)}
        allCategories={(k) => listCategories(session.db, k, { includeArchived: false })}
        categoryName={categoryName}
        onSavingChange={setSaving}
        onKindChange={setKind}
        onSubmit={(values) => {
          const result = updateTransaction(session, row.id, values, deviceTimeZone());
          if (!result.ok) return result;
          router.back();
          return { ok: true, message: 'Cambios guardados' };
        }}
        onDelete={() => {
          softDelete(session, transactions, row.id);
          offer({
            message: 'Movimiento eliminado. Puedes deshacerlo.',
            undo: () => {
              restore(session, transactions, row.id);
            },
          });
          router.back();
        }}
      />
    </>
  );
}
