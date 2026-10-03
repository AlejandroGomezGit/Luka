import type { TransactionInputError } from '@luka/domain';

/** Mensajes en español de los errores al registrar un movimiento. */
export function transactionErrorMessage(code: TransactionInputError): string {
  switch (code) {
    case 'amount_not_positive':
      return 'El monto debe ser mayor que cero.';
    case 'date_in_future':
      return 'La fecha no puede ser futura.';
    case 'date_invalid':
      return 'La fecha no es válida.';
    case 'INV-06':
      return 'Esta cuenta está archivada: elige otra.';
    case 'INV-04':
      return 'Esa categoría no corresponde al tipo de movimiento.';
    default:
      return 'No se pudo guardar el movimiento.';
  }
}
