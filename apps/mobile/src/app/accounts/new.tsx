import type { AccountInputError } from '@luka/domain';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { createAccount } from '../../db/accounts';
import { useLocalSession } from '../../db/session';
import { AccountForm } from '../../ui/AccountForm';
import { ACCOUNT_DEFAULTS } from '../../ui/accountTypes';

export default function NewAccountScreen() {
  const session = useLocalSession();
  const [errors, setErrors] = useState<AccountInputError[]>([]);
  return (
    <>
      <Stack.Screen options={{ title: 'Nueva cuenta' }} />
      <AccountForm
        initial={{
          name: '',
          type: 'cash',
          currency: 'COP',
          openingAmountMinor: 0,
          ...ACCOUNT_DEFAULTS.cash,
        }}
        errors={errors}
        onSubmit={(values) => {
          const result = createAccount(session, values);
          if (result.ok) router.back();
          else setErrors(result.errors);
        }}
      />
    </>
  );
}
