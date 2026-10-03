import { predefinedCategoryId } from '@luka/domain';
import { transactions } from '@luka/schema-sqlite';
import {
  createAccount,
  listAccounts,
  listActiveAccounts,
  setAccountArchived,
  updateAccount,
} from '../src/db/accounts';
import { seedPredefinedCategories, setCategoryArchived } from '../src/db/categories';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import {
  createTransaction,
  getTransaction,
  lastTransferDestination,
  lastUsedAccountId,
  listRecentTransactions,
  topCategories,
  transactionValues,
  transferSavedMessage,
  updateTransaction,
} from '../src/db/transactions';
import { balanceText } from '../src/ui/money';
import { insertRow, restore, softDelete, type WriteContext } from '../src/db/write';

const userId = '0199a6f0-0000-7000-8000-000000000001';
const BOGOTA = 'America/Bogota';
const id = (key: string) => predefinedCategoryId(userId, key);

async function context(start?: number): Promise<WriteContext> {
  const ctx = { db: await createTestDb(), userId, clock: testClock(start), random: testRandom() };
  seedPredefinedCategories(ctx);
  return ctx;
}

function account(ctx: WriteContext, name = 'Efectivo', currency: 'COP' | 'USD' = 'COP'): string {
  const result = createAccount(ctx, {
    name,
    type: 'cash',
    currency,
    openingAmountMinor: 120_000_00,
    icon: '💵',
    color: 'green',
  });
  if (!result.ok) throw new Error(result.errors.join());
  return result.id;
}

const expense = (accountId: string, categoryId: string | null) => ({
  kind: 'expense' as const,
  amountMinor: 12_500_00,
  accountId,
  categoryId,
  occurredOn: '2026-10-01',
});

describe('HU-03 registrar un gasto o ingreso', () => {
  it('HU-03 el monto se guarda como entero en la unidad menor, con signo, moneda de la cuenta y origen manual', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const result = createTransaction(ctx, expense(cash, id('food.groceries')), BOGOTA);
    expect(result.ok).toBe(true);
    expect(ctx.db.select().from(transactions).all()).toEqual([
      expect.objectContaining({
        amountMinor: -12_500_00,
        currency: 'COP',
        kind: 'expense',
        categoryId: id('food.groceries'),
        categorySource: 'user',
        source: 'manual',
        reviewStatus: 'confirmed',
        occurredOn: '2026-10-01',
        version: 0,
      }),
    ]);
  });

  it('HU-03 a las 21:00 en Bogotá, «hoy» es la fecha de Bogotá: no se puede registrar el día siguiente', async () => {
    // 1 de octubre de 2026, 21:00 en Bogotá = 2 de octubre, 02:00 UTC.
    const ctx = await context(Date.UTC(2026, 9, 2, 2, 0));
    const cash = account(ctx);
    expect(
      createTransaction(ctx, { ...expense(cash, null), occurredOn: '2026-10-01' }, BOGOTA).ok,
    ).toBe(true);
    expect(
      createTransaction(ctx, { ...expense(cash, null), occurredOn: '2026-10-02' }, BOGOTA),
    ).toEqual({
      ok: false,
      errors: ['date_in_future'],
    });
  });
});

describe('última cuenta usada', () => {
  it('es la del movimiento más reciente; si está archivada, la primera activa; sin cuentas, ninguna', async () => {
    const ctx = await context();
    expect(lastUsedAccountId(ctx.db)).toBeNull();
    const cash = account(ctx);
    const bank = account(ctx, 'Banco');
    expect(lastUsedAccountId(ctx.db)).toBe(cash);
    createTransaction(ctx, expense(bank, null), BOGOTA);
    expect(lastUsedAccountId(ctx.db)).toBe(bank);
    setAccountArchived(ctx, bank, true);
    expect(lastUsedAccountId(ctx.db)).toBe(cash);
  });
});

