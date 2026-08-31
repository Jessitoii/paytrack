export interface DatabaseClient {
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; insertId?: number }>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null>;
  transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>;
  execRaw(sql: string): Promise<void>;
}

let dbInstance: DatabaseClient | null = null;

/**
 * Sets the active database client (used by unit test runners).
 */
export function setDatabaseInstance(instance: DatabaseClient | null) {
  dbInstance = instance;
}

/**
 * Creates and initializes the local Expo SQLite database client.
 */
export function getDatabase(): DatabaseClient {
  if (dbInstance) return dbInstance;

  const SQLite = require('expo-sqlite');
  const expoDb = SQLite.openDatabaseSync('paytrack_local.db');
  expoDb.execSync('PRAGMA foreign_keys = ON;');

  const client: DatabaseClient = {
    async execute(sql: string, params: any[] = []) {
      const result = await expoDb.runAsync(sql, params);
      return { rowsAffected: result.changes, insertId: result.lastInsertRowId };
    },
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const results = await expoDb.getAllAsync(sql, params);
      return results as T[];
    },
    async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
      const result = await expoDb.getFirstAsync(sql, params);
      return (result as T) ?? null;
    },
    async transaction<T>(callback: (c: DatabaseClient) => Promise<T>): Promise<T> {
      let res: T;
      await expoDb.withTransactionAsync(async () => {
        res = await callback(client);
      });
      return res!;
    },
    async execRaw(sql: string) {
      await expoDb.execAsync(sql);
    },
  };

  dbInstance = client;
  return client;
}

/**
 * Resets the database client instance.
 */
export function resetDatabaseInstance() {
  dbInstance = null;
}
