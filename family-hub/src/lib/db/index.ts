import "server-only";
import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";
import { env, isProd } from "../env";

export type DB = PostgresJsDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type Holder = { db?: DB; ready?: Promise<DB> };
const g = globalThis as unknown as { __familyHubDb?: Holder };
const holder: Holder = (g.__familyHubDb ??= {});

async function init(): Promise<DB> {
  if (env.databaseUrl) {
    const client = postgres(env.databaseUrl, {
      max: isProd ? 3 : 5,
      prepare: false, // required for Supabase/Neon transaction poolers
      idle_timeout: 20,
      ssl: env.databaseUrl.includes("localhost") ? false : "require",
    });
    const db = drizzlePostgres(client, { schema });
    await migratePostgres(db, { migrationsFolder: MIGRATIONS });
    return db;
  }
  if (isProd) {
    throw new Error("DATABASE_URL is required in production.");
  }
  // Local development: embedded Postgres (PGlite) persisted under .data/
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate: migratePglite } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

export async function getDb(): Promise<DB> {
  if (holder.db) return holder.db;
  holder.ready ??= init().then(
    (db) => (holder.db = db),
    (err) => {
      holder.ready = undefined;
      throw err;
    },
  );
  return holder.ready;
}

export { schema };
