import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Env } from './config.js';
import { ENV } from './tokens.js';

/** La conexión a Redis de toda la API: /readyz, el límite de tasa y los intentos de credenciales. */
@Injectable()
export class RedisClient extends Redis implements OnApplicationShutdown {
  constructor(@Inject(ENV) env: Env) {
    super(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    // Una caída la reportan /readyz y los límites; sin este listener ioredis imprime cada reintento.
    this.on('error', () => undefined);
  }

  onApplicationShutdown(): void {
    this.disconnect();
  }
}
