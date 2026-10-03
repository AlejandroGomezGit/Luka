/**
 * Movimientos: registrar un gasto, ingreso (HU-03, CU-08) o transferencia (CU-06), editarlos (HU-04,
 * CU-09) y las ayudas del formulario. Borrar y deshacer usan softDelete y restore de write.ts.
 */
import {
  type AccountRef,
  buildTransaction,
  type CategoryKind,
  containsPattern,
  editContext,
  type CurrencyCode,
  formatMoney,
  generalCategoryId,
  normalizeText,
  predefinedCategoryId,
  tagErrors,
  today,
  type TransactionContext,
  type TransactionInput,
  type TransactionInputError,
} from '@luka/domain';
import {
  accounts,
  attachments,
  categories,
  transactions,
  transactionSearch,
} from '@luka/schema-sqlite';
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { type AccountRow, getAccount, listActiveAccounts } from './accounts';
import { type ReceiptFile, setReceipt } from './attachments';
import { getCategory } from './categories';
import type { LocalDb } from './types';
import { insertRow, notDeleted, restore, softDelete, updateRow, type WriteContext } from './write';

export type TransactionResult =
  { ok: true; id: string } | { ok: false; errors: TransactionInputError[] };

export type TransactionRow = typeof transactions.$inferSelect;

/**
 * Lo que guarda el formulario además del movimiento: nota, etiquetas y foto del recibo (HU-06). Sin
 * `receipt` la foto no cambia; con null se quita.
 */
export interface TransactionExtras {
  note?: string;
  tags?: string[];
  receipt?: ReceiptFile | null;
}

/** Lo que escribe la persona en el formulario: el movimiento con el monto en positivo, nota y etiquetas. */
export type TransactionValues = TransactionInput & { note: string; tags: string[] } & Pick<
    TransactionExtras,
    'receipt'
  >;

const accountRef = (account: AccountRow): AccountRef => ({
  id: account.id,
  currency: account.currency as CurrencyCode,
  archivedAt: account.archivedAt?.getTime() ?? null,
});

/** Lee de la base lo que las invariantes necesitan: cuentas de origen y destino, y categoría. */
function contextFor(
  db: LocalDb,
  input: TransactionInput,
): { ok: true; ctx: TransactionContext } | { ok: false; errors: TransactionInputError[] } {
  const account = getAccount(db, input.accountId);
  if (!account) return { ok: false, errors: ['INV-06'] };
  const toAccount = input.kind === 'transfer' ? getAccount(db, input.toAccountId) : undefined;
  if (input.kind === 'transfer' && !toAccount) return { ok: false, errors: ['INV-02'] };
  const categoryId = input.kind === 'transfer' ? null : input.categoryId;
  const category = categoryId ? getCategory(db, categoryId) : undefined;
  return {
    ok: true,
    ctx: {
      account: accountRef(account),
      toAccount: toAccount ? accountRef(toAccount) : null,
      category: category
        ? { kind: category.kind, systemKey: category.systemKey, parentId: category.parentId }
        : null,
    },
  };
}

const cleanNote = (note: string | undefined) => (note?.trim() ? note.trim() : null);

export function getTransaction(db: LocalDb, id: string): TransactionRow | undefined {
  return db.select().from(transactions).where(eq(transactions.id, id)).get();
}

/**
 * Guarda un movimiento escrito por la persona: origen manual, categoría puesta por la persona y
 * confirmado. «Hoy» sale del reloj inyectado en la zona horaria del dispositivo.
 */
