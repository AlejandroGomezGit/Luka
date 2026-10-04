import { Injectable } from '@nestjs/common';
import { Database } from './db/database.js';
import { RedisClient } from './redis.js';

/** Comprobaciones de PostgreSQL y Redis para /readyz; las pruebas la reemplazan por una falsa. */
@Injectable()
export class Datastores {
  constructor(
    private readonly database: Database,
    private readonly redis: RedisClient,
  ) {}

  async pingPostgres(): Promise<void> {
    await this.database.ping();
  }

  async pingRedis(): Promise<void> {
    await this.redis.ping();
  }
}
