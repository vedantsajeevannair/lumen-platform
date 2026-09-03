import { defineConfig } from '@prisma/config';

// TURSO_DATABASE_URL set (embed the auth token as a query param, e.g.
// `libsql://<db>.turso.io?authToken=<token>`) → `db:push`/`db:seed` target
// Turso. Unset → the local lumen.db file, unchanged from before this existed.
export default defineConfig({
  earlyAccess: true,
  migrate: {
    connection: {
      url: process.env.TURSO_DATABASE_URL ?? 'file:../database/lumen.db',
    },
  },
});
