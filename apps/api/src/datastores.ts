import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import { ENV } from './tokens.js';
import type { Env } from './config.js';

/** Conexiones a PostgreSQL y Redis; las pruebas la reemplazan por una falsa. */
@Injectable()
export class Datastores implements OnApplicationShutdown {
  readonly sql: postgres.Sql;
  readonly redis: Redis;

  constructor(@Inject(ENV) env: Env) {
    this.sql = postgres(env.DATABASE_URL, { max: 10 });
    this.redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    // Una caída de Redis la reporta /readyz; sin este listener ioredis imprime cada reintento.
    this.redis.on('error', () => undefined);
  }

  async pingPostgres(): Promise<void> {
    await this.sql`select 1`;
  }

  async pingRedis(): Promise<void> {
    await this.redis.ping();
  }

  async onApplicationShutdown(): Promise<void> {
    this.redis.disconnect();
    await this.sql.end({ timeout: 5 });
  }
}
