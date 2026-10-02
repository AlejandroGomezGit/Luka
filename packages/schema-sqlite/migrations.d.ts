// Tipos de drizzle/migrations.js, que genera drizzle-kit e importa los .sql (los incrusta Babel en la app).
declare const migrations: {
  journal: { entries: { idx: number; when: number; tag: string; breakpoints: boolean }[] };
  migrations: Record<string, string>;
};
export default migrations;
