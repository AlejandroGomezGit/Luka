import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  // expo: además de los .sql genera migrations.js, que la app incluye en su paquete (T-010).
  driver: 'expo',
  schema: './src/schema.ts',
  out: './drizzle',
});
