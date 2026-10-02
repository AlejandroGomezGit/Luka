/**
 * Categorías predefinidas (documento 02, HU-07). La clave (`system_key`) es estable y define el UUID v5:
 * cambiarla crea otra categoría. El nombre es solo lo que se muestra y puede cambiar o traducirse.
 */
import type { CategoryKind } from './enums.js';
import { deterministicId } from './ids.js';
import type { ColorToken } from './tokens.js';

export interface PredefinedCategory {
  key: string;
  name: string;
  kind: CategoryKind;
  parent: string | null;
  /** Emoji del catálogo; la persona lo puede cambiar por cualquier otro. */
  icon: string;
  color: ColorToken;
}

type Sub = [key: string, name: string, icon: string];
type Group = [key: string, name: string, icon: string, color: ColorToken, subcategories: Sub[]];

const EXPENSE: Group[] = [
  [
    'food',
    'Alimentación',
    '🍽️',
    'orange',
    [
      ['groceries', 'Supermercado', '🛒'],
      ['restaurants', 'Restaurantes', '🍽️'],
      ['delivery', 'Domicilios', '🛵'],
      ['coffee_snacks', 'Café y snacks', '☕'],
    ],
  ],
  [
    'transport',
    'Transporte',
    '🚗',
    'blue',
    [
      ['fuel', 'Combustible', '⛽'],
      ['public_transit', 'Transporte público', '🚌'],
      ['taxi_apps', 'Taxi y apps', '🚕'],
      ['parking_tolls', 'Parqueadero y peajes', '🅿️'],
      ['maintenance', 'Mantenimiento', '🔧'],
      ['insurance', 'Seguros, SOAT y tecnomecánica', '🛡️'],
    ],
  ],
  [
    'housing',
    'Vivienda',
    '🏠',
    'brown',
    [
      ['rent_mortgage', 'Arriendo o cuota', '🔑'],
      ['building_fees', 'Administración', '🏢'],
      ['repairs', 'Reparaciones', '🔨'],
    ],
  ],
  [
    'utilities',
    'Servicios',
    '💡',
    'amber',
    [
      ['electricity', 'Energía', '💡'],
      ['water', 'Agua', '💧'],
      ['gas', 'Gas', '🔥'],
      ['internet_phone', 'Internet y telefonía', '📶'],
    ],
  ],
  [
    'health',
    'Salud',
    '🩺',
    'red',
    [
      ['appointments_insurance', 'Citas y medicina prepagada', '🩺'],
      ['pharmacy', 'Farmacia', '💊'],
      ['sports', 'Deporte', '🏃'],
    ],
  ],
  [
    'education',
    'Educación',
    '🎓',
    'indigo',
    [
      ['tuition_courses', 'Matrículas y cursos', '🎓'],
      ['books_supplies', 'Libros y materiales', '📚'],
    ],
  ],
  [
    'entertainment',
    'Entretenimiento',
    '🎟️',
    'purple',
    [
      ['outings', 'Salidas', '🍻'],
      ['games_hobbies', 'Juegos y hobbies', '🎮'],
      ['travel', 'Viajes', '✈️'],
    ],
  ],
  [
    'shopping',
    'Compras',
    '🛍️',
    'pink',
    [
      ['clothing', 'Ropa', '👕'],
      ['electronics', 'Tecnología', '💻'],
      ['home', 'Hogar', '🛋️'],
    ],
  ],
  ['personal_care', 'Cuidado personal', '💇', 'pink', []],
  ['subscriptions', 'Suscripciones', '🔁', 'cyan', []],
  [
    'debt',
    'Deudas y créditos',
    '💳',
    'red',
    [
      ['interest', 'Intereses y cargos', '💸'],
      ['loans', 'Préstamos', '🤝'],
    ],
  ],
  [
    'fees',
    'Impuestos y comisiones',
    '🧾',
    'gray',
    [
      ['gmf', '4x1000', '🏧'],
      ['account_fees', 'Cuota de manejo', '💳'],
      ['taxes', 'Impuestos', '🏛️'],
    ],
  ],
  ['gifts', 'Regalos y donaciones', '🎁', 'pink', []],
  ['pets', 'Mascotas', '🐾', 'brown', []],
  ['other_expense', 'Otros gastos', '📦', 'gray', []],
];

const INCOME: Group[] = [
  ['salary', 'Salario', '💼', 'green', []],
  ['freelance', 'Honorarios', '🧑‍💻', 'teal', []],
  ['business', 'Negocio y ventas', '🏪', 'green', []],
  ['investment_income', 'Rendimientos', '📈', 'teal', []],
  ['refunds', 'Reembolsos', '↩️', 'blue', []],
  ['other_income', 'Otros ingresos', '💰', 'gray', []],
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
    // «Otros» y «General» llevan el emoji de su principal.
    ...[...subcategories, ['other', otherName(key, subcategories.length > 0), icon] as Sub].map(
      ([sub, subName, subIcon]) => ({
        key: `${key}.${sub}`,
        name: subName,
        kind,
        parent: key,
        icon: subIcon,
        color,
      }),
    ),
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
