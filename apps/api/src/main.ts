import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule, configureApp, createAdapter } from './app.module.js';
import { loadEnv } from './config.js';

const env = loadEnv();
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule.forRoot(env),
  createAdapter(),
  { bufferLogs: true },
);
app.useLogger(app.get(Logger));
await configureApp(app).listen(env.PORT, '0.0.0.0');
