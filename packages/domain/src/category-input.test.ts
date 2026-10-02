import { describe, expect, it } from '@jest/globals';
import { predefinedCategoryId } from './categories.js';
import { type CategoryInput, checkCategoryInput, generalCategoryId } from './category-input.js';
import { sameName } from './names.js';

const userId = '0199a6f0-0000-7000-8000-000000000001';

describe('generalCategoryId: el «General» de cada categoría principal', () => {
  it('en una predefinida es su subcategoría .other (UUID v5 con el usuario y la clave)', () => {
    const food = { id: predefinedCategoryId(userId, 'food'), systemKey: 'food' };
    expect(generalCategoryId(userId, food)).toBe(predefinedCategoryId(userId, 'food.other'));
  });

  it('en una creada por la persona es uuid5(id de la principal, "other"), verificado con Python', () => {
    const custom = { id: '01a0fe05-514b-751e-abba-11cfc1060da0', systemKey: null };
    expect(generalCategoryId(userId, custom)).toBe('49891724-d234-57b0-a202-cc26013a38e3');
  });

  it('no depende del nombre: renombrar la principal no cambia su «General»', () => {
    const custom = { id: '01a0fe05-514b-751e-abba-11cfc1060da0', systemKey: null };
    expect(generalCategoryId(userId, { ...custom })).toBe(generalCategoryId(userId, custom));
  });
});

describe('sameName', () => {
  it('ignora mayúsculas, tildes y espacios de más', () => {
    expect(sameName('  Café   y Snacks ', 'cafe y snacks')).toBe(true);
    expect(sameName('Mercado', 'Mercados')).toBe(false);
  });
});

const valid: CategoryInput = {
  name: 'Mercado campesino',
  kind: 'expense',
  icon: 'cart',
  color: 'green',
};
const food = { kind: 'expense' as const, parentId: null };

describe('HU-07 checkCategoryInput', () => {
  it('acepta una categoría principal y una subcategoría válidas', () => {
    expect(checkCategoryInput(valid, { parent: null, siblingNames: [] })).toEqual([]);
    expect(checkCategoryInput(valid, { parent: food, siblingNames: ['Supermercado'] })).toEqual([]);
  });

  it('exige nombre y lo limita a 40 caracteres', () => {
    expect(
      checkCategoryInput({ ...valid, name: '   ' }, { parent: null, siblingNames: [] }),
    ).toEqual(['name_required']);
    expect(
      checkCategoryInput({ ...valid, name: 'x'.repeat(41) }, { parent: null, siblingNames: [] }),
    ).toEqual(['name_too_long']);
  });

  it('no permite repetir el nombre entre hermanas, sin importar tildes ni mayúsculas', () => {
    expect(
      checkCategoryInput(
        { ...valid, name: 'SUPERMÉRCADO' },
        { parent: food, siblingNames: ['Supermercado'] },
      ),
    ).toEqual(['name_duplicate']);
  });

  it('solo acepta tokens de ícono y color de la lista', () => {
    expect(
      checkCategoryInput(
        { ...valid, icon: 'fork.knife', color: '#ff0000' },
        { parent: null, siblingNames: [] },
      ),
    ).toEqual(['icon_unknown', 'color_unknown']);
  });

  it('máximo dos niveles y la principal del mismo tipo', () => {
    const groceries = { kind: 'expense' as const, parentId: 'food' };
    expect(checkCategoryInput(valid, { parent: groceries, siblingNames: [] })).toEqual([
      'parent_not_main',
    ]);
    const salary = { kind: 'income' as const, parentId: null };
    expect(checkCategoryInput(valid, { parent: salary, siblingNames: [] })).toEqual([
      'parent_kind_mismatch',
    ]);
  });
});