describe('categorías más usadas', () => {
  it('sin historial: la lista fija, y una subcategoría «General» se muestra con el nombre de su principal', async () => {
    const ctx = await context();
    expect(topCategories(ctx.db, userId, 'expense').map((c) => c.label)).toEqual([
      'Supermercado',
      'Restaurantes',
      'Transporte público',
      'Taxi y apps',
      'Domicilios',
      'Energía',
    ]);
    const income = topCategories(ctx.db, userId, 'income');
    expect(income.map((c) => c.label)).toEqual([
      'Salario',
      'Honorarios',
      'Negocio y ventas',
      'Rendimientos',
      'Reembolsos',
      'Otros ingresos',
    ]);
    expect(income[0]).toMatchObject({ id: id('salary.other'), accessibilityLabel: 'Salario' });
  });

  it('VoiceOver lee la subcategoría y su principal', async () => {
    const ctx = await context();
    expect(topCategories(ctx.db, userId, 'expense')[0]).toMatchObject({
      id: id('food.groceries'),
      label: 'Supermercado',
      accessibilityLabel: 'Supermercado, Alimentación',
    });
  });

  it('ordena por movimientos confirmados, desempata por el más reciente y luego por la lista fija; sin archivadas', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const pharmacy = id('health.pharmacy');
    const fuel = id('transport.fuel');
    const coffee = id('food.coffee_snacks');
    createTransaction(ctx, expense(cash, coffee), BOGOTA);
    for (const category of [pharmacy, pharmacy, fuel])
      createTransaction(ctx, expense(cash, category), BOGOTA);
    (ctx.clock as ReturnType<typeof testClock>).advance(60_000);
    createTransaction(ctx, expense(cash, fuel), BOGOTA);
    // Los eliminados y los «por revisar» no cuentan.
    const deleted = createTransaction(ctx, expense(cash, coffee), BOGOTA);
    if (deleted.ok) softDelete(ctx, transactions, deleted.id);
    insertRow(ctx, transactions, {
      ...expense(cash, coffee),
      amountMinor: -1,
      currency: 'COP',
      reviewStatus: 'pending_review',
    });
    setCategoryArchived(ctx, id('food.restaurants'), true);
    expect(topCategories(ctx.db, userId, 'expense').map((c) => c.label)).toEqual([
      'Combustible',
      'Farmacia',
      'Café y snacks',
      'Supermercado',
      'Transporte público',
      'Taxi y apps',
    ]);
  });
});

