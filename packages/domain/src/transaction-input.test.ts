import { describe, expect, it } from '@jest/globals';
import { type TransactionContext } from './invariants.js';
import { buildTransaction, type TransactionInput } from './transaction-input.js';

const cash = { id: 'cash', currency: 'COP' as const, archivedAt: null };
const groceries = { kind: 'expense' as const, systemKey: 'food.groceries', parentId: 'food' };
const ctx: TransactionContext = { account: cash, toAccount: null, category: groceries };
const today = '2026-10-01';

const input: TransactionInput = {
  kind: 'expense',
  amountMinor: 12_500_00,
  accountId: 'cash',
  categoryId: 'groceries',
  occurredOn: '2026-10-01',
};

describe('HU-03 buildTransaction', () => {
  it('HU-03 el monto escrito en positivo se guarda como entero con el signo del tipo y la moneda de la cuenta', () => {
    expect(buildTransaction(input, ctx, today)).toEqual({
      ok: true,
      transaction: {
        kind: 'expense',
        amountMinor: -12_500_00,
        toAmountMinor: null,
        accountId: 'cash',
        toAccountId: null,
        currency: 'COP',
        categoryId: 'groceries',
      },
    });
    const income = buildTransaction(
      { ...input, kind: 'income', categoryId: null },
      { ...ctx, category: null },
      today,
    );
    expect(income.ok && income.transaction.amountMinor).toBe(12_500_00);
  });

  it('HU-03 la categoría es opcional', () => {
    expect(
      buildTransaction({ ...input, categoryId: null }, { ...ctx, category: null }, today).ok,
    ).toBe(true);
  });

  it('HU-03 el monto debe ser mayor que cero y un entero seguro', () => {
    for (const amountMinor of [0, -5, 1.5, Number.MAX_SAFE_INTEGER + 2]) {
      expect(buildTransaction({ ...input, amountMinor }, ctx, today)).toEqual({
        ok: false,
        errors: ['amount_not_positive'],
      });
    }
  });

  it('la fecha no puede ser futura ni inválida', () => {
    expect(buildTransaction({ ...input, occurredOn: '2026-10-02' }, ctx, today)).toEqual({
      ok: false,
      errors: ['date_in_future'],
    });
    expect(buildTransaction({ ...input, occurredOn: '2026-02-30' }, ctx, today)).toEqual({
      ok: false,
      errors: ['date_invalid'],
    });
    expect(buildTransaction({ ...input, occurredOn: '2026-09-30' }, ctx, today).ok).toBe(true);
  });

  it('INV-06 una cuenta archivada no acepta movimientos nuevos; INV-04 la categoría debe ser del mismo tipo', () => {
    expect(buildTransaction(input, { ...ctx, account: { ...cash, archivedAt: 1 } }, today)).toEqual(
      {
        ok: false,
        errors: ['INV-06'],
      },
    );
    expect(buildTransaction({ ...input, kind: 'income' }, ctx, today)).toEqual({
      ok: false,
      errors: ['INV-04'],
    });
  });
});
