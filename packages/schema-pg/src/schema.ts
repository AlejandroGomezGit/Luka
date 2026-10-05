/**
 * Esquema de PostgreSQL del MVP (documento 02). Los nombres de columna van explícitos en snake_case
 * para no depender de la opción `casing` en cada cliente.
 */
import {
  ACCOUNT_TYPES,
  ATTACHMENT_KINDS,
  CATEGORY_KINDS,
  CATEGORY_SOURCES,
  CONSENT_PURPOSES,
  PLATFORMS,
  REVIEW_STATUSES,
  TRANSACTION_KINDS,
  TRANSACTION_SOURCES,
} from '@luka/domain';
import { type SQL, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  char,
  check,
  foreignKey,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Correo sin distinguir mayúsculas; la extensión se crea en la migración 0000. */
const citext = customType<{ data: string }>({ dataType: () => 'citext' });

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/** CHECK de enumeración; los valores son constantes de `@luka/domain`, no entrada del usuario. */
const oneOf = (column: AnyPgColumn, values: readonly string[]): SQL =>
  sql`${column} in (${sql.raw(values.map((v) => `'${v}'`).join(', '))})`;

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: citext('email').unique(),
  appleSub: text('apple_sub').unique(),
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  baseCurrency: char('base_currency', { length: 3 }).notNull().default('COP'),
  locale: text('locale').notNull().default('es-CO'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  deletedAt: timestamptz('deleted_at'),
});

/** Columnas comunes de las tablas sincronizables (documento 02). */
const syncColumns = () => ({
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamptz('created_at').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
  deletedAt: timestamptz('deleted_at'),
  version: integer('version').notNull().default(0),
  fieldClocks: jsonb('field_clocks').notNull().default({}),
});

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    platform: text('platform', { enum: PLATFORMS }).notNull(),
    appVersion: text('app_version').notNull(),
    pushToken: text('push_token'),
    lastSeenAt: timestamptz('last_seen_at'),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [
    check('devices_platform', oneOf(t.platform, PLATFORMS)),
    // Destino de la clave foránea compuesta de refresh_tokens (AM-03).
    unique('devices_user_id_id').on(t.userId, t.id),
  ],
);

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    purpose: text('purpose', { enum: CONSENT_PURPOSES }).notNull(),
    version: text('version').notNull(),
    grantedAt: timestamptz('granted_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [check('consents_purpose', oneOf(t.purpose, CONSENT_PURPOSES))],
);

export const accounts = pgTable(
  'accounts',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    openingBalanceMinor: bigint('opening_balance_minor', { mode: 'number' }).notNull().default(0),
    color: text('color').notNull(),
    icon: text('icon').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamptz('archived_at'),
  },
  (t) => [
    check('accounts_type', oneOf(t.type, ACCOUNT_TYPES)),
    // Destino de las claves foráneas compuestas: una fila solo apunta a otra del mismo usuario (AM-03).
    unique('accounts_user_id_id').on(t.userId, t.id),
  ],
);

