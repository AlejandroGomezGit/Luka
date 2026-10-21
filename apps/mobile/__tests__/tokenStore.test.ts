import {
  secureTokenStore,
  type SecureStoreModule,
  type StoredSession,
} from '../src/auth/tokenStore';

/** Keychain en memoria: guarda cada valor y las opciones con las que se escribió, leyó o borró. */
function fakeKeychain() {
  const items = new Map<string, string>();
  const calls: { op: string; key: string; options: unknown }[] = [];
  const module: SecureStoreModule = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    getItemAsync: (key, options) => {
      calls.push({ op: 'get', key, options });
      return Promise.resolve(items.get(key) ?? null);
    },
    setItemAsync: (key, value, options) => {
      calls.push({ op: 'set', key, options });
      items.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key, options) => {
      calls.push({ op: 'delete', key, options });
      items.delete(key);
      return Promise.resolve();
    },
  };
  return { module, items, calls };
}

// Valores armados en la prueba: no son tokens reales y no se parecen a uno.
const session: StoredSession = {
  accessToken: ['acceso', 'de', 'prueba'].join('-'),
  refreshToken: ['refresco', 'de', 'prueba'].join('-'),
  accessExpiresAt: Date.UTC(2026, 9, 21, 18),
};

describe('T-019c1a tokens en el Keychain', () => {
  it('los dos tokens y el vencimiento van en un solo elemento, con WHEN_UNLOCKED_THIS_DEVICE_ONLY', async () => {
    const keychain = fakeKeychain();
    const store = secureTokenStore(keychain.module);
    await store.write(session);
    expect([...keychain.items.keys()]).toEqual(['luka.sesion']);
    expect(JSON.parse(keychain.items.get('luka.sesion') ?? '')).toEqual(session);
    expect(await store.read()).toEqual(session);
    await store.clear();
    expect(keychain.items.size).toBe(0);
    expect(await store.read()).toBeNull();
    // Cada operación usa la misma clave y la misma accesibilidad.
    expect(new Set(keychain.calls.map((call) => call.key))).toEqual(new Set(['luka.sesion']));
    for (const call of keychain.calls) {
      expect(call.options).toEqual({
        keychainAccessible: keychain.module.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  });

  it('un contenido dañado se trata como «sin sesión» y se borra', async () => {
    for (const damaged of [
      'no es json',
      '{}',
      JSON.stringify({ ...session, accessExpiresAt: 'mañana' }),
    ]) {
      const keychain = fakeKeychain();
      keychain.items.set('luka.sesion', damaged);
      expect(await secureTokenStore(keychain.module).read()).toBeNull();
      expect(keychain.items.size).toBe(0);
    }
  });

  it('ningún token aparece en la consola al escribir, leer, borrar o encontrar un valor dañado', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    const keychain = fakeKeychain();
    const store = secureTokenStore(keychain.module);
    await store.write(session);
    await store.read();
    keychain.items.set('luka.sesion', `${session.refreshToken} dañado`);
    await store.read();
    await store.clear();
    const printed = spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join('\n');
    expect(printed).not.toContain(session.accessToken);
    expect(printed).not.toContain(session.refreshToken);
    for (const spy of spies) spy.mockRestore();
  });
});
