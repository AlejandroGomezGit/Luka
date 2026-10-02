import { describe, expect, it } from '@jest/globals';
import { PREDEFINED_CATEGORIES, predefinedCategoryId } from './categories.js';
import { deterministicId } from './ids.js';

const userId = '0199a6f0-0000-7000-8000-000000000001';
const otherUserId = '0199a6f0-0000-7000-8000-000000000002';
const keys = PREDEFINED_CATEGORIES.map((c) => c.key);
const parents = PREDEFINED_CATEGORIES.filter((c) => c.parent === null);

describe('UUID v5 de las categorías predefinidas (HU-07, ADR-008)', () => {
  it('coincide con valores calculados aparte con Python: uuid5(user_id, clave)', () => {
    expect(predefinedCategoryId(userId, 'food')).toBe('61af004e-7a53-5c64-9431-9af887677dcf');
    expect(predefinedCategoryId(userId, 'food.groceries')).toBe(
      '58cf4431-1fd0-57b8-aac8-21dc69e00578',
    );
    expect(predefinedCategoryId(userId, 'debt.interest')).toBe(
      'e72159f5-72fe-5749-9e7d-5c1fdd2c715e',
    );
    expect(predefinedCategoryId(userId, 'salary.other')).toBe(
      '025d75fe-0302-5cb1-8557-2f363b623df5',
    );
  });

  it('cada clave produce el mismo id en dos dispositivos del mismo usuario', () => {
    const deviceA = keys.map((key) => predefinedCategoryId(userId, key));
    const deviceB = keys.map((key) => deterministicId(userId, key));
    expect(deviceA).toEqual(deviceB);
  });

  it('los ids no se repiten entre claves ni entre usuarios', () => {
    const own = keys.map((key) => predefinedCategoryId(userId, key));
    const other = keys.map((key) => predefinedCategoryId(otherUserId, key));
    expect(new Set([...own, ...other]).size).toBe(keys.length * 2);
  });
});

describe('catálogo de categorías predefinidas (documento 02)', () => {
  it('las claves son únicas, en inglés y de uno o dos niveles separados por punto', () => {
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$/);
  });

  it('tiene 15 categorías principales de gasto, 6 de ingreso y 75 en total', () => {
    expect(PREDEFINED_CATEGORIES).toHaveLength(75);
    expect(parents.filter((c) => c.kind === 'expense')).toHaveLength(15);
    expect(parents.filter((c) => c.kind === 'income')).toHaveLength(6);
  });

  it('cada subcategoría cuelga de una principal del mismo tipo con el prefijo de su clave', () => {
    for (const sub of PREDEFINED_CATEGORIES.filter((c) => c.parent !== null)) {
      const parent = parents.find((p) => p.key === sub.parent);
      expect(parent?.kind).toBe(sub.kind);
      expect(sub.key.startsWith(`${sub.parent ?? ''}.`)).toBe(true);
    }
  });

  it('cada categoría principal tiene su subcategoría «otros»', () => {
    for (const parent of parents) expect(keys).toContain(`${parent.key}.other`);
  });

  it('el nombre de .other evita repeticiones: Otros, General o el de la categoría genérica', () => {
    const nameOf = (key: string) => PREDEFINED_CATEGORIES.find((c) => c.key === key)?.name;
    expect(nameOf('food.other')).toBe('Otros');
    expect(nameOf('subscriptions.other')).toBe('General');
    expect(nameOf('personal_care.other')).toBe('General');
    expect(nameOf('other_expense.other')).toBe('Otros gastos');
    expect(nameOf('other_income.other')).toBe('Otros ingresos');
  });

  it('incluye los cambios aprobados: interest, insurance y personal_care', () => {
    expect(keys).toEqual(
      expect.arrayContaining(['debt.interest', 'transport.insurance', 'personal_care.other']),
    );
    expect(keys).not.toContain('debt.card_installments');
  });

  it('todas tienen nombre en español', () => {
    for (const category of PREDEFINED_CATEGORIES) expect(category.name.length).toBeGreaterThan(0);
  });
});
