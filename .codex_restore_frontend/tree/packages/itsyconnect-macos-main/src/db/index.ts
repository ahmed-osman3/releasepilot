import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

let _sqlite: InstanceType<typeof Database> | null = null;
let _db: DrizzleDB | null = null;

function init() {
  if (_db) return { sqlite: _sqlite!, db: _db };

  const dbPath = process.env.DATABASE_PATH;
  if (!dbPath) {
    throw new Error("DATABASE_PATH environment variable is not set");
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.pragma("busy_timeout = 5000");
  _sqlite.pragma("synchronous = NORMAL");

  _db = drizzle(_sqlite, { schema });

  migrate(_db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  return { sqlite: _sqlite, db: _db };
}

export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop, receiver) {
    return Reflect.get(init().db, prop, receiver);
  },
});

export const sqlite = new Proxy({} as InstanceType<typeof Database>, {
  get(_target, prop, receiver) {
    return Reflect.get(init().sqlite, prop, receiver);
  },
});

export type DbClient = DrizzleDB;
