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
    // Drop provider-specific query params (sslmode, supa, pgbouncer …); TLS is configured below.
    const url = new URL(env.databaseUrl);
    url.search = "";
    const client = postgres(url.toString(), {
      max: isProd ? 3 : 5,
      prepare: false, // required for Supabase/Neon transaction poolers
      idle_timeout: 20,
      ssl: env.databaseUrl.includes("localhost") ? false : "require",
    });
    const db = drizzlePostgres(client, { schema });
    await migratePostgres(db, { migrationsFolder: MIGRATIONS });
    return db;
  }
  if (isProd && dbMode() !== "ephemeral") {
    throw new Error("DATABASE_URL is required in production (or set ALLOW_EPHEMERAL_DB=1 for a throw-away test instance).");
  }
  // Local development: embedded Postgres (PGlite) persisted under .data/.
  // Ephemeral mode (testing deployments without a database): PGlite in the instance's /tmp – data can reset at any time.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate: migratePglite } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR || (isProd ? "/tmp/family-hub-pglite" : path.join(process.cwd(), ".data", "pglite"));
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

/** Which storage backs the app: a real Postgres, the local dev PGlite, or a throw-away PGlite on a server. */
export function dbMode(): "postgres" | "local" | "ephemeral" {
  if (env.databaseUrl) return "postgres";
  if (isProd && process.env.ALLOW_EPHEMERAL_DB === "1") return "ephemeral";
  return "local";
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
