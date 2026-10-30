/**
 * Cliente de /v1/auth (T-019c): registro, inicio y cierre de sesión. Los cuerpos y las respuestas se
 * validan con los esquemas de @luka/contracts; del servidor solo se lee `code` (regla 9), nunca `detail`.
 * Ningún resultado ni mensaje lleva tokens, contraseñas ni correos, y nada se imprime.
 */
import { LoginRequest, Problem, RegisterRequest, TokenPair } from '@luka/contracts';
import type { Clock } from '@luka/domain';
import type { TokenStore } from './tokenStore';

/** Códigos del servidor que la app distingue, más los que nacen en el iPhone. */
const SERVER_CODES = [
  'consent_required',
  'age_confirmation_required',
  'password_too_short',
  'password_compromised',
  'email_taken',
  'user_id_unavailable',
  'device_unavailable',
  'invalid_credentials',
  'too_many_attempts',
  'rate_limited',
  'temporarily_unavailable',
  'validation_failed',
] as const;
export type AuthError = (typeof SERVER_CODES)[number] | 'offline' | 'unknown';
const KNOWN = new Set<string>(SERVER_CODES);

export type AuthResult = { ok: true } | { ok: false; error: AuthError; retryAfterSeconds?: number };

export interface AuthDevice {
  /** Id de dispositivo vigente (device_profile). */
  id: () => string;
}

export interface AuthSessionDeps {
  baseUrl: string;
  fetch: typeof fetch;
  tokens: TokenStore;
  clock: Clock;
  device: AuthDevice;
  appVersion: string;
  /** Tiempo límite de la revocación al cerrar sesión. */
  logoutTimeoutMs?: number;
}

export type RegisterInput = Omit<RegisterRequest, 'deviceId' | 'appVersion' | 'displayName'> & {
  displayName?: string;
};
export type LoginInput = Pick<LoginRequest, 'email' | 'password'>;

/** Retry-After en segundos enteros y positivos; cualquier otra forma se ignora. */
function retryAfter(res: Response): number | undefined {
  const value = res.headers.get('retry-after');
  return value !== null && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : undefined;
}

async function failure(res: Response | null): Promise<AuthResult> {
  if (!res) return { ok: false, error: 'offline' };
  const body: unknown = await res.json().catch(() => null);
  const problem = Problem.safeParse(body);
  const code = problem.success ? problem.data.code : undefined;
  if (code !== undefined && KNOWN.has(code)) {
    const error = code as AuthError;
    const seconds = error === 'too_many_attempts' ? retryAfter(res) : undefined;
    return seconds === undefined
      ? { ok: false, error }
      : { ok: false, error, retryAfterSeconds: seconds };
  }
  return { ok: false, error: res.status >= 500 ? 'temporarily_unavailable' : 'unknown' };
}

export function createAuthSession(deps: AuthSessionDeps) {
  /** Token de acceso en memoria; el de refresco solo vive en el Keychain. */
  let access: { token: string; expiresAt: number } | null = null;

  const post = async (path: string, body: unknown, token?: string, signal?: AbortSignal) => {
    try {
      return await deps.fetch(`${deps.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch {
      return null;
    }
  };

  /** Envía el cuerpo y, si el servidor entrega un par, lo guarda con su vencimiento. */
  const signIn = async (path: string, body: unknown): Promise<AuthResult> => {
    const res = await post(path, body);
    if (!res?.ok) return failure(res);
    const pair = TokenPair.safeParse(await res.json().catch(() => null));
    if (!pair.success) return { ok: false, error: 'unknown' };
    const accessExpiresAt = deps.clock.now() + pair.data.expiresIn * 1000;
    try {
      await deps.tokens.write({
        accessToken: pair.data.accessToken,
        refreshToken: pair.data.refreshToken,
        accessExpiresAt,
      });
    } catch {
      // Sin Keychain no hay sesión que sobreviva al cierre de la app: no se da por iniciada.
      return { ok: false, error: 'unknown' };
    }
    access = { token: pair.data.accessToken, expiresAt: accessExpiresAt };
    return { ok: true };
  };

  /** Revocación de mejor esfuerzo: un intento, con tiempo límite, sin reintentos ni errores. */
  const revoke = async (token: string): Promise<void> => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, deps.logoutTimeoutMs ?? 5_000);
    await post('/v1/auth/logout', undefined, token, controller.signal);
    clearTimeout(timer);
  };

  return {
    register: async (input: RegisterInput): Promise<AuthResult> => {
      const body = RegisterRequest.safeParse({
        ...input,
        deviceId: deps.device.id(),
        appVersion: deps.appVersion,
      });
      if (!body.success) return { ok: false, error: 'validation_failed' };
      return signIn('/v1/auth/register', body.data);
    },

    login: async (input: LoginInput): Promise<AuthResult> => {
      const body = LoginRequest.safeParse({
        ...input,
        deviceId: deps.device.id(),
        appVersion: deps.appVersion,
      });
      if (!body.success) return { ok: false, error: 'validation_failed' };
      return signIn('/v1/auth/login', body.data);
    },

    /**
     * Cierre inmediato: se toma el token de acceso (de memoria o, tras un reinicio, del Keychain), se
     * vacían memoria y Keychain, y recién entonces se revoca en el servidor. `revocation` no se espera.
     */
    logout: async (): Promise<{ revocation: Promise<void> }> => {
      const token = access?.token ?? (await deps.tokens.read().catch(() => null))?.accessToken;
      access = null;
      await deps.tokens.clear();
      return { revocation: token === undefined ? Promise.resolve() : revoke(token) };
    },

    isSignedIn: async (): Promise<boolean> =>
      access !== null || (await deps.tokens.read().catch(() => null)) !== null,
  };
}

export type AuthSession = ReturnType<typeof createAuthSession>;
