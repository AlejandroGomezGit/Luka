import { describe, expect, it } from '@jest/globals';
import { type AccountRef, type TransactionContext } from './invariants.js';
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

describe('HU-02 transferencias (CU-06)', () => {
  const bank = { id: 'bank', currency: 'COP' as const, archivedAt: null };
  const dollars = { id: 'usd', currency: 'USD' as const, archivedAt: null };
  const transfer: TransactionInput = {
    kind: 'transfer',
    amountMinor: 200_000_00,
    accountId: 'bank',
    toAccountId: 'cash',
    toAmountMinor: null,
    occurredOn: '2026-10-01',
  };
  const between = (account: AccountRef = bank, toAccount: AccountRef = cash) => ({
    account,
    toAccount,
    category: null,
  });

  it('HU-02 sale negativa del origen y llega positiva al destino, sin categoría', () => {
    expect(buildTransaction(transfer, between(), today)).toEqual({
      ok: true,
      transaction: {
        kind: 'transfer',
        amountMinor: -200_000_00,
        toAmountMinor: 200_000_00,
        accountId: 'bank',
        toAccountId: 'cash',
        currency: 'COP',
        categoryId: null,
      },
    });
  });

  it('HU-02 INV-03 con la misma moneda llega exactamente lo que sale, aunque se escriba otro monto de llegada', () => {
    const result = buildTransaction({ ...transfer, toAmountMinor: 1 }, between(), today);
    expect(result.ok && result.transaction.toAmountMinor).toBe(200_000_00);
  });

  it('HU-02 con monedas distintas se guarda el monto de llegada escrito, en la moneda del destino', () => {
    const result = buildTransaction(
      { ...transfer, amountMinor: 400_000_00, toAccountId: 'usd', toAmountMinor: 100_00 },
      between(bank, dollars),
      today,
    );
    expect(result).toEqual({
      ok: true,
      transaction: expect.objectContaining({
        amountMinor: -400_000_00,
        currency: 'COP',
        toAccountId: 'usd',
        toAmountMinor: 100_00,
      }),
    });
  });

  it('HU-02 con monedas distintas el monto de llegada es obligatorio y mayor que cero', () => {
    for (const toAmountMinor of [null, 0, -5, 1.5]) {
      expect(
        buildTransaction(
          { ...transfer, toAccountId: 'usd', toAmountMinor },
          between(bank, dollars),
          today,
        ),
      ).toEqual({ ok: false, errors: ['to_amount_not_positive'] });
    }
  });

  it('HU-02 INV-02 no se puede transferir a la misma cuenta; INV-06 ni desde ni hacia una cuenta archivada', () => {
    expect(
      buildTransaction({ ...transfer, toAccountId: 'bank' }, between(bank, bank), today),
    ).toEqual({
      ok: false,
      errors: ['INV-02'],
    });
    expect(buildTransaction(transfer, between(bank, { ...cash, archivedAt: 1 }), today)).toEqual({
      ok: false,
      errors: ['INV-06'],
    });
    expect(buildTransaction(transfer, between({ ...bank, archivedAt: 1 }, cash), today)).toEqual({
      ok: false,
      errors: ['INV-06'],
    });
  });
});