describe('HU-02 transferencias (CU-06)', () => {
  const transfer = (
    accountId: string,
    toAccountId: string,
    amountMinor: number,
    toAmountMinor: number | null = null,
  ) => ({
    kind: 'transfer' as const,
    amountMinor,
    accountId,
    toAccountId,
    toAmountMinor,
    occurredOn: '2026-10-01',
  });
  const balance = (ctx: WriteContext, accountId: string) =>
    listActiveAccounts(ctx.db).find((a) => a.id === accountId)?.balanceMinor;

  it('HU-02 guarda origen y destino sin categoría; con la misma moneda los dos saldos cambian lo mismo', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const savings = account(ctx, 'Ahorro');
    expect(createTransaction(ctx, transfer(savings, cash, 50_000_00), BOGOTA).ok).toBe(true);
    expect(ctx.db.select().from(transactions).all()).toEqual([
      expect.objectContaining({
        kind: 'transfer',
        accountId: savings,
        toAccountId: cash,
        amountMinor: -50_000_00,
        toAmountMinor: 50_000_00,
        categoryId: null,
        currency: 'COP',
      }),
    ]);
    expect(balance(ctx, savings)).toBe(70_000_00);
    expect(balance(ctx, cash)).toBe(170_000_00);
  });

  it('HU-02 de COP a USD cada saldo cambia en su propia moneda', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const dollars = account(ctx, 'Dolares', 'USD');
    expect(createTransaction(ctx, transfer(cash, dollars, 100_000_00, 25_00), BOGOTA).ok).toBe(
      true,
    );
    expect(balance(ctx, cash)).toBe(20_000_00);
    expect(balance(ctx, dollars)).toBe(120_025_00);
    expect(balanceText('cash', balance(ctx, cash) ?? 0, 'COP')).toBe('$ 20.000');
    expect(balanceText('cash', balance(ctx, dollars) ?? 0, 'USD')).toBe('US$ 120.025,00');
  });

  it('HU-02 con monedas distintas y sin monto de llegada no se guarda nada', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const dollars = account(ctx, 'Dolares', 'USD');
    expect(createTransaction(ctx, transfer(cash, dollars, 100_000_00), BOGOTA)).toEqual({
      ok: false,
      errors: ['to_amount_not_positive'],
    });
    expect(ctx.db.select().from(transactions).all()).toEqual([]);
  });

  it('HU-02 INV-02 sin cuenta de destino válida no se guarda nada', async () => {
    const ctx = await context();
    const cash = account(ctx);
    expect(createTransaction(ctx, transfer(cash, 'no-existe', 1_00), BOGOTA)).toEqual({
      ok: false,
      errors: ['INV-02'],
    });
  });

  it('HU-02 pagar 200.000 a una tarjeta con deuda de 500.000 deja «Debes $ 300.000»; pagar de más deja «A favor»', async () => {
    const ctx = await context();
    const savings = account(ctx, 'Ahorro');
    const card = createAccount(ctx, {
      name: 'Visa',
      type: 'credit_card',
      currency: 'COP',
      openingAmountMinor: 500_000_00,
      icon: '💳',
      color: 'red',
    });
    if (!card.ok) throw new Error(card.errors.join());
    createTransaction(ctx, transfer(savings, card.id, 200_000_00), BOGOTA);
    expect(balanceText('credit_card', balance(ctx, card.id) ?? 0, 'COP')).toBe('Debes $ 300.000');
    createTransaction(ctx, transfer(savings, card.id, 350_000_00), BOGOTA);
    expect(balanceText('credit_card', balance(ctx, card.id) ?? 0, 'COP')).toBe('A favor $ 50.000');
  });

  it('HU-02 el destino por defecto es el de la última transferencia; ignora archivadas y el origen', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const savings = account(ctx, 'Ahorro');
    const bank = account(ctx, 'Banco');
    // Sin transferencias: la primera cuenta activa distinta del origen.
    expect(lastTransferDestination(ctx.db, cash)).toBe(savings);
    expect(lastTransferDestination(ctx.db, savings)).toBe(cash);
    createTransaction(ctx, transfer(cash, bank, 1_00), BOGOTA);
    expect(lastTransferDestination(ctx.db, cash)).toBe(bank);
    // Si el último destino es el origen elegido ahora, no se ofrece.
    expect(lastTransferDestination(ctx.db, bank)).toBe(cash);
    setAccountArchived(ctx, bank, true);
    expect(lastTransferDestination(ctx.db, cash)).toBe(savings);
  });

  it('HU-02 con una sola cuenta activa no hay destino', async () => {
    const ctx = await context();
    const cash = account(ctx);
    expect(lastTransferDestination(ctx.db, cash)).toBeNull();
  });

  it('HU-02 el aviso dice cuánto sale, de qué cuenta a cuál y, con otra moneda, cuánto llega', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const savings = account(ctx, 'Ahorro');
    const dollars = account(ctx, 'Dolares', 'USD');
    expect(transferSavedMessage(ctx.db, transfer(savings, cash, 50_000_00, 50_000_00))).toBe(
      'Transferencia guardada: $ 50.000 de Ahorro a Efectivo',
    );
    expect(transferSavedMessage(ctx.db, transfer(cash, dollars, 100_000_00, 25_00))).toBe(
      'Transferencia guardada: $ 100.000 de Efectivo a Dolares (llegan US$ 25,00)',
    );
  });
});

