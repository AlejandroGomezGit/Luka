import { LoginRequest, RefreshRequest, RegisterRequest, type TokenPair } from '@luka/contracts';
import { Body, Controller, HttpCode, HttpException, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { AuthService } from './auth.service.js';

function parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpException({ code: 'validation_failed' }, 400);
  return result.data;
}

/** /v1/auth (T-019, documento 04). register, login y refresh son públicas (access.ts). */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() body: unknown): Promise<TokenPair> {
    return this.auth.register(parse(RegisterRequest, body));
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Req() req: FastifyRequest): Promise<TokenPair> {
    return this.auth.login(parse(LoginRequest, body), req.ip);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown): Promise<TokenPair> {
    return this.auth.refresh(parse(RefreshRequest, body).refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: FastifyRequest): Promise<void> {
    if (req.userId === undefined || req.deviceId === undefined) {
      throw new HttpException({ code: 'unauthorized' }, 401);
    }
    await this.auth.logout(req.userId, req.deviceId);
  }
}
