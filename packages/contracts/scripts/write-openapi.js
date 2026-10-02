// Regenera openapi.json desde los esquemas compilados: pnpm --filter @luka/contracts openapi
import { writeFileSync } from 'node:fs';
import { buildOpenApi } from '../dist/index.js';

writeFileSync(
  `${import.meta.dirname}/../openapi.json`,
  `${JSON.stringify(buildOpenApi(), null, 2)}\n`,
);
