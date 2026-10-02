import type { Health, Readiness } from '@luka/contracts';
import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Datastores } from './datastores.js';

const CHECK_TIMEOUT_MS = 2_000;

type CheckStatus = Readiness['checks']['postgres'];

async function check(probe: () => Promise<void>): Promise<CheckStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('timeout'));
    }, CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([probe(), timeout]);
    return 'ok';
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

/** Salud del proceso y de sus dependencias, fuera de /v1 (documento 04). */
@Controller()
export class HealthController {
  constructor(private readonly datastores: Datastores) {}

  @Get('healthz')
  health(): Health {
    return { status: 'ok' };
  }

  @Get('readyz')
  async ready(@Res({ passthrough: true }) reply: FastifyReply): Promise<Readiness> {
    const [postgres, redis] = await Promise.all([
      check(() => this.datastores.pingPostgres()),
      check(() => this.datastores.pingRedis()),
    ]);
    const status = postgres === 'ok' && redis === 'ok' ? 'ok' : 'error';
    if (status === 'error') void reply.status(503);
    return { status, checks: { postgres, redis } };
  }
}
