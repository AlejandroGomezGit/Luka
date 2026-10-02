import type { AccountInputError } from '@luka/domain';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { createAccount } from '../../db/accounts';
import { useLocalSession } from '../../db/session';
import { AccountForm } from '../../ui/AccountForm';
import { ACCOUNT_DEFAULTS } from '../../ui/accountTypes';
import type { FormHandle } from '../../ui/FormHandle';
import { HeaderButton } from '../../ui/HeaderButton';

export default function NewAccountScreen() {
  const session = useLocalSession();
  const form = useRef<FormHandle>(null);
  const [errors, setErrors] = useState<AccountInputError[]>([]);
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Nueva cuenta',
          headerRight: () => (
            <HeaderButton label="Guardar" onPress={() => form.current?.submit()} />
          ),
        }}
      />
      <AccountForm
        ref={form}
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
