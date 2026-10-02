import { transactions } from '@luka/schema-sqlite';
import {
  type AccountFormValues,
  createAccount,
  getAccount,
  listAccounts,
  listActiveAccounts,
  setAccountArchived,
  updateAccount,
} from '../src/db/accounts';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { insertRow, softDelete, type WriteContext } from '../src/db/write';
import { balanceText } from '../src/ui/money';

const userId = '0199a6f0-0000-7000-8000-000000000001';

async function context(): Promise<WriteContext> {
  return { db: await createTestDb(), userId, clock: testClock(), random: testRandom() };
}

const cash: AccountFormValues = {
  name: 'Efectivo',
  type: 'cash',
  currency: 'COP',
  openingAmountMinor: 100_000_00,
  icon: 'banknote',
  color: 'green',
};

function created(result: ReturnType<typeof createAccount>): string {
  if (!result.ok) throw new Error(result.errors.join(', '));
  return result.id;
}

function movement(
  ctx: WriteContext,
  values: Partial<typeof transactions.$inferInsert> & { accountId: string },
) {
  return insertRow(ctx, transactions, {
    kind: 'expense',
    amountMinor: -1,
    currency: 'COP',
    occurredOn: '2026-10-02',
    ...values,
  });
}

const balanceOf = (ctx: WriteContext, id: string) =>
  listAccounts(ctx.db, { includeArchived: true }).find((a) => a.id === id)?.balanceMinor;

