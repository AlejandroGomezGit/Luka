import { describe, expect, it } from '@jest/globals';
import { REVIEW_STATUSES, TRANSACTION_KINDS, TRANSACTION_SOURCES } from './enums.js';

describe('enumeraciones del documento 02', () => {
  it('incluyen los valores que usan los esquemas y los invariantes', () => {
    expect(TRANSACTION_KINDS).toEqual(['expense', 'income', 'transfer', 'adjustment']);
    expect(REVIEW_STATUSES[0]).toBe('confirmed');
    expect(TRANSACTION_SOURCES).toContain('manual');
  });
});
