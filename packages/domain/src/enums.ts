/**
 * Valores de las enumeraciones del documento 02. Los esquemas de PostgreSQL y SQLite los importan de
 * aquí para que ambos motores acepten exactamente los mismos valores.
 */
export const ACCOUNT_TYPES = ['cash', 'checking', 'savings', 'credit_card', 'other'] as const;
export const CATEGORY_KINDS = ['expense', 'income'] as const;
export const TRANSACTION_KINDS = ['expense', 'income', 'transfer', 'adjustment'] as const;
export const CATEGORY_SOURCES = ['user', 'rule', 'model', 'import'] as const;
export const TRANSACTION_SOURCES = [
  'manual',
  'import_csv',
  'import_pdf',
  'message_paste',
  'message_shortcut',
  'bank',
  'receipt_scan',
  'recurring',
] as const;
export const REVIEW_STATUSES = ['confirmed', 'pending_review'] as const;
export const ATTACHMENT_KINDS = ['receipt'] as const;
export const CONSENT_PURPOSES = ['terms', 'privacy', 'ai_external', 'bank_connection'] as const;
export const PLATFORMS = ['ios'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type CategoryKind = (typeof CATEGORY_KINDS)[number];
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
