import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

interface Journal {
  entries: { tag: string }[];
}

const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as Journal;

/** Aplica las migraciones del journal en orden, desde `from` (incluida) hasta `to` (excluida). */
function migrate(db: DatabaseSync, from = 0, to = journal.entries.length) {
  for (const { tag } of journal.entries.slice(from, to)) {
    for (const statement of readFileSync(`drizzle/${tag}.sql`, 'utf8').split(
      '--> statement-breakpoint',
    )) {
      db.exec(statement);
    }
  }
}

// Base SQLite vacía en memoria con todas las migraciones aplicadas desde cero, en el orden del journal.
function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

const now = Date.UTC(2026, 9, 2, 12);
const sync = { user_id: 'u1', created_at: now, updated_at: now };

function seeded() {
  const db = freshDb();
  const account = db.prepare(
    `insert into accounts (id, user_id, created_at, updated_at, name, type, currency, color, icon)
     values (?, ?, ?, ?, ?, 'cash', 'COP', 'green', 'wallet')`,
  );
  account.run('cash', sync.user_id, now, now, 'Efectivo');
  account.run('bank', sync.user_id, now, now, 'Banco');
  return db;
}

let txId = 0;
function insertTx(db: DatabaseSync, patch: Record<string, string | number | null> = {}) {
  const row: Record<string, string | number | null> = {
    ...sync,
    id: `t${String(++txId)}`,
    account_id: 'cash',
    kind: 'expense',
    amount_minor: -1_250_000,
    currency: 'COP',
    occurred_on: '2026-10-01',
    ...patch,
  };
  const columns = Object.keys(row);
  return db
    .prepare(
      `insert into transactions (${columns.join(', ')}) values (${columns.map(() => '?').join(', ')})`,
    )
    .run(...Object.values(row));
}

describe('migraciones de SQLite', () => {
  it('se aplican desde cero y crean las tablas sincronizables', () => {
    const db = seeded();
    insertTx(db);
    expect(db.prepare('select tags, review_status, field_clocks from transactions').get()).toEqual({
      tags: '[]',
      review_status: 'confirmed',
      field_clocks: '{}',
    });
  });

  it('la última migración se aplica desde la versión anterior sin perder datos', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db, 0, journal.entries.length - 1);
    db.prepare(
      `insert into accounts (id, user_id, created_at, updated_at, name, type, currency, color, icon)
       values ('cash', 'u1', ?, ?, 'Efectivo', 'cash', 'COP', 'green', 'wallet')`,
    ).run(now, now);
    migrate(db, journal.entries.length - 1);
    expect(db.prepare('select name from accounts').all()).toEqual([{ name: 'Efectivo' }]);
    db.prepare('insert into device_profile (device_id, user_id, created_at) values (?, ?, ?)').run(
      'd1',
      'u1',
      now,
    );
  });

  it('INV-01 el CHECK rechaza montos en cero o con el signo contrario al tipo', () => {
    const db = seeded();
    expect(() => insertTx(db, { amount_minor: 0 })).toThrow(/CHECK/);
    expect(() => insertTx(db, { amount_minor: 500 })).toThrow(/CHECK/);
    expect(() => insertTx(db, { kind: 'income', amount_minor: -500 })).toThrow(/CHECK/);
    insertTx(db, { kind: 'adjustment', amount_minor: 300 });
  });

  it('INV-02 el CHECK exige destino distinto y monto positivo solo en transferencias', () => {
    const db = seeded();
    const transfer = { kind: 'transfer', to_account_id: 'bank', to_amount_minor: 1_250_000 };
    insertTx(db, transfer);
    expect(() => insertTx(db, { ...transfer, to_account_id: 'cash' })).toThrow(/CHECK/);
    expect(() => insertTx(db, { ...transfer, to_amount_minor: -1 })).toThrow(/CHECK/);
    expect(() => insertTx(db, { to_account_id: 'bank' })).toThrow(/CHECK/);
  });

  it('rechaza valores fuera de las enumeraciones y cuentas inexistentes', () => {
    const db = seeded();
    expect(() => insertTx(db, { source: 'sms' })).toThrow(/CHECK/);
    expect(() => insertTx(db, { account_id: 'no-existe' })).toThrow(/FOREIGN KEY/);
  });
});

describe('HU-05 transaction_search: texto de búsqueda derivado y solo local', () => {
  it('HU-05 la migración 0002 se aplica sobre la versión anterior sin perder movimientos', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const index = journal.entries.findIndex((entry) => entry.tag.startsWith('0002'));
    expect(index).toBeGreaterThan(0);
    migrate(db, 0, index);
    db.prepare(
      `insert into accounts (id, user_id, created_at, updated_at, name, type, currency, color, icon)
       values ('cash', 'u1', ?, ?, 'Efectivo', 'cash', 'COP', 'green', '💵')`,
    ).run(now, now);
    insertTx(db, { id: 'antes' });
    migrate(db, index, index + 1);
    expect(db.prepare('select count(*) as n from transactions').get()).toEqual({ n: 1 });
    expect(db.prepare('select count(*) as n from transaction_search').get()).toEqual({ n: 0 });
  });

  it('HU-05 cada fila pertenece a un movimiento y se borra con él', () => {
    const db = seeded();
    insertTx(db, { id: 'cafe' });
    db.prepare(
      `insert into transaction_search (transaction_id, content) values ('cafe', 'cafe exito')`,
    ).run();
    expect(() =>
      db
        .prepare(`insert into transaction_search (transaction_id, content) values ('nada', 'x')`)
        .run(),
    ).toThrow(/FOREIGN KEY/);
    db.prepare(`delete from transactions where id = 'cafe'`).run();
    expect(db.prepare('select count(*) as n from transaction_search').get()).toEqual({ n: 0 });
  });
});
