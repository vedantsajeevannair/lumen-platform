// A prisma.config.ts file present in the project makes the CLI skip its
// normal automatic .env loading, so it has to be done explicitly here.
//
// schema.prisma's datasource url stays the literal local `file:./lumen.db`
// (the sqlite provider's schema validation rejects anything else, even when
// a driver adapter is configured below) — it's only actually used when no
// adapter is given. TURSO_DATABASE_URL set → `db:push`/`db:seed` go through
// the same libSQL driver adapter backend/src/lib/db.ts uses for the app
// itself at runtime, so both talk to Turso the same way.
import 'dotenv/config';
import { defineConfig } from '@prisma/config';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { bindMigrationAwareSqlAdapterFactory } from '@prisma/driver-adapter-utils';

const url = process.env.TURSO_DATABASE_URL;

export default defineConfig(
  url
    ? {
        earlyAccess: true,
        adapter: async () =>
          bindMigrationAwareSqlAdapterFactory(
            new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN }),
          ),
      }
    : { earlyAccess: true },
);