describe('HU-04 editar, eliminar y deshacer (CU-09)', () => {
  const created = (result: ReturnType<typeof createTransaction>) => {
    if (!result.ok) throw new Error(result.errors.join());
    return result.id;
  };
  const balanceOf = (ctx: WriteContext, accountId: string) =>
    listAccounts(ctx.db, { includeArchived: true }).find((a) => a.id === accountId)?.balanceMinor;
  const advance = (ctx: WriteContext, ms = 60_000) =>
    (ctx.clock as ReturnType<typeof testClock>).advance(ms);

  it('HU-04 editar monto, cuenta, categoría, fecha y nota guarda los cambios y recalcula los dos saldos', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const savings = account(ctx, 'Ahorro');
    const tx = created(createTransaction(ctx, expense(cash, id('food.groceries')), BOGOTA));
    expect(balanceOf(ctx, cash)).toBe(107_500_00);
    expect(
      updateTransaction(
        ctx,
        tx,
        {
          kind: 'expense',
          amountMinor: 20_000_00,
          accountId: savings,
          categoryId: id('food.restaurants'),
          occurredOn: '2026-09-30',
          note: 'Almuerzo',
        },
        BOGOTA,
      ),
    ).toEqual({ ok: true, id: tx });
    expect(getTransaction(ctx.db, tx)).toEqual(
      expect.objectContaining({
        amountMinor: -20_000_00,
        accountId: savings,
        categoryId: id('food.restaurants'),
        occurredOn: '2026-09-30',
        note: 'Almuerzo',
      }),
    );
    expect(balanceOf(ctx, cash)).toBe(120_000_00);
    expect(balanceOf(ctx, savings)).toBe(100_000_00);
  });

  it('HU-04 editar no cambia version: lo editado en H1 sigue pendiente de subir para T-029', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const tx = created(createTransaction(ctx, expense(cash, null), BOGOTA));
    const before = getTransaction(ctx.db, tx);
    advance(ctx);
    updateTransaction(ctx, tx, { ...expense(cash, null), amountMinor: 1_00, note: '' }, BOGOTA);
    const after = getTransaction(ctx.db, tx);
    expect(after?.version).toBe(0);
    expect(after?.createdAt).toEqual(before?.createdAt);
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);
  });

  it('HU-04 editar una transferencia cambia los dos saldos; con un destino de otra moneda el monto de llegada vuelve a ser obligatorio', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const savings = account(ctx, 'Ahorro');
    const dollars = account(ctx, 'Dolares', 'USD');
    const base = {
      kind: 'transfer' as const,
      amountMinor: 50_000_00,
      accountId: savings,
      toAccountId: cash,
      toAmountMinor: null,
      occurredOn: '2026-10-01',
    };
    const tx = created(createTransaction(ctx, base, BOGOTA));
    updateTransaction(ctx, tx, { ...base, amountMinor: 30_000_00, note: '' }, BOGOTA);
    expect(balanceOf(ctx, savings)).toBe(90_000_00);
    expect(balanceOf(ctx, cash)).toBe(150_000_00);

    expect(updateTransaction(ctx, tx, { ...base, toAccountId: dollars, note: '' }, BOGOTA)).toEqual(
      {
        ok: false,
        errors: ['to_amount_not_positive'],
      },
    );
    updateTransaction(
      ctx,
      tx,
      { ...base, toAccountId: dollars, toAmountMinor: 10_00, note: '' },
      BOGOTA,
    );
    expect(balanceOf(ctx, savings)).toBe(70_000_00);
    expect(balanceOf(ctx, cash)).toBe(120_000_00);
    expect(balanceOf(ctx, dollars)).toBe(120_010_00);
  });

  it('HU-04 al pasar de gasto a ingreso, una categoría de gasto se rechaza (INV-04)', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const tx = created(createTransaction(ctx, expense(cash, id('food.groceries')), BOGOTA));
    expect(
      updateTransaction(
        ctx,
        tx,
        { ...expense(cash, id('food.groceries')), kind: 'income', note: '' },
        BOGOTA,
      ),
    ).toEqual({ ok: false, errors: ['INV-04'] });
    expect(
      updateTransaction(
        ctx,
        tx,
        { ...expense(cash, id('salary.other')), kind: 'income', note: '' },
        BOGOTA,
      ).ok,
    ).toBe(true);
    expect(getTransaction(ctx.db, tx)?.amountMinor).toBe(12_500_00);
  });

  it('HU-04 un movimiento borrado no cuenta en saldos, Recientes, categorías más usadas, última cuenta ni último destino; Deshacer lo devuelve', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const savings = account(ctx, 'Ahorro');
    const bank = account(ctx, 'Banco');
    created(
      createTransaction(
        ctx,
        {
          kind: 'transfer',
          amountMinor: 1_00,
          accountId: cash,
          toAccountId: savings,
          toAmountMinor: null,
          occurredOn: '2026-10-01',
        },
        BOGOTA,
      ),
    );
    advance(ctx);
    const tx = created(createTransaction(ctx, expense(bank, id('health.pharmacy')), BOGOTA));
    advance(ctx);
    const transfer = created(
      createTransaction(
        ctx,
        {
          kind: 'transfer',
          amountMinor: 2_00,
          accountId: cash,
          toAccountId: bank,
          toAmountMinor: null,
          occurredOn: '2026-10-01',
        },
        BOGOTA,
      ),
    );
    const visible = () => ({
      recent: listRecentTransactions(ctx.db, userId).map((r) => r.id),
      top: topCategories(ctx.db, userId, 'expense')[0]?.id,
      bank: balanceOf(ctx, bank),
    });
    expect(visible()).toEqual({
      recent: [transfer, tx, expect.any(String)],
      top: id('health.pharmacy'),
      bank: 107_502_00,
    });

    softDelete(ctx, transactions, tx);
    softDelete(ctx, transactions, transfer);
    expect(getTransaction(ctx.db, tx)?.deletedAt).not.toBeNull();
    expect(visible()).toEqual({
      recent: [expect.any(String)],
      top: id('food.groceries'),
      bank: 120_000_00,
    });
    expect(lastUsedAccountId(ctx.db)).toBe(cash);
    expect(lastTransferDestination(ctx.db, cash)).toBe(savings);

    restore(ctx, transactions, tx);
    restore(ctx, transactions, transfer);
    expect(visible()).toEqual({
      recent: [transfer, tx, expect.any(String)],
      top: id('health.pharmacy'),
      bank: 107_502_00,
    });
  });

  it('HU-04 Deshacer restaura aunque la cuenta o la categoría se haya archivado entretanto', async () => {
    const ctx = await context();
    const cash = account(ctx);
    account(ctx, 'Ahorro');
    const tx = created(createTransaction(ctx, expense(cash, id('food.groceries')), BOGOTA));
    softDelete(ctx, transactions, tx);
    setAccountArchived(ctx, cash, true);
    setCategoryArchived(ctx, id('food.groceries'), true);
    restore(ctx, transactions, tx);
    expect(getTransaction(ctx.db, tx)).toEqual(
      expect.objectContaining({
        deletedAt: null,
        accountId: cash,
        categoryId: id('food.groceries'),
      }),
    );
    expect(balanceOf(ctx, cash)).toBe(107_500_00);
  });

  it('HU-04 INV-05 la moneda de una cuenta sigue bloqueada aunque sus movimientos estén borrados', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const tx = created(createTransaction(ctx, expense(cash, null), BOGOTA));
    softDelete(ctx, transactions, tx);
    expect(
      updateAccount(ctx, cash, {
        name: 'Efectivo',
        type: 'cash',
        currency: 'USD',
        openingAmountMinor: 120_000_00,
        icon: '💵',
        color: 'green',
      }),
    ).toEqual({ ok: false, errors: ['currency_locked'] });
  });

  it('HU-04 INV-06 un movimiento de una cuenta archivada sigue editable sin moverlo; no se puede pasar a una archivada', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const savings = account(ctx, 'Ahorro');
    const tx = created(createTransaction(ctx, expense(cash, null), BOGOTA));
    setAccountArchived(ctx, cash, true);
    expect(
      updateTransaction(
        ctx,
        tx,
        { ...expense(cash, null), amountMinor: 5_000_00, note: '' },
        BOGOTA,
      ).ok,
    ).toBe(true);
    const other = created(createTransaction(ctx, expense(savings, null), BOGOTA));
    expect(updateTransaction(ctx, other, { ...expense(cash, null), note: '' }, BOGOTA)).toEqual({
      ok: false,
      errors: ['INV-06'],
    });
  });

  it('HU-04 Recientes: los últimos 5 confirmados y no borrados, del más reciente al más antiguo', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const ids: string[] = [];
    for (const day of [
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]) {
      ids.push(
        created(createTransaction(ctx, { ...expense(cash, null), occurredOn: day }, BOGOTA)),
      );
      advance(ctx);
    }
    // Uno por revisar (V2) no aparece.
    insertRow(ctx, transactions, {
      kind: 'expense',
      amountMinor: -1_00,
      accountId: cash,
      currency: 'COP',
      occurredOn: '2026-10-01',
      categorySource: 'user',
      source: 'manual',
      reviewStatus: 'pending_review',
    });
    softDelete(ctx, transactions, ids[5] ?? '');
    expect(listRecentTransactions(ctx.db, userId).map((r) => r.occurredOn)).toEqual([
      '2026-09-29',
      '2026-09-28',
      '2026-09-27',
      '2026-09-26',
      '2026-09-25',
    ]);
  });

  it('HU-04 transactionValues devuelve el movimiento con el monto en positivo para el formulario', async () => {
    const ctx = await context();
    const cash = account(ctx);
    const tx = created(
      createTransaction(ctx, { ...expense(cash, id('food.groceries')), note: 'Mercado' }, BOGOTA),
    );
    const row = getTransaction(ctx.db, tx);
    expect(row && transactionValues(row)).toEqual({
      kind: 'expense',
      amountMinor: 12_500_00,
      accountId: cash,
      categoryId: id('food.groceries'),
      occurredOn: '2026-10-01',
      note: 'Mercado',
    });
  });
});
