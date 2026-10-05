import { createHash } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { HttpException } from '@nestjs/common';
import { loadEnv } from '../config.js';
import { BreachChecker } from './breach.js';
import { concurrencyLimit } from './passwords.js';
import { AccessTokens } from './tokens.js';

const base = {
  DATABASE_URL: 'postgres://nadie:nada@127.0.0.1:9/nada',
  REDIS_URL: 'redis://127.0.0.1:9',
  RATE_LIMIT_KEY_SECRET: 'falso-solo-para-pruebas-0123456789',
};

describe('claves de los tokens (AM-02)', () => {
  it('AM-02 fuera de local la API no arranca sin JWT_PRIVATE_KEY, JWT_PUBLIC_KEY ni REFRESH_TOKEN_PEPPER', () => {
    for (const APP_ENV of ['ci', 'staging', 'production']) {
      expect(() => loadEnv({ ...base, APP_ENV, TRUST_PROXY: '10.0.0.0/8' })).toThrow(
        /JWT_PRIVATE_KEY[\s\S]*JWT_PUBLIC_KEY[\s\S]*REFRESH_TOKEN_PEPPER/,
      );
    }
  });

  it.each([
    ['APP_ENV=production', { APP_ENV: 'production' }],
    ['NODE_ENV=production sin APP_ENV', { NODE_ENV: 'production' }],
    ['sin APP_ENV ni NODE_ENV', {}],
  ])('AM-02 con %s, las claves JWT ausentes o vacías impiden arrancar', (_name, environment) => {
    const keys = {
      TRUST_PROXY: '10.0.0.0/8',
      REFRESH_TOKEN_PEPPER: 'falsa-solo-para-pruebas-0123',
    };
    expect(() => loadEnv({ ...base, ...environment, ...keys })).toThrow(/JWT_PRIVATE_KEY/);
    expect(() =>
      loadEnv({ ...base, ...environment, ...keys, JWT_PRIVATE_KEY: '', JWT_PUBLIC_KEY: '' }),
    ).toThrow(/JWT_PRIVATE_KEY/);
  });

  it('AM-02 las claves vacías (como en .env.example) cuentan como ausentes', () => {
    const env = loadEnv({
      ...base,
      APP_ENV: 'local',
      JWT_PRIVATE_KEY: '',
      JWT_PUBLIC_KEY: '',
      REFRESH_TOKEN_PEPPER: '',
    });
    expect([env.JWT_PRIVATE_KEY, env.JWT_PUBLIC_KEY, env.REFRESH_TOKEN_PEPPER]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(() => loadEnv({ ...base, APP_ENV: 'ci', JWT_PRIVATE_KEY: '' })).toThrow(
      /JWT_PRIVATE_KEY/,
    );
  });

  it('AM-02 solo con APP_ENV=local escrito usa un par temporal, y nunca imprime las claves', async () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/JWT_PRIVATE_KEY/);
    const printed: string[] = [];
    const tokens = await AccessTokens.create(loadEnv({ ...base, APP_ENV: 'local' }), (message) =>
      printed.push(message),
    );
    const token = await tokens.sign('0190a3b4-0000-7000-8000-000000000001', 'disp-1');
    expect(await tokens.verify(token)).toEqual({
      userId: '0190a3b4-0000-7000-8000-000000000001',
      deviceId: 'disp-1',
    });
    expect(printed).toEqual([expect.stringContaining('par de claves temporal')]);
    expect(printed.join('\n')).not.toMatch(/-----BEGIN|"d":/);
  });
});

describe('límite de hashes de Argon2 simultáneos', () => {
  it('nunca corren más de los permitidos y, con la cola llena, responde 503 temporarily_unavailable', async () => {
    const limit = concurrencyLimit(2, 1);
    let running = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const work = () =>
      limit(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise<void>((resolve) => releases.push(resolve));
        running--;
      });
    const pending = [work(), work(), work()];
    await expect(work()).rejects.toMatchObject({ status: 503 });
    expect(peak).toBe(2);
    while (releases.length) {
      releases.shift()?.();
      await new Promise((resolve) => setImmediate(resolve));
    }
    await Promise.all(pending);
    expect(peak).toBe(2);
    const full = await limit(() => Promise.reject(new HttpException('x', 418))).catch(
      (error: unknown) => error,
    );
    expect(full).toBeInstanceOf(HttpException);
  });
});

describe('Have I Been Pwned (HU-01)', () => {
  const sha1 = (text: string) => createHash('sha1').update(text).digest('hex').toUpperCase();

  it('HU-01 envía solo el prefijo de 5 caracteres con relleno y detecta la contraseña filtrada', async () => {
    const password = 'contraseña-de-prueba-123';
    const digest = sha1(password);
    const calls: { url: string; padding: string | null }[] = [];
    const checker = new BreachChecker((url, init) => {
      calls.push({ url, padding: new Headers(init?.headers).get('Add-Padding') });
      return Promise.resolve(
        new Response(`${digest.slice(5)}:12\r\n0000000000000000000000000000000000A:0\r\n`),
      );
    });
    expect(await checker.isCompromised(password)).toBe(true);
    expect(calls).toEqual([
      { url: `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`, padding: 'true' },
    ]);
    expect(calls[0]?.url).not.toContain(digest.slice(5));
  });

  it('HU-01 las líneas de relleno (cuenta 0) no cuentan como filtrada', async () => {
    const password = 'otra-contraseña-larga';
    const checker = new BreachChecker(() =>
      Promise.resolve(new Response(`${sha1(password).slice(5)}:0\r\n`)),
    );
    expect(await checker.isCompromised(password)).toBe(false);
  });

  it('HU-01 si no responde o falla, se acepta, y el aviso no lleva la contraseña ni el prefijo', async () => {
    const password = 'contraseña-sin-red-123';
    const warnings: string[] = [];
    for (const fetchImpl of [
      () => Promise.reject(new Error('sin red')),
      () => Promise.resolve(new Response('error', { status: 503 })),
    ]) {
      const checker = new BreachChecker(fetchImpl, (message) => warnings.push(message));
      expect(await checker.isCompromised(password)).toBe(false);
    }
    expect(warnings).toHaveLength(2);
    expect(warnings.join('\n')).not.toContain(password);
    expect(warnings.join('\n')).not.toContain(sha1(password).slice(0, 5));
  });
});
