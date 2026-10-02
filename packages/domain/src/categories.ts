/**
 * Categorías predefinidas (documento 02, HU-07). La clave (`system_key`) es estable y define el UUID v5:
 * cambiarla crea otra categoría. El nombre es solo lo que se muestra y puede cambiar o traducirse.
 */
import type { CategoryKind } from './enums.js';
import { deterministicId } from './ids.js';
import type { ColorToken, IconToken } from './tokens.js';

export interface PredefinedCategory {
  key: string;
  name: string;
  kind: CategoryKind;
  parent: string | null;
  icon: IconToken;
  color: ColorToken;
}

type Sub = [key: string, name: string, icon: IconToken];
type Group = [key: string, name: string, icon: IconToken, color: ColorToken, subcategories: Sub[]];

const EXPENSE: Group[] = [
  [
    'food',
    'Alimentación',
    'utensils',
    'orange',
    [
      ['groceries', 'Supermercado', 'cart'],
      ['restaurants', 'Restaurantes', 'utensils'],
      ['delivery', 'Domicilios', 'takeout'],
      ['coffee_snacks', 'Café y snacks', 'coffee'],
    ],
  ],
  [
    'transport',
    'Transporte',
    'car',
    'blue',
    [
      ['fuel', 'Combustible', 'fuel'],
      ['public_transit', 'Transporte público', 'bus'],
      ['taxi_apps', 'Taxi y apps', 'taxi'],
      ['parking_tolls', 'Parqueadero y peajes', 'parking'],
      ['maintenance', 'Mantenimiento', 'wrench'],
      ['insurance', 'Seguros, SOAT y tecnomecánica', 'shield'],
    ],
  ],
  [
    'housing',
    'Vivienda',
    'home',
    'brown',
    [
      ['rent_mortgage', 'Arriendo o cuota', 'home'],
      ['building_fees', 'Administración', 'building'],
      ['repairs', 'Reparaciones', 'hammer'],
    ],
  ],
  [
    'utilities',
    'Servicios',
    'bolt',
    'amber',
    [
      ['electricity', 'Energía', 'bolt'],
      ['water', 'Agua', 'drop'],
      ['gas', 'Gas', 'flame'],
      ['internet_phone', 'Internet y telefonía', 'wifi'],
    ],
  ],
  [
    'health',
    'Salud',
    'heart',
    'red',
    [
      ['appointments_insurance', 'Citas y medicina prepagada', 'stethoscope'],
      ['pharmacy', 'Farmacia', 'pill'],
      ['sports', 'Deporte', 'run'],
    ],
  ],
  [
    'education',
    'Educación',
    'graduation',
    'indigo',
    [
      ['tuition_courses', 'Matrículas y cursos', 'graduation'],
      ['books_supplies', 'Libros y materiales', 'book'],
    ],
  ],
  [
    'entertainment',
    'Entretenimiento',
    'ticket',
    'purple',
    [
      ['outings', 'Salidas', 'ticket'],
      ['games_hobbies', 'Juegos y hobbies', 'game'],
      ['travel', 'Viajes', 'airplane'],
    ],
  ],
  [
    'shopping',
    'Compras',
    'bag',
    'pink',
    [
      ['clothing', 'Ropa', 'shirt'],
      ['electronics', 'Tecnología', 'laptop'],
      ['home', 'Hogar', 'sofa'],
    ],
  ],
  ['personal_care', 'Cuidado personal', 'sparkles', 'pink', []],
  ['subscriptions', 'Suscripciones', 'repeat', 'cyan', []],
  [
    'debt',
    'Deudas y créditos',
    'card',
    'red',
    [
      ['interest', 'Intereses y cargos', 'percent'],
      ['loans', 'Préstamos', 'bank'],
    ],
  ],
  [
    'fees',
    'Impuestos y comisiones',
    'receipt',
    'gray',
    [
      ['gmf', '4x1000', 'percent'],
      ['account_fees', 'Cuota de manejo', 'card'],
      ['taxes', 'Impuestos', 'receipt'],
    ],
  ],
  ['gifts', 'Regalos y donaciones', 'gift', 'pink', []],
  ['pets', 'Mascotas', 'paw', 'brown', []],
  ['other_expense', 'Otros gastos', 'more', 'gray', []],
];

const INCOME: Group[] = [
  ['salary', 'Salario', 'briefcase', 'green', []],
  ['freelance', 'Honorarios', 'person', 'teal', []],
  ['business', 'Negocio y ventas', 'banknote', 'green', []],
  ['investment_income', 'Rendimientos', 'chart', 'teal', []],
  ['refunds', 'Reembolsos', 'refund', 'blue', []],
  ['other_income', 'Otros ingresos', 'plus', 'gray', []],
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
  return groups.flatMap(([key, name, icon, color, subcategories]) => [
    { key, name, kind, parent: null, icon, color },
    // «Otros» junto a subcategorías usa el ícono genérico; «General» se ve igual que su principal.
    ...[
      ...subcategories,
      [
        'other',
        otherName(key, subcategories.length > 0),
        subcategories.length > 0 ? 'more' : icon,
      ] as Sub,
    ].map(([sub, subName, subIcon]) => ({
      key: `${key}.${sub}`,
      name: subName,
      kind,
      parent: key,
      icon: subIcon,
      color,
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
