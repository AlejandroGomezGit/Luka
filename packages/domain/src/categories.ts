/**
 * Categorías predefinidas (documento 02, HU-07). La clave (`system_key`) es estable y define el UUID v5:
 * cambiarla crea otra categoría. El nombre es solo lo que se muestra y puede cambiar o traducirse.
 */
import type { CategoryKind } from './enums.js';
import { deterministicId } from './ids.js';

export interface PredefinedCategory {
  key: string;
  name: string;
  kind: CategoryKind;
  parent: string | null;
}

type Group = [key: string, name: string, subcategories: [key: string, name: string][]];

const EXPENSE: Group[] = [
  [
    'food',
    'Alimentación',
    [
      ['groceries', 'Supermercado'],
      ['restaurants', 'Restaurantes'],
      ['delivery', 'Domicilios'],
      ['coffee_snacks', 'Café y snacks'],
    ],
  ],
  [
    'transport',
    'Transporte',
    [
      ['fuel', 'Combustible'],
      ['public_transit', 'Transporte público'],
      ['taxi_apps', 'Taxi y apps'],
      ['parking_tolls', 'Parqueadero y peajes'],
      ['maintenance', 'Mantenimiento'],
      ['insurance', 'Seguros, SOAT y tecnomecánica'],
    ],
  ],
  [
    'housing',
    'Vivienda',
    [
      ['rent_mortgage', 'Arriendo o cuota'],
      ['building_fees', 'Administración'],
      ['repairs', 'Reparaciones'],
    ],
  ],
  [
    'utilities',
    'Servicios',
    [
      ['electricity', 'Energía'],
      ['water', 'Agua'],
      ['gas', 'Gas'],
      ['internet_phone', 'Internet y telefonía'],
    ],
  ],
  [
    'health',
    'Salud',
    [
      ['appointments_insurance', 'Citas y medicina prepagada'],
      ['pharmacy', 'Farmacia'],
      ['sports', 'Deporte'],
    ],
  ],
  [
    'education',
    'Educación',
    [
      ['tuition_courses', 'Matrículas y cursos'],
      ['books_supplies', 'Libros y materiales'],
    ],
  ],
  [
    'entertainment',
    'Entretenimiento',
    [
      ['outings', 'Salidas'],
      ['games_hobbies', 'Juegos y hobbies'],
      ['travel', 'Viajes'],
    ],
  ],
  [
    'shopping',
    'Compras',
    [
      ['clothing', 'Ropa'],
      ['electronics', 'Tecnología'],
      ['home', 'Hogar'],
    ],
  ],
  ['personal_care', 'Cuidado personal', []],
  ['subscriptions', 'Suscripciones', []],
  [
    'debt',
    'Deudas y créditos',
    [
      ['interest', 'Intereses y cargos'],
      ['loans', 'Préstamos'],
    ],
  ],
  [
    'fees',
    'Impuestos y comisiones',
    [
      ['gmf', '4x1000'],
      ['account_fees', 'Cuota de manejo'],
      ['taxes', 'Impuestos'],
    ],
  ],
  ['gifts', 'Regalos y donaciones', []],
  ['pets', 'Mascotas', []],
  ['other_expense', 'Otros gastos', []],
];

const INCOME: Group[] = [
  ['salary', 'Salario', []],
  ['freelance', 'Honorarios', []],
  ['business', 'Negocio y ventas', []],
  ['investment_income', 'Rendimientos', []],
  ['refunds', 'Reembolsos', []],
  ['other_income', 'Otros ingresos', []],
];

/**
 * Nombre de `.other`: «Otros» junto a subcategorías reales; «General» si es la única; y el nombre de la
 * categoría en las genéricas, para evitar «Otros gastos › Otros».
 */
const OTHER_NAMES: Record<string, string> = {
  other_expense: 'Otros gastos',
  other_income: 'Otros ingresos',
};

function otherName(key: string, hasSubcategories: boolean): string {
  return OTHER_NAMES[key] ?? (hasSubcategories ? 'Otros' : 'General');
}

function expand(groups: Group[], kind: CategoryKind): PredefinedCategory[] {
  return groups.flatMap(([key, name, subcategories]) => [
    { key, name, kind, parent: null },
    ...[
      ...subcategories,
      ['other', otherName(key, subcategories.length > 0)] as [string, string],
    ].map(([sub, subName]) => ({
      key: `${key}.${sub}`,
      name: subName,
      kind,
      parent: key,
    })),
  ]);
}

export const PREDEFINED_CATEGORIES: readonly PredefinedCategory[] = [
  ...expand(EXPENSE, 'expense'),
  ...expand(INCOME, 'income'),
];

/** Id de una categoría predefinida: UUID v5 con el usuario como espacio y la clave como nombre. */
export function predefinedCategoryId(userId: string, systemKey: string): string {
  return deterministicId(userId, systemKey);
}