export function createTransaction(
  ctx: WriteContext,
  input: TransactionInput & TransactionExtras,
  timeZone: string,
): TransactionResult {
  const tags = input.tags ?? [];
  const invalidTags = tagErrors(tags);
  if (invalidTags.length > 0) return { ok: false, errors: invalidTags };
  const read = contextFor(ctx.db, input);
  if (!read.ok) return read;
  const result = buildTransaction(input, read.ctx, today(ctx.clock, timeZone));
  if (!result.ok) return result;
  const note = cleanNote(input.note);
  const id = ctx.db.transaction((tx) => {
    const newId = insertRow({ ...ctx, db: tx }, transactions, {
      ...result.transaction,
      occurredOn: input.occurredOn,
      note,
      tags,
      categorySource: 'user',
      source: 'manual',
      reviewStatus: 'confirmed',
    });
    writeSearch(tx, newId, note, null, tags);
    if (input.receipt) setReceipt({ ...ctx, db: tx }, newId, input.receipt);
    return newId;
  });
  return { ok: true, id };
}

/**
 * Edita un movimiento (HU-04, CU-09) con las mismas reglas que al crearlo, salvo que puede seguir en una
 * cuenta que se archivó después (editContext, INV-06). Una transferencia sigue siendo transferencia y un
 * gasto o ingreso no se convierte en ella. `version` no cambia: queda pendiente para T-029.
 */
export function updateTransaction(
  ctx: WriteContext,
  id: string,
  input: TransactionInput & TransactionExtras,
  timeZone: string,
): TransactionResult {
  const existing = getTransaction(ctx.db, id);
  if (!existing || (existing.kind === 'transfer') !== (input.kind === 'transfer')) {
    throw new Error(
      'Solo se edita un movimiento existente, sin convertirlo en transferencia ni al revés',
    );
  }
  const tags = input.tags ?? existing.tags;
  const invalidTags = tagErrors(tags);
  if (invalidTags.length > 0) return { ok: false, errors: invalidTags };
  const read = contextFor(ctx.db, input);
  if (!read.ok) return read;
  const result = buildTransaction(
    input,
    editContext(read.ctx, { accountId: existing.accountId, toAccountId: existing.toAccountId }),
    today(ctx.clock, timeZone),
  );
  if (!result.ok) return result;
  const note = cleanNote(input.note);
  ctx.db.transaction((tx) => {
    updateRow({ ...ctx, db: tx }, transactions, id, {
      ...result.transaction,
      occurredOn: input.occurredOn,
      note,
      tags,
    });
    writeSearch(tx, id, note, existing.merchant, tags);
    if (input.receipt !== undefined) setReceipt({ ...ctx, db: tx }, id, input.receipt);
  });
  return { ok: true, id };
}

/** Valores del formulario para editar un movimiento: el monto en positivo, como lo escribe la persona. */
export function transactionValues(row: TransactionRow): TransactionValues {
  const base = {
    amountMinor: Math.abs(row.amountMinor),
    accountId: row.accountId,
    occurredOn: row.occurredOn,
    note: row.note ?? '',
    tags: row.tags,
  };
  return row.kind === 'transfer' && row.toAccountId
    ? { kind: 'transfer', ...base, toAccountId: row.toAccountId, toAmountMinor: row.toAmountMinor }
    : { kind: row.kind === 'income' ? 'income' : 'expense', ...base, categoryId: row.categoryId };
}

/** Un movimiento como lo muestra la lista: montos, cuentas, categoría y fecha. */
export interface TransactionListItem {
  id: string;
  kind: TransactionRow['kind'];
  amountMinor: number;
  currency: CurrencyCode;
  toAmountMinor: number | null;
  toCurrency: CurrencyCode | null;
  occurredOn: string;
  accountName: string;
  toAccountName: string | null;
  category: Pick<TopCategory, 'label' | 'accessibilityLabel' | 'icon' | 'color'> | null;
}

/**
 * Texto de búsqueda de un movimiento (HU-05, HU-06): nota, comercio y etiquetas normalizados en
 * `transaction_search`, una tabla derivada y solo local que no pasa por write.ts porque nunca se
 * sincroniza.
 */
function writeSearch(
  db: LocalDb,
  id: string,
  note: string | null,
  merchant: string | null,
  tags: readonly string[],
) {
  const content = normalizeText([note, merchant, ...tags].filter(Boolean).join(' '));
  db.insert(transactionSearch)
    .values({ transactionId: id, content })
    .onConflictDoUpdate({ target: transactionSearch.transactionId, set: { content } })
    .run();
}