describe('HU-02 cuentas', () => {
  it('HU-02 una cuenta tiene nombre, tipo y saldo inicial', async () => {
    const ctx = await context();
    const id = created(createAccount(ctx, cash));
    expect(getAccount(ctx.db, id)).toMatchObject({
      name: 'Efectivo',
      type: 'cash',
      currency: 'COP',
      openingBalanceMinor: 100_000_00,
    });
  });

  it('HU-02 el saldo es el inicial más ingresos, menos gastos, más o menos transferencias', async () => {
    const ctx = await context();
    const id = created(createAccount(ctx, cash));
    const bank = created(
      createAccount(ctx, { ...cash, name: 'Banco', type: 'savings', openingAmountMinor: 0 }),
    );
    movement(ctx, { accountId: id, kind: 'income', amountMinor: 50_000_00 });
    movement(ctx, { accountId: id, kind: 'expense', amountMinor: -20_000_00 });
    movement(ctx, {
      accountId: id,
      kind: 'transfer',
      amountMinor: -10_000_00,
      toAccountId: bank,
      toAmountMinor: 10_000_00,
    });
    movement(ctx, {
      accountId: bank,
      kind: 'transfer',
      amountMinor: -5_000_00,
      toAccountId: id,
      toAmountMinor: 5_000_00,
    });
    movement(ctx, { accountId: id, kind: 'adjustment', amountMinor: -1_000_00 });
    expect(balanceOf(ctx, id)).toBe(124_000_00);
    expect(balanceOf(ctx, bank)).toBe(5_000_00);
  });

  it('HU-02 INV-09 el saldo no cuenta movimientos eliminados ni por revisar', async () => {
    const ctx = await context();
    const id = created(createAccount(ctx, cash));
    softDelete(ctx, transactions, movement(ctx, { accountId: id, amountMinor: -30_000_00 }));
    movement(ctx, {
      accountId: id,
      kind: 'income',
      amountMinor: 99_000_00,
      reviewStatus: 'pending_review',
    });
    expect(balanceOf(ctx, id)).toBe(100_000_00);
  });

  it('HU-02 el saldo inicial es cero o positivo, pero el saldo calculado puede ser negativo y se muestra bien', async () => {
    const ctx = await context();
    const id = created(createAccount(ctx, { ...cash, openingAmountMinor: 0 }));
    expect(createAccount(ctx, { ...cash, name: 'Otra', openingAmountMinor: -1 })).toEqual({
      ok: false,
      errors: ['amount_invalid'],
    });
    movement(ctx, { accountId: id, amountMinor: -30_000_00 });
    expect(balanceOf(ctx, id)).toBe(-30_000_00);
    expect(balanceText('cash', -30_000_00, 'COP')).toBe('-$ 30.000');
  });

  it('HU-02 la tarjeta de crédito pide la deuda en positivo, la guarda en negativo y muestra «Debes» o «A favor»', async () => {
    const ctx = await context();
    const card = created(
      createAccount(ctx, {
        ...cash,
        name: 'Visa',
        type: 'credit_card',
        openingAmountMinor: 500_000_00,
      }),
    );
    expect(getAccount(ctx.db, card)?.openingBalanceMinor).toBe(-500_000_00);
    expect(balanceText('credit_card', -500_000_00, 'COP')).toBe('Debes $ 500.000');
    const bank = created(
      createAccount(ctx, { ...cash, name: 'Banco', openingAmountMinor: 1_000_000_00 }),
    );
    movement(ctx, {
      accountId: bank,
      kind: 'transfer',
      amountMinor: -600_000_00,
      toAccountId: card,
      toAmountMinor: 600_000_00,
    });
    expect(balanceOf(ctx, card)).toBe(100_000_00);
    expect(balanceText('credit_card', 100_000_00, 'COP')).toBe('A favor $ 100.000');
  });

  it('HU-02 una cuenta archivada conserva su historial y su saldo, pero no se ofrece para movimientos nuevos', async () => {
    const ctx = await context();
    const id = created(createAccount(ctx, cash));
    movement(ctx, { accountId: id, amountMinor: -10_000_00 });
    expect(setAccountArchived(ctx, id, true)).toEqual({ ok: true, id });
    expect(listActiveAccounts(ctx.db).map((a) => a.id)).not.toContain(id);
    expect(listAccounts(ctx.db, { includeArchived: false }).map((a) => a.id)).not.toContain(id);
    expect(balanceOf(ctx, id)).toBe(90_000_00);
    expect(ctx.db.select().from(transactions).all()).toHaveLength(1);
  });

  it('HU-02 los nombres son únicos entre cuentas activas; al desarchivar con un nombre ocupado pide renombrar', async () => {
    const ctx = await context();
    const first = created(createAccount(ctx, cash));
    expect(createAccount(ctx, { ...cash, name: 'efectivo ' })).toEqual({
      ok: false,
      errors: ['name_duplicate'],
    });
    setAccountArchived(ctx, first, true);
    const second = created(createAccount(ctx, { ...cash, name: 'EFECTIVO' }));
    expect(setAccountArchived(ctx, first, false)).toEqual({
      ok: false,
      errors: ['name_duplicate'],
    });
    expect(updateAccount(ctx, first, { ...cash, name: 'Efectivo viejo' }).ok).toBe(true);
    expect(setAccountArchived(ctx, first, false)).toEqual({ ok: true, id: first });
    expect(
      listActiveAccounts(ctx.db)
        .map((a) => a.id)
        .sort(),
    ).toEqual([first, second].sort());
  });

  it('HU-02 INV-05 la moneda no cambia si la cuenta tiene movimientos', async () => {
    const ctx = await context();
    const id = created(createAccount(ctx, cash));
    expect(updateAccount(ctx, id, { ...cash, currency: 'USD' }).ok).toBe(true);
    expect(updateAccount(ctx, id, { ...cash, currency: 'COP' }).ok).toBe(true);
    movement(ctx, { accountId: id, amountMinor: -1_000_00 });
    expect(updateAccount(ctx, id, { ...cash, currency: 'USD' })).toEqual({
      ok: false,
      errors: ['currency_locked'],
    });
  });

  it('HU-02 cambiar el saldo inicial al editar se refleja en el saldo', async () => {
    const ctx = await context();
    const id = created(createAccount(ctx, cash));
    updateAccount(ctx, id, { ...cash, openingAmountMinor: 150_000_00 });
    expect(balanceOf(ctx, id)).toBe(150_000_00);
  });

  it('las cuentas se ordenan por sort_order: cada nueva va al final', async () => {
    const ctx = await context();
    created(createAccount(ctx, { ...cash, name: 'Zeta' }));
    created(createAccount(ctx, { ...cash, name: 'Alfa' }));
    expect(
      listAccounts(ctx.db, { includeArchived: false }).map((a) => [a.name, a.sortOrder]),
    ).toEqual([
      ['Zeta', 0],
      ['Alfa', 1],
    ]);
  });
});
