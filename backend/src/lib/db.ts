import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// TURSO_DATABASE_URL set → hosted libSQL (deployed environments, where the
// local file wouldn't survive a redeploy). Unset → the local lumen.db file,
// unchanged from before this existed.
function makeClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return new PrismaClient();
  const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