/**
 * Completa el texto de búsqueda de hasta `limit` movimientos que no lo tienen (los anteriores a la
 * migración 0002 o los que lleguen sin él) y devuelve cuántos completó. Idempotente.
 */
export function backfillTransactionSearch(db: LocalDb, limit = Number.MAX_SAFE_INTEGER): number {
  const missing = db
    .select({
      id: transactions.id,
      note: transactions.note,
      merchant: transactions.merchant,
      tags: transactions.tags,
    })
    .from(transactions)
    .leftJoin(transactionSearch, eq(transactionSearch.transactionId, transactions.id))
    .where(isNull(transactionSearch.transactionId))
    .limit(limit)
    .all();
  if (missing.length === 0) return 0;
  db.transaction((tx) => {
    for (const row of missing) writeSearch(tx, row.id, row.note, row.merchant, row.tags);
  });
  return missing.length;
}

/**
 * Corre el relleno en cada arranque por lotes y después del primer render (regla de tablas derivadas de
 * CLAUDE.md, DT-06): cada lote se agenda aparte para no bloquear la pantalla.
 */
export function fillSearchInBackground(
  db: LocalDb,
  schedule: (task: () => void) => void = (task) => setTimeout(task, 0),
  batch = 500,
): void {
  const step = () => {
    if (backfillTransactionSearch(db, batch) === batch) schedule(step);
  };
  schedule(step);
}

/**
 * Borrado lógico de un movimiento y de su foto en el mismo instante (HU-04, HU-06): así Deshacer devuelve
 * justo lo que se borró aquí, y no una foto que se había quitado antes.
 */
export function deleteTransaction(ctx: WriteContext, id: string): void {
  const now = ctx.clock.now();
  const at = { ...ctx, clock: { now: () => now } };
  ctx.db.transaction((tx) => {
    softDelete({ ...at, db: tx }, transactions, id);
    for (const { id: attachmentId } of tx
      .select({ id: attachments.id })
      .from(attachments)
      .where(and(eq(attachments.transactionId, id), isNull(attachments.deletedAt)))
      .all()) {
      softDelete({ ...at, db: tx }, attachments, attachmentId);
    }
  });
}

/** Deshace deleteTransaction: el movimiento y lo que se borró con él. */
export function restoreTransaction(ctx: WriteContext, id: string): void {
  const deletedAt = getTransaction(ctx.db, id)?.deletedAt;
  if (!deletedAt) return;
  ctx.db.transaction((tx) => {
    restore({ ...ctx, db: tx }, transactions, id);
    for (const { id: attachmentId } of tx
      .select({ id: attachments.id })
      .from(attachments)
      .where(and(eq(attachments.transactionId, id), eq(attachments.deletedAt, deletedAt)))
      .all()) {
      restore({ ...ctx, db: tx }, attachments, attachmentId);
    }
  });
}

/** Filtros de la lista de movimientos (HU-05); todos se combinan. */
export interface TransactionFilters {
  kind?: 'expense' | 'income' | 'transfer';
  /** Incluye las transferencias de origen y de destino. */
  accountId?: string;
  /** Una principal incluye sus subcategorías. Las transferencias no tienen categoría. */
  categoryId?: string;
  /** Fechas locales AAAA-MM-DD, extremos incluidos. */
  from?: string;
  to?: string;
  /**
   * Monto en valor absoluto y en una moneda: solo mira movimientos en ella (los de cuentas en esa moneda,
   * INV-05). En transferencias compara el monto que sale.
   */
  amount?: { currency: CurrencyCode; minMinor?: number; maxMinor?: number };
  /** Busca en nota, comercio, categoría (subcategoría o principal) y cuenta, sin tildes ni mayúsculas. */
  text?: string;
}

/** Posición en la lista: fecha e id del último movimiento mostrado. */
export interface ListCursor {
  occurredOn: string;
  id: string;
}

