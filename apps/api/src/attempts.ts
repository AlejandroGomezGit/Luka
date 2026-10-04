import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Env } from './config.js';
import { ipBucket, keyHash } from './rate-limit.js';
import { RedisClient } from './redis.js';
import { ENV } from './tokens.js';

/** Segundos que se pide esperar cuando Redis no responde. */
const UNAVAILABLE_RETRY_AFTER_S = 30;

// Por cada par (contador, bloqueo): sube el contador y, desde el tope, bloquea con una espera que se
// duplica en cada fallo siguiente, hasta el máximo. Un solo script: los fallos simultáneos no se pisan
// y toda clave expira. El contador vive al menos lo que dura el bloqueo, para que la espera siga creciendo.
const RECORD_FAILURE = `
local window, base, cap = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
for i = 1, #KEYS, 2 do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('PEXPIRE', KEYS[i], window) end
  local max = tonumber(ARGV[3 + (i + 1) / 2])
  if count >= max then
    local lock = math.floor(math.min(base * 2 ^ (count - max), cap))
    redis.call('SET', KEYS[i + 1], 1, 'PX', lock)
    if redis.call('PTTL', KEYS[i]) < lock + window then
      redis.call('PEXPIRE', KEYS[i], lock + window)
    end
  end
end
`;

/**
 * Intentos fallidos de credenciales (AM-01, ADR-015), por cuenta e IP, por cuenta desde todas las IP
 * y por IP sobre todas las cuentas. No sabe si la cuenta existe: un correo inexistente cuenta igual.
 */
@Injectable()
export class AttemptLimiter {
  private readonly logger = new Logger(AttemptLimiter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly redis: RedisClient,
  ) {}

  /** 429 too_many_attempts si algún contador está bloqueado; 503 si Redis no responde. */
  async assertAllowed(email: string, ip: string): Promise<void> {
    const locks = this.scopes(email, ip).map(({ id }) => `luka:bloqueo:${id}`);
    const waits = await this.orUnavailable(() =>
      Promise.all(locks.map((key) => this.redis.pttl(key))),
    );
    const wait = Math.max(...waits);
    if (wait > 0) {
      throw new HttpException(
        { code: 'too_many_attempts', retryAfterSeconds: Math.ceil(wait / 1000) },
        429,
      );
    }
  }

  async recordFailure(email: string, ip: string): Promise<void> {
    const scopes = this.scopes(email, ip);
    const keys = scopes.flatMap(({ id }) => [`luka:intentos:${id}`, `luka:bloqueo:${id}`]);
    const { LOGIN_ATTEMPTS_WINDOW_MS, LOGIN_LOCK_BASE_MS, LOGIN_LOCK_MAX_MS } = this.env;
    await this.orUnavailable(() =>
      this.redis.eval(
        RECORD_FAILURE,
        keys.length,
        ...keys,
        LOGIN_ATTEMPTS_WINDOW_MS,
        LOGIN_LOCK_BASE_MS,
        LOGIN_LOCK_MAX_MS,
        ...scopes.map(({ max }) => max),
      ),
    );
  }

  /** Un acierto reinicia el contador de esa cuenta e IP; los otros dos siguen contando. */
  async recordSuccess(email: string, ip: string): Promise<void> {
    const [accountAndIp] = this.scopes(email, ip);
    try {
      await this.redis.del(`luka:intentos:${accountAndIp?.id ?? ''}`);
    } catch {
      // La persona ya demostró sus credenciales: no se le niega la entrada por esto.
      this.logger.warn('Intentos de credenciales sin Redis: no se reinició un contador.');
    }
  }

  private scopes(email: string, ip: string): { id: string; max: number }[] {
    const account = keyHash(this.env.RATE_LIMIT_KEY_SECRET, email.trim().toLowerCase());
    const network = keyHash(this.env.RATE_LIMIT_KEY_SECRET, ipBucket(ip));
    return [
      { id: `cuenta-ip:${account}:${network}`, max: this.env.LOGIN_ATTEMPTS_MAX },
      { id: `cuenta:${account}`, max: this.env.LOGIN_ACCOUNT_ATTEMPTS_MAX },
      { id: `ip:${network}`, max: this.env.LOGIN_IP_ATTEMPTS_MAX },
    ];
  }

  /** Sin Redis no hay freno a la fuerza bruta: se niega con 503 en vez de dejar pasar (ADR-015). */
  private async orUnavailable<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch {
      this.logger.warn('Intentos de credenciales sin Redis: se responde 503 hasta que vuelva.');
      throw new HttpException(
        { code: 'temporarily_unavailable', retryAfterSeconds: UNAVAILABLE_RETRY_AFTER_S },
        503,
      );
    }
  }
}
