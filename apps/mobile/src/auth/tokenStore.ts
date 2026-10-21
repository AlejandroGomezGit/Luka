/**
 * Tokens de sesión en el Keychain de iOS (T-019c, #97): un solo elemento con los dos tokens y el
 * vencimiento del de acceso. `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: solo se leen con el iPhone desbloqueado y
 * no pasan a un respaldo ni a otro iPhone. Nunca se guardan en SQLite ni se imprimen.
 * Jest solo comprueba que se pasa la opción; la protección real se verifica en el build propio (T-041).
 */
import * as SecureStore from 'expo-secure-store';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Milisegundos (reloj del dispositivo) en que vence el token de acceso: recepción + `expiresIn`. */
  accessExpiresAt: number;
}

export interface TokenStore {
  read: () => Promise<StoredSession | null>;
  write: (session: StoredSession) => Promise<void>;
  clear: () => Promise<void>;
}

/** Lo que se usa de expo-secure-store; las pruebas pasan uno en memoria. */
export type SecureStoreModule = Pick<
  typeof SecureStore,
  'getItemAsync' | 'setItemAsync' | 'deleteItemAsync' | 'WHEN_UNLOCKED_THIS_DEVICE_ONLY'
>;

const KEY = 'luka.sesion';

function parse(raw: string): StoredSession | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { accessToken, refreshToken, accessExpiresAt } = value as Record<string, unknown>;
    if (typeof accessToken !== 'string' || accessToken === '') return null;
    if (typeof refreshToken !== 'string' || refreshToken === '') return null;
    if (typeof accessExpiresAt !== 'number' || !Number.isFinite(accessExpiresAt)) return null;
    return { accessToken, refreshToken, accessExpiresAt };
  } catch {
    return null;
  }
}

export function secureTokenStore(store: SecureStoreModule = SecureStore): TokenStore {
  const options = { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return {
    read: async () => {
      const raw = await store.getItemAsync(KEY, options);
      if (raw === null) return null;
      const session = parse(raw);
      // Un contenido dañado no sirve como sesión: se borra para empezar limpio.
      if (!session) await store.deleteItemAsync(KEY, options);
      return session;
    },
    write: (session) => store.setItemAsync(KEY, JSON.stringify(session), options),
    clear: () => store.deleteItemAsync(KEY, options),
  };
}
