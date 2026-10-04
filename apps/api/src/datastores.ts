import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Env } from './config.js';
import { Database } from './db/database.js';
import { ENV } from './tokens.js';

/** Comprobaciones de PostgreSQL y Redis para /readyz; las pruebas la reemplazan por una falsa. */
@Injectable()
export class Datastores implements OnApplicationShutdown {
  readonly redis: Redis;

  constructor(
    @Inject(ENV) env: Env,
    private readonly database: Database,
  ) {
    this.redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    // Una caída de Redis la reporta /readyz; sin este listener ioredis imprime cada reintento.
    this.redis.on('error', () => undefined);
  }

  async pingPostgres(): Promise<void> {
    await this.database.ping();
  }

  async pingRedis(): Promise<void> {
    await this.redis.ping();
  }

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
