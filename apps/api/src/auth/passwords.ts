import { hash, verify } from '@node-rs/argon2';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { Env } from '../config.js';
import { ENV } from '../tokens.js';

// Argon2id (el algoritmo por defecto de @node-rs/argon2) con la configuración mínima de la hoja de
// OWASP, verificada el 2026-10-05: 19 MiB, 2 iteraciones y 1 de paralelismo.
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };
const MAX_QUEUE = 32;

/**
 * Corre como mucho `max` trabajos a la vez; los demás esperan en una cola de `maxQueue`. Con la cola
 * llena responde 503: Argon2 usa 19 MiB por hash y una ráfaga de inicios de sesión no debe agotar la
 * memoria de la API.
 */
export function concurrencyLimit(max: number, maxQueue: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(work: () => Promise<T>): Promise<T> => {
    if (active < max) active++;
    else {
      if (queue.length >= maxQueue) {
        throw new HttpException({ code: 'temporarily_unavailable', retryAfterSeconds: 5 }, 503);
      }
      // El cupo pasa directo del que termina al siguiente de la cola.
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    try {
      return await work();
    } finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  };
}

@Injectable()
export class PasswordHasher {
  readonly #limit: ReturnType<typeof concurrencyLimit>;
  #dummy: Promise<string> | undefined;

  constructor(@Inject(ENV) env: Env) {
    this.#limit = concurrencyLimit(env.ARGON2_MAX_CONCURRENT, MAX_QUEUE);
  }

  hash(password: string): Promise<string> {
    return this.#limit(() => hash(password, ARGON2));
  }

  /**
   * Sin cuenta (`stored` nulo) verifica igual contra un hash de relleno: el tiempo de respuesta no
   * revela si el correo existe (AM-01).
   */
  async verify(stored: string | null, password: string): Promise<boolean> {
    this.#dummy ??= this.hash('relleno-para-correos-que-no-existen');
    const target = stored ?? (await this.#dummy);
    const matches = await this.#limit(() => verify(target, password));
    return stored !== null && matches;
  }
}