/** Ids de cuentas y categorías cuyo nombre contiene el texto: entran en la misma consulta SQL. */
function matchingNames(db: LocalDb, text: string) {
  const needle = normalizeText(text);
  const accountIds = db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .all()
    .filter((a) => normalizeText(a.name).includes(needle))
    .map((a) => a.id);
  const rows = db
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
    .from(categories)
    .all();
  const mains = new Set(
    rows
      .filter((c) => c.parentId === null && normalizeText(c.name).includes(needle))
      .map((c) => c.id),
  );
  const categoryIds = rows
    .filter((c) => normalizeText(c.name).includes(needle) || (c.parentId && mains.has(c.parentId)))
    .map((c) => c.id);
  return { accountIds, categoryIds };
}

function whereFor(db: LocalDb, userId: string, filters: TransactionFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    eq(transactions.userId, userId),
    notDeleted(transactions),
    eq(transactions.reviewStatus, 'confirmed'),
  ];
  if (filters.kind) conditions.push(eq(transactions.kind, filters.kind));
  if (filters.accountId) {
    conditions.push(
      or(
        eq(transactions.accountId, filters.accountId),
        eq(transactions.toAccountId, filters.accountId),
      ),
    );
  }
  if (filters.categoryId) {
    const subs = db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, filters.categoryId))
      .all()
      .map((c) => c.id);
    conditions.push(inArray(transactions.categoryId, [filters.categoryId, ...subs]));
  }
  if (filters.from) conditions.push(gte(transactions.occurredOn, filters.from));
  if (filters.to) conditions.push(lte(transactions.occurredOn, filters.to));
  if (filters.amount) {
    const { currency, minMinor, maxMinor } = filters.amount;
    conditions.push(eq(transactions.currency, currency));
    if (minMinor !== undefined)
      conditions.push(sql`abs(${transactions.amountMinor}) >= ${minMinor}`);
    if (maxMinor !== undefined)
      conditions.push(sql`abs(${transactions.amountMinor}) <= ${maxMinor}`);
  }
  const pattern = filters.text ? containsPattern(filters.text) : null;
  if (filters.text && pattern) {
    const { accountIds, categoryIds } = matchingNames(db, filters.text);
    conditions.push(
      or(
        sql`${transactions.id} in (select ${transactionSearch.transactionId} from ${transactionSearch}
          where ${transactionSearch.content} like ${pattern} escape '\\')`,
        categoryIds.length > 0 ? inArray(transactions.categoryId, categoryIds) : undefined,
        accountIds.length > 0 ? inArray(transactions.accountId, accountIds) : undefined,
        accountIds.length > 0 ? inArray(transactions.toAccountId, accountIds) : undefined,
      ),
    );
  }
  return and(...conditions);
}

/**
 * Consulta de una página de la lista: por fecha descendente y, en el mismo día, por id descendente (UUID
 * v7, lo último registrado primero). El cursor usa los dos, así que no repite ni salta movimientos.
 */
export function transactionListQuery(
  db: LocalDb,
  userId: string,
  filters: TransactionFilters,
  cursor: ListCursor | null,
  limit: number,
) {
  const after = cursor
    ? or(
        lt(transactions.occurredOn, cursor.occurredOn),
        and(eq(transactions.occurredOn, cursor.occurredOn), lt(transactions.id, cursor.id)),
      )
    : undefined;
  return db
    .select()
    .from(transactions)
    .where(and(whereFor(db, userId, filters), after))
    .orderBy(desc(transactions.occurredOn), desc(transactions.id))
    .limit(limit);
}

