import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule, configureApp, createAdapter } from './app.module.js';
import { loadEnv, startupWarnings } from './config.js';

const env = loadEnv();
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule.forRoot(env),
  createAdapter(env),
  { bufferLogs: true },
);
const logger = app.get(Logger);
app.useLogger(logger);
for (const warning of startupWarnings(env)) logger.warn(warning);
await (await configureApp(app)).listen(env.PORT, '0.0.0.0');
