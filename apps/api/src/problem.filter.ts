import type { Problem } from '@luka/contracts';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { STATUS_CODES } from 'node:http';

/** Códigos estables por estado HTTP; una excepción puede traer su propio `code`. */
const CODES: Record<number, string> = {
  400: 'validation_failed',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  429: 'rate_limited',
};

/** Convierte cualquier error en problem+json (regla 9); un 500 nunca expone detalles internos. */
export function toProblem(exception: unknown): Problem {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const ownCode =
      typeof body === 'object' && 'code' in body && typeof body.code === 'string'
        ? body.code
        : undefined;
    return {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      code: ownCode ?? CODES[status] ?? 'http_error',
    };
  }
  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    code: 'internal_error',
  };
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = toProblem(exception);
    if (problem.status >= 500) this.logger.error(exception);
    void host
      .switchToHttp()
      .getResponse<FastifyReply>()
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }
}