export const categories = pgTable(
  'categories',
  {
    ...syncColumns(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
    color: text('color').notNull(),
    icon: text('icon').notNull(),
    systemKey: text('system_key'),
    archivedAt: timestamptz('archived_at'),
  },
  (t) => [
    check('categories_kind', oneOf(t.kind, CATEGORY_KINDS)),
    unique('categories_user_id_id').on(t.userId, t.id),
    // Las claves foráneas se comprueban por encima de la RLS: (user_id, id) impide apuntar a otro usuario.
    foreignKey({
      name: 'categories_parent_same_user',
      columns: [t.userId, t.parentId],
      foreignColumns: [t.userId, t.id],
    }),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    ...syncColumns(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    toAccountId: uuid('to_account_id').references(() => accounts.id),
    kind: text('kind', { enum: TRANSACTION_KINDS }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    toAmountMinor: bigint('to_amount_minor', { mode: 'number' }),
    currency: char('currency', { length: 3 }).notNull(),
    occurredOn: date('occurred_on').notNull(),
    occurredAt: timestamptz('occurred_at'),
    categoryId: uuid('category_id').references(() => categories.id),
    categorySource: text('category_source', { enum: CATEGORY_SOURCES }).notNull().default('user'),
    categoryConfidence: smallint('category_confidence'),
    merchant: text('merchant'),
    note: text('note'),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    // INV-01: nunca cero; negativo en gastos y transferencias, positivo en ingresos.
    check(
      'transactions_inv01_amount_sign',
      sql`${t.amountMinor} <> 0 and (
        (${t.kind} in ('expense', 'transfer') and ${t.amountMinor} < 0)
        or (${t.kind} = 'income' and ${t.amountMinor} > 0)
        or ${t.kind} = 'adjustment')`,
    ),
    // INV-02: solo las transferencias tienen cuenta y monto de destino.
    check(
      'transactions_inv02_transfer',
      sql`(${t.kind} = 'transfer' and ${t.toAccountId} is not null
          and ${t.toAccountId} <> ${t.accountId} and ${t.toAmountMinor} > 0)
        or (${t.kind} <> 'transfer' and ${t.toAccountId} is null and ${t.toAmountMinor} is null)`,
    ),
    unique('transactions_user_id_id').on(t.userId, t.id),
    foreignKey({
      name: 'transactions_account_same_user',
      columns: [t.userId, t.accountId],
      foreignColumns: [accounts.userId, accounts.id],
    }),
    foreignKey({
      name: 'transactions_to_account_same_user',
      columns: [t.userId, t.toAccountId],
      foreignColumns: [accounts.userId, accounts.id],
    }),
    foreignKey({
      name: 'transactions_category_same_user',
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    index('transactions_list')
      .on(t.userId, t.occurredOn.desc(), t.id)
      .where(sql`${t.deletedAt} is null`),
    index('transactions_month').on(t.userId, t.occurredOn, t.categoryId),
    index('transactions_account').on(t.accountId),
    index('transactions_to_account').on(t.toAccountId),
    uniqueIndex('transactions_external_id')
      .on(t.userId, t.accountId, t.externalId)
      .where(sql`${t.externalId} is not null`),
  ],
);

export const attachments = pgTable(
  'attachments',
  {
    ...syncColumns(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id),
    kind: text('kind', { enum: ATTACHMENT_KINDS }).notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    storageKey: text('storage_key'),
    uploadedAt: timestamptz('uploaded_at'),
  },
  (t) => [
    check('attachments_kind', oneOf(t.kind, ATTACHMENT_KINDS)),
    foreignKey({
      name: 'attachments_transaction_same_user',
      columns: [t.userId, t.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }),
  ],
);

/**
 * Tokens de refresco (T-019, AM-02): solo su HMAC, de un solo uso, ligados a un dispositivo y a una
 * familia (las rotaciones de una misma sesión). Solo existe en el servidor: no se sincroniza.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    deviceId: uuid('device_id').notNull(),
    familyId: uuid('family_id').notNull(),
    // El token del que salió en la rotación; varios hijos de un mismo padre son reemisiones dentro del
    // margen de 30 s (respuesta perdida o refrescos simultáneos), con un tope (ADR-016).
    parentId: uuid('parent_id'),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [
    index('refresh_tokens_user').on(t.userId),
    index('refresh_tokens_family').on(t.familyId),
    index('refresh_tokens_parent').on(t.parentId),
    // Destino de la clave foránea compuesta de parent_id: el padre es del mismo usuario (AM-03).
    unique('refresh_tokens_user_id_id').on(t.userId, t.id),
    foreignKey({
      name: 'refresh_tokens_parent_same_user',
      columns: [t.userId, t.parentId],
      foreignColumns: [t.userId, t.id],
    }),
    foreignKey({
      name: 'refresh_tokens_device_same_user',
      columns: [t.userId, t.deviceId],
      foreignColumns: [devices.userId, devices.id],
    }),
  ],
);
