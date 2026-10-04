import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Env } from './config.js';
import { ENV } from './tokens.js';

/** La conexión a Redis de toda la API: /readyz, el límite de tasa y los intentos de credenciales. */
@Injectable()
export class RedisClient extends Redis implements OnApplicationShutdown {
  constructor(@Inject(ENV) env: Env) {
    // disconnectTimeout: si Redis ya cayó, ioredis 6 arma al cerrar un temporizador que nunca cancela y
    // retiene el proceso todo ese tiempo (2 s por defecto, DT-10). Con un socket sano no se espera.
    super(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, disconnectTimeout: 200 });
    // Una caída la reportan /readyz y los límites; sin este listener ioredis imprime cada reintento.
    this.on('error', () => undefined);
  }

  onApplicationShutdown(): void {
    this.disconnect();
  }
}
