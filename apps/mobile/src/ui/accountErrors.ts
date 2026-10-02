import type { AccountInputError, CurrencyCode } from '@luka/domain';

type Field = 'name' | 'type' | 'currency' | 'amount' | 'icon' | 'color' | 'archive';

/** Mensajes en español para los códigos de las cuentas y el campo donde se muestran. */
export function accountErrorMessage(
  code: AccountInputError,
  currency: CurrencyCode,
): { field: Field; message: string } {
  switch (code) {
    case 'name_required':
      return { field: 'name', message: 'Escribe un nombre.' };
    case 'name_too_long':
      return { field: 'name', message: 'Usa 40 caracteres o menos.' };
    case 'name_duplicate':
      return { field: 'name', message: 'Ya hay una cuenta activa con ese nombre.' };
    case 'type_unknown':
      return { field: 'type', message: 'Elige un tipo de cuenta.' };
    case 'currency_unknown':
      return { field: 'currency', message: 'Elige una moneda.' };
    case 'currency_locked':
      return {
        field: 'currency',
        message: 'La moneda no se puede cambiar porque la cuenta ya tiene movimientos.',
      };
    case 'amount_invalid':
      return {
        field: 'amount',
        message:
          currency === 'COP'
            ? 'Escribe el monto en pesos, por ejemplo 120.000.'
            : 'Escribe un monto válido, por ejemplo 1.234,56.',
      };
    case 'icon_unknown':
      return { field: 'icon', message: 'Elige un ícono de la lista.' };
    case 'color_unknown':
      return { field: 'color', message: 'Elige un color de la lista.' };
  }
}
