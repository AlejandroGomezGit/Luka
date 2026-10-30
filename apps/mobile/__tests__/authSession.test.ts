import {
  CONSENT_VERSION,
  LoginRequest,
  Problem,
  RegisterRequest,
  TokenPair,
} from '@luka/contracts';
import { authMessage } from '../src/auth/messages';
import { createAuthSession, type AuthError } from '../src/auth/session';
import type { StoredSession, TokenStore } from '../src/auth/tokenStore';

// Valores armados en la prueba: no son tokens reales.
const pair = (n: number) =>
  TokenPair.parse({
    accessToken: `acceso-${String(n)}`,
    refreshToken: `refresco-${String(n)}`,
    expiresIn: 900,
  });
const problem = (status: number, code: string) =>
  Problem.parse({ type: 'about:blank', title: 'Error', status, code });
const NOW = Date.UTC(2026, 9, 29, 15);
const email = ['persona', 'ejemplo.co'].join('@');
const password = ['clave', 'larga', 'de', 'prueba'].join('-');

interface Reply {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}
interface Call {
  path: string;
  body: unknown;
  authorization: string | null;
}

/** API falsa: cada respuesta sale de los esquemas de @luka/contracts; anota cada llamada. */
function fakeApi(reply: (call: Call) => Reply | Promise<Reply> | 'offline') {
  const calls: Call[] = [];
  // El cliente siempre llama con una URL en texto.
  const fetch = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call: Call = {
      path: new URL(url).pathname,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
      authorization: headers.get('authorization'),
    };
    calls.push(call);
    const result = await reply(call);
    if (result === 'offline') throw new TypeError('Network request failed');
    return new Response(result.body === undefined ? null : JSON.stringify(result.body), {
      status: result.status,
      headers: { 'content-type': 'application/json', ...result.headers },
    });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

function memoryTokens(initial: StoredSession | null = null) {
  let stored = initial;
  const store: TokenStore = {
    read: () => Promise.resolve(stored),
    write: (value) => {
      stored = value;
      return Promise.resolve();
    },
    clear: () => {
      stored = null;
      return Promise.resolve();
    },
  };
  return { store, stored: () => stored };
}

/** Dispositivo falso: renew() entrega otro id, como renewDeviceId en device_profile. */
function fakeDevice() {
  const ids = ['0199a6f0-0000-7000-8000-0000000000d1', '0199a6f0-0000-7000-8000-0000000000d2'];
  let renewals = 0;
  return {
    id: () => ids[Math.min(renewals, 1)] ?? '',
    renew: () => {
      renewals++;
      return ids[1] ?? '';
    },
    renewals: () => renewals,
  };
}

function setup(reply: Parameters<typeof fakeApi>[0], initial: StoredSession | null = null) {
  const api = fakeApi(reply);
  const tokens = memoryTokens(initial);
  const device = fakeDevice();
  const session = createAuthSession({
    baseUrl: 'https://api.ejemplo.co',
    fetch: api.fetch,
    tokens: tokens.store,
    clock: { now: () => NOW },
    device,
    appVersion: '0.1.0',
  });
  return { session, calls: api.calls, tokens, device };
}

const registerInput = {
  userId: '0199a6f0-0000-7000-8000-000000000001',
  email,
  password,
  consents: { version: CONSENT_VERSION, terms: true, privacy: true, adult: true },
};

describe('HU-01 cliente de /v1/auth: registro e inicio de sesión', () => {
  it('HU-01 el registro envía un cuerpo válido según RegisterRequest y guarda el par con su vencimiento', async () => {
    const { session, calls, tokens } = setup((call) => {
      RegisterRequest.parse(call.body);
      return { status: 201, body: pair(1) };
    });
    expect(await session.register(registerInput)).toEqual({ ok: true });
    expect(calls.map((call) => call.path)).toEqual(['/v1/auth/register']);
    expect(tokens.stored()).toEqual({
      accessToken: 'acceso-1',
      refreshToken: 'refresco-1',
      accessExpiresAt: NOW + 900 * 1000,
    });
    expect(await session.isSignedIn()).toBe(true);
  });

  it('HU-01 el inicio de sesión envía un cuerpo válido según LoginRequest y guarda el par', async () => {
    const { session, calls, tokens } = setup((call) => {
      LoginRequest.parse(call.body);
      return { status: 200, body: pair(2) };
    });
    expect(await session.login({ email, password })).toEqual({ ok: true });
    expect(calls.map((call) => call.path)).toEqual(['/v1/auth/login']);
    expect(tokens.stored()?.accessExpiresAt).toBe(NOW + 900 * 1000);
  });

  it('HU-01 un cuerpo que no cumple el contrato no sale del iPhone: validation_failed', async () => {
    const { session, calls } = setup(() => ({ status: 201, body: pair(1) }));
    expect(await session.register({ ...registerInput, email: 'no es un correo' })).toEqual({
      ok: false,
      error: 'validation_failed',
    });
    expect(calls).toEqual([]);
  });
});

describe('HU-01 device_unavailable: id de dispositivo nuevo y un solo reintento', () => {
  it('HU-01 el primer device_unavailable cambia el id del dispositivo y reintenta con él', async () => {
    let attempt = 0;
    const { session, calls, device } = setup(() =>
      ++attempt === 1
        ? { status: 409, body: problem(409, 'device_unavailable') }
        : { status: 201, body: pair(6) },
    );
    expect(await session.register(registerInput)).toEqual({ ok: true });
    expect(device.renewals()).toBe(1);
    const sent = calls.map((call) => RegisterRequest.parse(call.body).deviceId);
    expect(sent).toEqual([
      '0199a6f0-0000-7000-8000-0000000000d1',
      '0199a6f0-0000-7000-8000-0000000000d2',
    ]);
  });

  it('HU-01 un segundo device_unavailable termina en error, sin bucle', async () => {
    const { session, calls, device, tokens } = setup(() => ({
      status: 409,
      body: problem(409, 'device_unavailable'),
    }));
    expect(await session.login({ email, password })).toEqual({
      ok: false,
      error: 'device_unavailable',
    });
    expect(device.renewals()).toBe(1);
    expect(calls).toHaveLength(2);
    expect(tokens.stored()).toBeNull();
  });
});

// Una prueba por código: el resultado con tipo y su mensaje en español.
const cases: [number, string, AuthError, string][] = [
  [
    400,
    'consent_required',
    'consent_required',
    'Para crear la cuenta tienes que aceptar los términos y la autorización de datos.',
  ],
  [
    400,
    'age_confirmation_required',
    'age_confirmation_required',
    'Para crear la cuenta tienes que confirmar que tienes 18 años o más.',
  ],
  [
    400,
    'password_too_short',
    'password_too_short',
    'La contraseña debe tener al menos 10 caracteres.',
  ],
  [
    400,
    'password_compromised',
    'password_compromised',
    'Esa contraseña aparece en filtraciones conocidas. Elige otra.',
  ],
  [409, 'email_taken', 'email_taken', 'Ese correo ya tiene una cuenta. Puedes iniciar sesión.'],
  [
    409,
    'user_id_unavailable',
    'user_id_unavailable',
    'No se pudo crear la cuenta desde este iPhone. Inténtalo de nuevo.',
  ],
  [
    409,
    'device_unavailable',
    'device_unavailable',
    'No se pudo registrar este iPhone. Inténtalo de nuevo.',
  ],
  [401, 'invalid_credentials', 'invalid_credentials', 'Correo o contraseña incorrectos.'],
  [
    429,
    'rate_limited',
    'rate_limited',
    'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
  ],
  [
    503,
    'temporarily_unavailable',
    'temporarily_unavailable',
    'El servicio no está disponible en este momento. Inténtalo más tarde.',
  ],
  [
    500,
    'internal_error',
    'temporarily_unavailable',
    'El servicio no está disponible en este momento. Inténtalo más tarde.',
  ],
  [400, 'validation_failed', 'validation_failed', 'Revisa los datos e inténtalo de nuevo.'],
  [418, 'algo_nuevo', 'unknown', 'Algo salió mal. Inténtalo de nuevo.'],
];

describe('HU-01 cada código del servidor da su resultado y su mensaje', () => {
  it.each(cases)('HU-01 %i %s → %s', async (status, code, error, message) => {
    const { session, tokens } = setup(() => ({ status, body: problem(status, code) }));
    const result = await session.register(registerInput);
    expect(result).toEqual({ ok: false, error });
    expect(authMessage(error)).toBe(message);
    expect(tokens.stored()).toBeNull();
  });

  it('HU-01 un 502 sin cuerpo es «no disponible»', async () => {
    const { session } = setup(() => ({ status: 502 }));
    expect(await session.login({ email, password })).toEqual({
      ok: false,
      error: 'temporarily_unavailable',
    });
  });

  it('HU-01 sin conexión: el mensaje de las pantallas de cuenta', async () => {
    const { session } = setup(() => 'offline');
    expect(await session.login({ email, password })).toEqual({ ok: false, error: 'offline' });
    expect(authMessage('offline')).toBe(
      'Sin conexión. Crear la cuenta o iniciar sesión necesita internet.',
    );
  });

  it('HU-01 too_many_attempts trae los segundos de Retry-After y el mensaje los redondea hacia arriba a minutos', async () => {
    const { session } = setup(() => ({
      status: 429,
      body: problem(429, 'too_many_attempts'),
      headers: { 'retry-after': '61' },
    }));
    expect(await session.login({ email, password })).toEqual({
      ok: false,
      error: 'too_many_attempts',
      retryAfterSeconds: 61,
    });
    expect(authMessage('too_many_attempts', 61)).toBe(
      'Demasiados intentos. Espera 2 minutos y vuelve a intentarlo.',
    );
    expect(authMessage('too_many_attempts', 60)).toBe(
      'Demasiados intentos. Espera 1 minuto y vuelve a intentarlo.',
    );
    expect(authMessage('too_many_attempts', 1)).toBe(
      'Demasiados intentos. Espera 1 minuto y vuelve a intentarlo.',
    );
  });

  it('HU-01 too_many_attempts sin Retry-After o con uno inválido usa «unos minutos»', async () => {
    for (const header of [undefined, 'pronto', '-5', '0', 'Wed, 21 Oct 2026 07:28:00 GMT']) {
      const { session } = setup(() => ({
        status: 429,
        body: problem(429, 'too_many_attempts'),
        ...(header === undefined ? {} : { headers: { 'retry-after': header } }),
      }));
      const result = await session.login({ email, password });
      expect(result).toEqual({ ok: false, error: 'too_many_attempts' });
    }
    expect(authMessage('too_many_attempts')).toBe(
      'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    );
  });
});

describe('HU-01 cierre de sesión', () => {
  const stored: StoredSession = {
    accessToken: 'acceso-guardado',
    refreshToken: 'refresco-guardado',
    accessExpiresAt: NOW + 600_000,
  };

  it('HU-01 vacía memoria y Keychain antes de POST /logout, y no espera a la red', async () => {
    let seenAtLogout: StoredSession | null | undefined;
    let releaseLogout: () => void = () => undefined;
    const { session, calls, tokens } = setup(async (call) => {
      if (call.path === '/v1/auth/login') return { status: 200, body: pair(3) };
      seenAtLogout = tokens.stored();
      // La revocación queda colgada: el cierre local no la espera.
      await new Promise<void>((resolve) => (releaseLogout = resolve));
      return { status: 204 };
    });
    await session.login({ email, password });
    const { revocation } = await session.logout();
    expect(await session.isSignedIn()).toBe(false);
    expect(tokens.stored()).toBeNull();
    expect(seenAtLogout).toBeNull();
    expect(calls.at(-1)).toMatchObject({
      path: '/v1/auth/logout',
      authorization: 'Bearer acceso-3',
    });
    releaseLogout();
    await revocation;
  });

  it('HU-01 si POST /logout falla por falta de red, la sesión queda cerrada y no se reintenta', async () => {
    const { session, calls } = setup((call) =>
      call.path === '/v1/auth/logout' ? 'offline' : { status: 200, body: pair(4) },
    );
    await session.login({ email, password });
    const { revocation } = await session.logout();
    await expect(revocation).resolves.toBeUndefined();
    expect(await session.isSignedIn()).toBe(false);
    expect(calls.filter((call) => call.path === '/v1/auth/logout')).toHaveLength(1);
  });

  it('HU-01 POST /logout tiene tiempo límite: si no responde, se abandona sin reintentar', async () => {
    jest.useFakeTimers();
    try {
      let aborted = false;
      const tokens = memoryTokens(stored);
      const hanging = (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('abortada'));
          });
        });
      const session = createAuthSession({
        baseUrl: 'https://api.ejemplo.co',
        fetch: jest.fn(hanging) as typeof globalThis.fetch,
        tokens: tokens.store,
        clock: { now: () => NOW },
        device: fakeDevice(),
        appVersion: '0.1.0',
        logoutTimeoutMs: 5_000,
      });
      const { revocation } = await session.logout();
      expect(tokens.stored()).toBeNull();
      jest.advanceTimersByTime(5_000);
      await expect(revocation).resolves.toBeUndefined();
      expect(aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('HU-01 después de un reinicio (memoria vacía) lee el token del Keychain antes de borrarlo y revoca igual', async () => {
    const { session, calls, tokens } = setup(() => ({ status: 204 }), stored);
    const { revocation } = await session.logout();
    await revocation;
    expect(tokens.stored()).toBeNull();
    expect(calls).toEqual([
      { path: '/v1/auth/logout', body: null, authorization: 'Bearer acceso-guardado' },
    ]);
  });

  it('HU-01 sin sesión, cerrar sesión no llama a la red', async () => {
    const { session, calls } = setup(() => ({ status: 204 }));
    await (
      await session.logout()
    ).revocation;
    expect(calls).toEqual([]);
  });
});

it('HU-01 ningún token, contraseña ni correo aparece en la consola ni en los resultados', async () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
    jest.spyOn(console, method).mockImplementation(() => undefined),
  );
  const results: unknown[] = [];
  const ok = setup(() => ({ status: 200, body: pair(5) }));
  results.push(await ok.session.login({ email, password }));
  await (
    await ok.session.logout()
  ).revocation;
  for (const [status, code] of cases.map(([s, c]) => [s, c] as const)) {
    results.push(
      await setup(() => ({ status, body: problem(status, code) })).session.register(registerInput),
    );
  }
  results.push(await setup(() => 'offline').session.login({ email, password }));
  const printed = spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join('\n');
  const returned = JSON.stringify(results);
  for (const secret of ['acceso-5', 'refresco-5', password, email]) {
    expect(printed).not.toContain(secret);
    expect(returned).not.toContain(secret);
  }
  for (const spy of spies) spy.mockRestore();
});
