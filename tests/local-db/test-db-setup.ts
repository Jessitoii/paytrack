import Database from 'better-sqlite3';
import { DatabaseClient, setDatabaseInstance } from '../../src/database/db';

export function setupTestDatabase(): DatabaseClient {
  const nativeDb = new Database(':memory:');
  nativeDb.pragma('journal_mode = WAL');
  nativeDb.pragma('foreign_keys = ON');

  const client: DatabaseClient = {
    async execute(sql: string, params: any[] = []) {
      const stmt = nativeDb.prepare(sql);
      const info = stmt.run(...params);
      return { rowsAffected: info.changes, insertId: Number(info.lastInsertRowid) };
    },
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const stmt = nativeDb.prepare(sql);
      return stmt.all(...params) as T[];
    },
    async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
      const stmt = nativeDb.prepare(sql);
      const result = stmt.get(...params);
      return (result as T) ?? null;
    },
    async transaction<T>(callback: (c: DatabaseClient) => Promise<T>): Promise<T> {
      nativeDb.exec('BEGIN TRANSACTION;');
      try {
        const res = await callback(client);
        nativeDb.exec('COMMIT;');
        return res;
      } catch (err) {
        nativeDb.exec('ROLLBACK;');
        throw err;
      }
    },
    async execRaw(sql: string) {
      nativeDb.exec(sql);
    },
  };

  setDatabaseInstance(client);
  return client;
}
