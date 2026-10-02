import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import {
  type AccountInput,
  checkAccountInput,
  openingAmountFor,
  openingBalanceFor,
} from './account-input.js';

const valid: AccountInput = {
  name: 'Bancolombia ahorros',
  type: 'savings',
  currency: 'COP',
  openingAmountMinor: 120_000_00,
  icon: '🏦',
  color: 'teal',
};

describe('HU-02 checkAccountInput', () => {
  it('HU-02 una cuenta tiene nombre, tipo y saldo inicial', () => {
    expect(checkAccountInput(valid, { activeNames: [] })).toEqual([]);
  });

  it('HU-02 el nombre es requerido, de hasta 40 caracteres y único entre las cuentas activas', () => {
    const none = { activeNames: [] };
    expect(checkAccountInput({ ...valid, name: ' ' }, none)).toEqual(['name_required']);
    expect(checkAccountInput({ ...valid, name: 'x'.repeat(41) }, none)).toEqual(['name_too_long']);
    expect(checkAccountInput(valid, { activeNames: ['BANCOLOMBIA Ahorros'] })).toEqual([
      'name_duplicate',
    ]);
  });

  it('HU-02 el saldo inicial es cero o positivo y entero; la tarjeta de crédito lo pide como deuda', () => {
    const none = { activeNames: [] };
    expect(checkAccountInput({ ...valid, openingAmountMinor: 0 }, none)).toEqual([]);
    expect(checkAccountInput({ ...valid, openingAmountMinor: -1 }, none)).toEqual([
      'amount_invalid',
    ]);
    expect(checkAccountInput({ ...valid, openingAmountMinor: 1.5 }, none)).toEqual([
      'amount_invalid',
    ]);
  });

  it('el ícono es opcional: vacío vale y se muestra con uno de respaldo', () => {
    expect(checkAccountInput({ ...valid, icon: '' }, { activeNames: [] })).toEqual([]);
  });

  it('rechaza tipo y moneda desconocidos, un ícono que no es emoji y un color fuera de la paleta', () => {
    expect(
      checkAccountInput(
        { ...valid, type: 'wallet', currency: 'BTC', icon: 'x', color: 'y' },
        { activeNames: [] },
      ),
    ).toEqual(['type_unknown', 'currency_unknown', 'icon_invalid', 'color_unknown']);
  });
});

describe('HU-02 saldo inicial de la tarjeta de crédito', () => {
  it('HU-02 la deuda actual se escribe en positivo y se guarda en negativo', () => {
    expect(openingBalanceFor('credit_card', 50_000_000)).toBe(-50_000_000);
    expect(openingBalanceFor('savings', 50_000_000)).toBe(50_000_000);
  });

  it('HU-02 propiedad: guardar y volver a editar muestra el mismo monto para cualquier tipo', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'cash' as const,
          'checking' as const,
          'savings' as const,
          'credit_card' as const,
          'other' as const,
        ),
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (type, amount) => {
          expect(openingAmountFor(type, openingBalanceFor(type, amount))).toBe(amount);
        },
      ),
    );
  });
});
