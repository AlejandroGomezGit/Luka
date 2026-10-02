import type { AccountInputError } from '@luka/domain';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  accountFormValues,
  getAccount,
  setAccountArchived,
  updateAccount,
} from '../../db/accounts';
import { useLocalSession } from '../../db/session';
import { AccountForm } from '../../ui/AccountForm';

/** Editar o archivar una cuenta; para desarchivar, su nombre no puede estar en uso por una activa. */
export default function EditAccountScreen() {
  const session = useLocalSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = getAccount(session.db, id);
  const [errors, setErrors] = useState<AccountInputError[]>([]);
  if (!account) return null;
  const archived = account.archivedAt !== null;

  return (
    <>
      <Stack.Screen options={{ title: account.name }} />
      <AccountForm
        initial={accountFormValues(account)}
        errors={errors}
        archived={archived}
        onToggleArchived={() => {
          const result = setAccountArchived(session, account.id, !archived);
          if (result.ok) router.back();
          else setErrors(result.errors);
        }}
        onSubmit={(values) => {
          const result = updateAccount(session, account.id, values);
          if (result.ok) router.back();
          else setErrors(result.errors);
        }}
      />
    </>
  );
}
