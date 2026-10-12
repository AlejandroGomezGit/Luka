import type { Problem } from '@luka/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AccessTokens } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Dispositivo del token de acceso (T-019). */
    deviceId?: string;
  }
}

/**
 * Rutas que no piden sesión, una por una: toda ruta nueva es privada mientras no se agregue aquí.
 * Una ruta inexistente sigue en 404.
 */
export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  'GET /healthz',
  'GET /readyz',
  'POST /v1/auth/register',
  'POST /v1/auth/login',
  'POST /v1/auth/refresh',
]);

const unauthorized: Problem = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  code: 'unauthorized',
};

/** Verifica el token de acceso al recibir la petición, antes del límite por usuario (preHandler). */
export function registerAccess(
  app: NestFastifyApplication,
  extraPublic: readonly string[] = [],
): void {
  const tokens = app.get(AccessTokens);
  const open = new Set([...PUBLIC_ROUTES, ...extraPublic]);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (req, reply) => {
      const route = req.routeOptions.url;
      if (route === undefined || open.has(`${req.method} ${route}`)) return undefined;
      const header = req.headers.authorization;
      try {
        if (!header?.startsWith('Bearer ')) throw new Error('sin token');
        const { userId, deviceId } = await tokens.verify(header.slice('Bearer '.length));
        req.userId = userId;
        req.deviceId = deviceId;
        return undefined;
      } catch {
        return reply
          .code(401)
          .header('content-type', 'application/problem+json')
          .send(unauthorized);
      }
    });
}