/** Una página de movimientos (HU-05) y el cursor de la siguiente, o null si no hay más. */
export function listTransactions(
  db: LocalDb,
  userId: string,
  filters: TransactionFilters,
  cursor: ListCursor | null,
  limit = 50,
): { items: TransactionListItem[]; nextCursor: ListCursor | null } {
  const rows = transactionListQuery(db, userId, filters, cursor, limit + 1).all();
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const accountsById = new Map(
    db
      .select()
      .from(accounts)
      .all()
      .map((a) => [a.id, a]),
  );
  const categoriesById = new Map(
    db
      .select()
      .from(categories)
      .all()
      .map((c) => [c.id, c]),
  );
  return {
    items: page.map((row) => {
      const account = accountsById.get(row.accountId);
      const toAccount = row.toAccountId ? accountsById.get(row.toAccountId) : undefined;
      const sub = row.categoryId ? categoriesById.get(row.categoryId) : undefined;
      const main = sub?.parentId ? categoriesById.get(sub.parentId) : undefined;
      return {
        id: row.id,
        kind: row.kind,
        amountMinor: row.amountMinor,
        currency: row.currency as CurrencyCode,
        toAmountMinor: row.toAmountMinor,
        toCurrency: (toAccount?.currency ?? null) as CurrencyCode | null,
        occurredOn: row.occurredOn,
        accountName: account?.name ?? '',
        toAccountName: toAccount?.name ?? null,
        category:
          sub && main
            ? { ...categoryLabels(userId, sub, main), icon: sub.icon, color: sub.color }
            : null,
      };
    }),
    nextCursor: rows.length > limit && last ? { occurredOn: last.occurredOn, id: last.id } : null,
  };
}

/** Cuántos movimientos cumplen los filtros: se anuncia al lector de pantalla al filtrar. */
export function countTransactions(
  db: LocalDb,
  userId: string,
  filters: TransactionFilters,
): number {
  return (
    db
      .select({ n: count() })
      .from(transactions)
      .where(whereFor(db, userId, filters))
      .get()?.n ?? 0
  );
}

/** «Recientes» en Inicio (HU-04): los primeros de la lista de movimientos, sin filtros. */
export function listRecentTransactions(
  db: LocalDb,
  userId: string,
  limit = 5,
): TransactionListItem[] {
  return listTransactions(db, userId, {}, null, limit).items;
}

/** La cuenta del movimiento más reciente; si está archivada o no hay movimientos, la primera activa. */
export function lastUsedAccountId(db: LocalDb): string | null {
  const active = listActiveAccounts(db);
  const latest = db
    .select({ accountId: transactions.accountId })
    .from(transactions)
    .where(notDeleted(transactions))
    .orderBy(desc(transactions.createdAt))
    .limit(1)
    .get();
  const used = active.find((account) => account.id === latest?.accountId);
  return used?.id ?? active[0]?.id ?? null;
}

/**
 * Destino por defecto de una transferencia desde `fromId`: el de la última transferencia si sigue activo
 * y no es el origen; si no, la primera cuenta activa distinta del origen. Con una sola cuenta, ninguno.
 */
export function lastTransferDestination(db: LocalDb, fromId: string): string | null {
  const candidates = listActiveAccounts(db).filter((account) => account.id !== fromId);
  const latest = db
    .select({ toAccountId: transactions.toAccountId })
    .from(transactions)
    .where(and(eq(transactions.kind, 'transfer'), notDeleted(transactions)))
    .orderBy(desc(transactions.createdAt))
    .limit(1)
    .get();
  const used = candidates.find((account) => account.id === latest?.toAccountId);
  return used?.id ?? candidates[0]?.id ?? null;
}

export interface TopCategory {
  id: string;
  /** Lo que se ve: la subcategoría, o la principal si es su «General». */
  label: string;
  /** Lo que lee VoiceOver: «Supermercado, Alimentación»; solo la principal si es su «General». */
  accessibilityLabel: string;
  icon: string;
  color: string;
}

/** Sugerencias cuando aún no hay historial, en este orden. */
const SUGGESTED: Record<CategoryKind, readonly string[]> = {
  expense: [
    'food.groceries',
    'food.restaurants',
    'transport.public_transit',
    'transport.taxi_apps',
    'food.delivery',
    'utilities.electricity',
  ],
  income: [
    'salary.other',
    'freelance.other',
    'business.other',
    'investment_income.other',
    'refunds.other',
    'other_income.other',
  ],
};

