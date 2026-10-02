import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import {
  type AccountRef,
  type CategoryRef,
  type NewTransaction,
  type TransactionContext,
  checkAccountCurrencyChange,
  checkCategoryDelete,
  checkNewTransaction,
} from './invariants.js';
import { applySign } from './money.js';

const cash: AccountRef = { id: 'a1', currency: 'COP', archivedAt: null };
const bank: AccountRef = { id: 'a2', currency: 'COP', archivedAt: null };
const dollars: AccountRef = { id: 'a3', currency: 'USD', archivedAt: null };
const groceries: CategoryRef = { kind: 'expense', systemKey: 'food.groceries' };
const salary: CategoryRef = { kind: 'income', systemKey: 'salary' };

const expense = (patch: Partial<NewTransaction> = {}): NewTransaction => ({
  kind: 'expense',
  amountMinor: -1_250_000,
  toAmountMinor: null,
  accountId: cash.id,
  toAccountId: null,
  currency: 'COP',
  categoryId: 'c1',
  ...patch,
});
const transfer = (patch: Partial<NewTransaction> = {}): NewTransaction =>
  expense({
    kind: 'transfer',
    toAccountId: bank.id,
    toAmountMinor: 1_250_000,
    categoryId: null,
    ...patch,
  });

const ctx = (patch: Partial<TransactionContext> = {}): TransactionContext => ({
  account: cash,
  toAccount: null,
  category: groceries,
  ...patch,
});

describe('checkNewTransaction', () => {
  it('acepta un gasto, un ingreso, una transferencia y un ajuste válidos', () => {
    expect(checkNewTransaction(expense(), ctx())).toEqual([]);
    expect(
      checkNewTransaction(expense({ kind: 'income', amountMinor: 500 }), ctx({ category: salary })),
    ).toEqual([]);
    expect(checkNewTransaction(transfer(), ctx({ category: null, toAccount: bank }))).toEqual([]);
    expect(
      checkNewTransaction(
        expense({ kind: 'adjustment', amountMinor: 300, categoryId: null }),
        ctx({ category: null }),
      ),
    ).toEqual([]);
  });

  it('INV-01 rechaza montos en cero, con decimales o con el signo contrario al tipo', () => {
    expect(checkNewTransaction(expense({ amountMinor: 0 }), ctx())).toEqual(['INV-01']);
    expect(checkNewTransaction(expense({ amountMinor: -12.5 }), ctx())).toEqual(['INV-01']);
    expect(checkNewTransaction(expense({ amountMinor: 500 }), ctx())).toEqual(['INV-01']);
    expect(
      checkNewTransaction(
        expense({ kind: 'income', amountMinor: -500 }),
        ctx({ category: salary }),
      ),
    ).toEqual(['INV-01']);
    expect(
      checkNewTransaction(
        transfer({ amountMinor: 1_250_000 }),
        ctx({ category: null, toAccount: bank }),
      ),
    ).toEqual(['INV-01', 'INV-03']);
  });

  it('INV-01 propiedad: un monto positivo con el signo aplicado por su tipo siempre es válido', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('expense' as const, 'income' as const),
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (kind, typed) => {
          const tx = expense({ kind, amountMinor: applySign(kind, typed) });
          const category = kind === 'income' ? salary : groceries;
          expect(checkNewTransaction(tx, ctx({ category }))).toEqual([]);
        },
      ),
    );
  });

  it('INV-02 una transferencia exige otra cuenta de destino y monto de destino positivo', () => {
    const c = ctx({ category: null, toAccount: bank });
    expect(checkNewTransaction(transfer({ toAccountId: null }), c)).toContain('INV-02');
    expect(checkNewTransaction(transfer({ toAccountId: cash.id }), c)).toContain('INV-02');
    expect(checkNewTransaction(transfer({ toAmountMinor: null }), c)).toContain('INV-02');
    expect(checkNewTransaction(transfer({ toAmountMinor: -1_250_000 }), c)).toContain('INV-02');
  });

  it('INV-02 los demás tipos dejan nulos la cuenta y el monto de destino', () => {
    expect(checkNewTransaction(expense({ toAccountId: bank.id }), ctx())).toEqual(['INV-02']);
    expect(checkNewTransaction(expense({ toAmountMinor: 500 }), ctx())).toEqual(['INV-02']);
  });

  it('INV-03 con la misma moneda el destino recibe exactamente lo que sale del origen', () => {
    const c = ctx({ category: null, toAccount: bank });
    expect(checkNewTransaction(transfer({ toAmountMinor: 1_000_000 }), c)).toEqual(['INV-03']);
    // Con monedas distintas el monto de destino es libre.
    expect(
      checkNewTransaction(
        transfer({ toAccountId: dollars.id, toAmountMinor: 31_250 }),
        ctx({ category: null, toAccount: dollars }),
      ),
    ).toEqual([]);
  });

  it('INV-04 la categoría coincide con el tipo y transferencias y ajustes no llevan categoría', () => {
    expect(checkNewTransaction(expense(), ctx({ category: salary }))).toEqual(['INV-04']);
    expect(
      checkNewTransaction(transfer({ categoryId: 'c1' }), ctx({ category: null, toAccount: bank })),
    ).toEqual(['INV-04']);
    // Un gasto puede quedar sin categoría hasta que se asigne.
    expect(checkNewTransaction(expense({ categoryId: null }), ctx({ category: null }))).toEqual([]);
  });

  it('INV-05 la moneda del movimiento es la de su cuenta', () => {
    expect(checkNewTransaction(expense({ currency: 'USD' }), ctx())).toEqual(['INV-05']);
  });

  it('INV-06 una cuenta archivada, de origen o de destino, no acepta movimientos nuevos', () => {
    const archived = { ...bank, archivedAt: 1 };
    expect(checkNewTransaction(expense(), ctx({ account: { ...cash, archivedAt: 1 } }))).toEqual([
      'INV-06',
    ]);
    expect(checkNewTransaction(transfer(), ctx({ category: null, toAccount: archived }))).toEqual([
      'INV-06',
    ]);
  });
});

describe('checkAccountCurrencyChange', () => {
  it('INV-05 la moneda de una cuenta con movimientos no cambia', () => {
    expect(checkAccountCurrencyChange('COP', 'USD', true)).toEqual(['INV-05']);
    expect(checkAccountCurrencyChange('COP', 'USD', false)).toEqual([]);
    expect(checkAccountCurrencyChange('COP', 'COP', true)).toEqual([]);
  });
});

describe('checkCategoryDelete', () => {
  it('INV-07 las categorías predefinidas no se eliminan', () => {
    expect(checkCategoryDelete(groceries)).toEqual(['INV-07']);
    expect(checkCategoryDelete({ kind: 'expense', systemKey: null })).toEqual([]);
  });
});
