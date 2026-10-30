/** Mensajes en español de cada resultado de /v1/auth (T-019c, tabla aprobada en #124). */
import type { AuthError } from './session';

const MESSAGES: Record<Exclude<AuthError, 'too_many_attempts'>, string> = {
  consent_required:
    'Para crear la cuenta tienes que aceptar los términos y la autorización de datos.',
  age_confirmation_required: 'Para crear la cuenta tienes que confirmar que tienes 18 años o más.',
  password_too_short: 'La contraseña debe tener al menos 10 caracteres.',
  password_compromised: 'Esa contraseña aparece en filtraciones conocidas. Elige otra.',
  email_taken: 'Ese correo ya tiene una cuenta. Puedes iniciar sesión.',
  user_id_unavailable: 'No se pudo crear la cuenta desde este iPhone. Inténtalo de nuevo.',
  device_unavailable: 'No se pudo registrar este iPhone. Inténtalo de nuevo.',
  invalid_credentials: 'Correo o contraseña incorrectos.',
  rate_limited: 'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
  temporarily_unavailable: 'El servicio no está disponible en este momento. Inténtalo más tarde.',
  validation_failed: 'Revisa los datos e inténtalo de nuevo.',
  // El de las pantallas de crear cuenta e iniciar sesión.
  offline: 'Sin conexión. Crear la cuenta o iniciar sesión necesita internet.',
  unknown: 'Algo salió mal. Inténtalo de nuevo.',
};

/** `retryAfterSeconds` sale de la cabecera Retry-After; se redondea hacia arriba a minutos. */
export function authMessage(error: AuthError, retryAfterSeconds?: number): string {
  if (error !== 'too_many_attempts') return MESSAGES[error];
  if (retryAfterSeconds === undefined) {
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  }
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Demasiados intentos. Espera ${minutes === 1 ? '1 minuto' : `${String(minutes)} minutos`} y vuelve a intentarlo.`;
}
