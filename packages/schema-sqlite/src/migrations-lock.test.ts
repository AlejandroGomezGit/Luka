import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Una migración que ya está en un commit nunca se edita ni se regenera: se crea otra (CLAUDE.md). Si se
 * regenera, cambia su `when` y el migrador de Drizzle, que solo compara esa hora, la vuelve a aplicar en
 * las bases que ya la tenían. Esta prueba compara cada migración publicada con su hash y su hora.
 */
interface Journal {
  entries: { tag: string; when: number }[];
}
type Lock = Record<string, { when: number; sha256: string }>;

const root = path.resolve(__dirname, '../../..');
const folders = { sqlite: 'packages/schema-sqlite/drizzle', pg: 'packages/schema-pg/drizzle' };

function current(): Lock {
  const lock: Lock = {};
  for (const [name, folder] of Object.entries(folders)) {
    const journal = JSON.parse(
      readFileSync(path.join(root, folder, 'meta/_journal.json'), 'utf8'),
    ) as Journal;
    for (const { tag, when } of journal.entries) {
      const sql = readFileSync(path.join(root, folder, `${tag}.sql`));
      lock[`${name}/${tag}`] = { when, sha256: createHash('sha256').update(sql).digest('hex') };
    }
  }
  return lock;
}

describe('migraciones publicadas', () => {
  const published = JSON.parse(
    readFileSync(path.join(root, 'migrations.lock.json'), 'utf8'),
  ) as Lock;

  it('ninguna migración publicada cambió su SQL ni su hora en el journal', () => {
    const now = current();
    for (const [tag, expected] of Object.entries(published)) {
      expect({ tag, ...now[tag] }).toEqual({ tag, ...expected });
    }
  });

  it('cada migración nueva se agrega a migrations.lock.json en el mismo PR', () => {
    expect(Object.keys(current()).sort()).toEqual(Object.keys(published).sort());
  });
});
