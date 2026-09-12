import * as SQLite from 'expo-sqlite';

/**
 * All persistent data lives in one local SQLite file. There is no server and no
 * sync, so migrations only ever run forward on this device.
 */

const DB_NAME = 'app.db';

/** Append-only. Never edit or reorder a shipped migration — add a new one. */
const migrations: string[] = [
  // v1 — one key/value table. The game's persistent state is a handful of
  // counters and two JSON blobs; a schema per field would be ceremony.
  `CREATE TABLE IF NOT EXISTS meta (
     key   TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   );

   -- Finished runs, for the score list.
   CREATE TABLE IF NOT EXISTS runs (
     id       TEXT PRIMARY KEY NOT NULL,
     score    INTEGER NOT NULL,
     gold     INTEGER NOT NULL,
     ended_at TEXT NOT NULL
   );

   CREATE INDEX IF NOT EXISTS idx_runs_score ON runs(score DESC);`,
];

let database: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;

  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);

  database = db;
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  for (let i = version; i < migrations.length; i++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrations[i]);
    });
    version = i + 1;
    // PRAGMA does not accept bound parameters, and `version` is a loop counter,
    // never user input.
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

/** Wipes every table. Backs the "delete all my data" setting. */
export async function wipeDatabase(): Promise<void> {
  const db = await getDb();
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );

  await db.withTransactionAsync(async () => {
    for (const { name } of tables) {
      await db.execAsync(`DELETE FROM "${name}"`);
    }
  });
}

/** Everything in the database as plain JSON. Backs "export my data". */
export async function exportDatabase(): Promise<Record<string, unknown[]>> {
  const db = await getDb();
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );

  const dump: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    dump[name] = await db.getAllAsync(`SELECT * FROM "${name}"`);
  }
  return dump;
}