/** Nombre y lectura de una subcategoría junto a su principal. */
export function categoryLabels(
  userId: string,
  sub: { id: string; name: string },
  main: { id: string; name: string; systemKey: string | null },
): { label: string; accessibilityLabel: string } {
  return sub.id === generalCategoryId(userId, main)
    ? { label: main.name, accessibilityLabel: main.name }
    : { label: sub.name, accessibilityLabel: `${sub.name}, ${main.name}` };
}

/**
 * Las seis subcategorías más usadas de un tipo: por número de movimientos confirmados, desempate por
 * el uso más reciente y luego por la lista fija de sugerencias, que también completa las que falten.
 * Nunca ofrece archivadas ni subcategorías de una principal archivada.
 */
export function topCategories(db: LocalDb, userId: string, kind: CategoryKind): TopCategory[] {
  const usage = new Map(
    db
      .select({ id: transactions.categoryId, uses: count(), lastUsed: max(transactions.createdAt) })
      .from(transactions)
      .where(
        and(
          notDeleted(transactions),
          eq(transactions.reviewStatus, 'confirmed'),
          isNotNull(transactions.categoryId),
        ),
      )
      .groupBy(transactions.categoryId)
      .all()
      .map((row) => [row.id, { uses: row.uses, lastUsed: row.lastUsed?.getTime() ?? 0 }]),
  );
  const rows = db
    .select()
    .from(categories)
    .where(and(eq(categories.kind, kind), notDeleted(categories), isNull(categories.archivedAt)))
    .all();
  const mains = new Map(rows.filter((row) => row.parentId === null).map((row) => [row.id, row]));
  const suggested = SUGGESTED[kind].map((key) => predefinedCategoryId(userId, key));
  const rank = (id: string) => {
    const index = suggested.indexOf(id);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };

  return rows
    .filter((row) => row.parentId !== null && mains.has(row.parentId))
    .map((row) => ({ row, ...(usage.get(row.id) ?? { uses: 0, lastUsed: 0 }) }))
    .filter(({ row, uses }) => uses > 0 || rank(row.id) < Number.POSITIVE_INFINITY)
    .sort((a, b) => b.uses - a.uses || b.lastUsed - a.lastUsed || rank(a.row.id) - rank(b.row.id))
    .slice(0, 6)
    .map(({ row }) => {
      const main = mains.get(row.parentId ?? '');
      const labels = main
        ? categoryLabels(userId, row, main)
        : { label: row.name, accessibilityLabel: row.name };
      return { id: row.id, ...labels, icon: row.icon, color: row.color };
    });
}

/** Texto del aviso de guardado: «Gasto guardado: $ 12.500 en Supermercado». */
export function savedMessage(
  db: LocalDb,
  userId: string,
  kind: CategoryKind,
  amount: string,
  categoryId: string | null,
) {
  const sub = categoryId ? getCategory(db, categoryId) : undefined;
  const main = sub?.parentId ? getCategory(db, sub.parentId) : undefined;
  const where = sub && main ? ` en ${categoryLabels(userId, sub, main).label}` : '';
  return `${kind === 'expense' ? 'Gasto' : 'Ingreso'} guardado: ${amount}${where}`;
}

/**
 * Aviso de una transferencia: «Transferencia guardada: $ 50.000 de Ahorro a Efectivo»; con otra moneda
 * agrega cuánto llega.
 */
export function transferSavedMessage(
  db: LocalDb,
  transfer: {
    accountId: string;
    toAccountId: string;
    amountMinor: number;
    toAmountMinor: number | null;
  },
): string {
  const from = getAccount(db, transfer.accountId);
  const to = getAccount(db, transfer.toAccountId);
  if (!from || !to) return 'Transferencia guardada';
  const sent = formatMoney(transfer.amountMinor, from.currency as CurrencyCode);
  const arrives =
    from.currency === to.currency || transfer.toAmountMinor === null
      ? ''
      : ` (llegan ${formatMoney(transfer.toAmountMinor, to.currency as CurrencyCode)})`;
  return `Transferencia guardada: ${sent} de ${from.name} a ${to.name}${arrives}`;
}
