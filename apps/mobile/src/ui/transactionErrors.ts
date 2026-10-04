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
    case 'to_amount_not_positive':
      return 'Escribe cuánto llega a la cuenta de destino.';
    case 'INV-02':
      return 'Elige una cuenta de destino distinta.';
    case 'INV-04':
      return 'Esa categoría no corresponde al tipo de movimiento.';
    case 'too_many_tags':
      return 'Puedes poner hasta 10 etiquetas.';
    case 'tag_too_long':
      return 'Cada etiqueta puede tener hasta 30 caracteres.';
    default:
      return 'No se pudo guardar el movimiento.';
  }
}
