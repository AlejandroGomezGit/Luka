/**
 * Esquema de SQLite del dispositivo (documento 02): las mismas tablas sincronizables que PostgreSQL con
 * los tipos físicos de SQLite. `users`, `devices` y `consents` solo viven en el servidor.
 */
import {
  ACCOUNT_TYPES,
  ATTACHMENT_KINDS,
  CATEGORY_KINDS,
  CATEGORY_SOURCES,
  REVIEW_STATUSES,
  TRANSACTION_KINDS,
  TRANSACTION_SOURCES,
} from '@luka/domain';
import { type SQL, sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** Instante en UTC: INTEGER con milisegundos desde 1970. */
const instant = (name: string) => integer(name, { mode: 'timestamp_ms' });

/** CHECK de enumeración; los valores son constantes de `@luka/domain`, no entrada del usuario. */
const oneOf = (column: AnySQLiteColumn, values: readonly string[]): SQL =>
  sql`${column} in (${sql.raw(values.map((v) => `'${v}'`).join(', '))})`;

/** Columnas comunes de las tablas sincronizables (documento 02). */
const syncColumns = () => ({
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: instant('created_at').notNull(),
  updatedAt: instant('updated_at').notNull(),
  deletedAt: instant('deleted_at'),
  version: integer('version').notNull().default(0),
  fieldClocks: text('field_clocks', { mode: 'json' }).notNull().default({}),
});

export const accounts = sqliteTable(
  'accounts',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
    currency: text('currency', { length: 3 }).notNull(),
    openingBalanceMinor: integer('opening_balance_minor').notNull().default(0),
    color: text('color').notNull(),
    icon: text('icon').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: instant('archived_at'),
  },
  (t) => [check('accounts_type', oneOf(t.type, ACCOUNT_TYPES))],
);

export const categories = sqliteTable(
  'categories',
  {
    ...syncColumns(),
    parentId: text('parent_id').references((): AnySQLiteColumn => categories.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
    color: text('color').notNull(),
    icon: text('icon').notNull(),
    systemKey: text('system_key'),
    archivedAt: instant('archived_at'),
  },
  (t) => [check('categories_kind', oneOf(t.kind, CATEGORY_KINDS))],
);

export const transactions = sqliteTable(
  'transactions',
  {
    ...syncColumns(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    toAccountId: text('to_account_id').references(() => accounts.id),
    kind: text('kind', { enum: TRANSACTION_KINDS }).notNull(),
    amountMinor: integer('amount_minor').notNull(),
    toAmountMinor: integer('to_amount_minor'),
    currency: text('currency', { length: 3 }).notNull(),
    /** Fecha local AAAA-MM-DD. */
    occurredOn: text('occurred_on').notNull(),
    occurredAt: instant('occurred_at'),
    categoryId: text('category_id').references(() => categories.id),
    categorySource: text('category_source', { enum: CATEGORY_SOURCES }).notNull().default('user'),
    categoryConfidence: integer('category_confidence'),
    merchant: text('merchant'),
    note: text('note'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    source: text('source', { enum: TRANSACTION_SOURCES }).notNull().default('manual'),
    reviewStatus: text('review_status', { enum: REVIEW_STATUSES }).notNull().default('confirmed'),
    externalId: text('external_id'),
  },
  (t) => [
    check('transactions_kind', oneOf(t.kind, TRANSACTION_KINDS)),
    check('transactions_category_source', oneOf(t.categorySource, CATEGORY_SOURCES)),
    check('transactions_source', oneOf(t.source, TRANSACTION_SOURCES)),
    check('transactions_review_status', oneOf(t.reviewStatus, REVIEW_STATUSES)),
    check('transactions_category_confidence', sql`${t.categoryConfidence} between 0 and 100`),
    // INV-01 e INV-02, igual que en PostgreSQL.
    check(
      'transactions_inv01_amount_sign',
      sql`${t.amountMinor} <> 0 and (
        (${t.kind} in ('expense', 'transfer') and ${t.amountMinor} < 0)
        or (${t.kind} = 'income' and ${t.amountMinor} > 0)
        or ${t.kind} = 'adjustment')`,
    ),
    check(
      'transactions_inv02_transfer',
      sql`(${t.kind} = 'transfer' and ${t.toAccountId} is not null
          and ${t.toAccountId} <> ${t.accountId} and ${t.toAmountMinor} > 0)
        or (${t.kind} <> 'transfer' and ${t.toAccountId} is null and ${t.toAmountMinor} is null)`,
    ),
    index('transactions_list')
      .on(t.userId, sql`${t.occurredOn} desc`, t.id)
      .where(sql`${t.deletedAt} is null`),
    index('transactions_month').on(t.userId, t.occurredOn, t.categoryId),
    index('transactions_account').on(t.accountId),
    index('transactions_to_account').on(t.toAccountId),
    uniqueIndex('transactions_external_id')
      .on(t.userId, t.accountId, t.externalId)
      .where(sql`${t.externalId} is not null`),
  ],
);

export const attachments = sqliteTable(
  'attachments',
  {
    ...syncColumns(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id),
    kind: text('kind', { enum: ATTACHMENT_KINDS }).notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    storageKey: text('storage_key'),
    uploadedAt: instant('uploaded_at'),
  },
  (t) => [check('attachments_kind', oneOf(t.kind, ATTACHMENT_KINDS))],
);

/**
 * Solo en el dispositivo, una fila: identidad local creada en el primer arranque. El `user_id` local se
 * envía al servidor al registrarse (T-019), así los datos creados sin servidor no se reescriben.
 */
export const deviceProfile = sqliteTable('device_profile', {
  deviceId: text('device_id').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: instant('created_at').notNull(),
});
