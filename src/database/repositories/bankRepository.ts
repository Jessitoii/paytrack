import { getDatabase } from '../db';
import { dbEvents } from '../events';

export interface BankConnection {
  id: string;
  institutionId: string;
  institutionName: string;
  requisitionId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED';
  lastSyncedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  id: string;
  connectionId: string;
  gocardlessAccountId: string;
  iban: string;
  identificationHash?: string | null;
  accountName?: string | null;
  currency: string;
  balance: number;
  availableBalance?: number | null;
  bankName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  gocardlessTransactionId: string;
  amount: number;
  currency: string;
  bookingDate: string;
  valueDate?: string | null;
  remittanceInformation?: string | null;
  creditorName?: string | null;
  debtorName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  status: string;
  isRentMatch: boolean;
  source: string;
  createdAt: string;
}

export interface BankTransactionInput {
  gocardlessTransactionId: string;
  amount: number;
  currency?: string;
  bookingDate: string;
  valueDate?: string | null;
  remittanceInformation?: string | null;
  creditorName?: string | null;
  debtorName?: string | null;
  categoryId?: string | null;
  status?: string;
  isRentMatch?: boolean;
}

function generateId(prefix = 'bnk'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export const bankRepository = {
  // 1. Connection Management
  async getActiveConnection(): Promise<BankConnection | null> {
    const db = getDatabase();
    const row = await db.queryFirst<any>(
      `SELECT * FROM bank_connections WHERE status = 'CONNECTED' ORDER BY updatedAt DESC LIMIT 1;`
    );
    return row || null;
  },

  async getConnectionById(id: string): Promise<BankConnection | null> {
    const db = getDatabase();
    const row = await db.queryFirst<any>(
      `SELECT * FROM bank_connections WHERE id = ? LIMIT 1;`,
      [id]
    );
    return row || null;
  },

  async getConnectionByRequisitionId(requisitionId: string): Promise<BankConnection | null> {
    const db = getDatabase();
    const row = await db.queryFirst<any>(
      `SELECT * FROM bank_connections WHERE requisitionId = ? LIMIT 1;`,
      [requisitionId]
    );
    return row || null;
  },

  async saveConnection(input: {
    institutionId: string;
    institutionName: string;
    requisitionId: string;
    status?: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED';
    expiresAt?: string | null;
  }): Promise<BankConnection> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const isConnecting = (input.status ?? 'CONNECTED') === 'CONNECTED';

    // Ensure only ONE connection can be CONNECTED at any time
    if (isConnecting) {
      await db.execute(
        `UPDATE bank_connections SET status = 'DISCONNECTED', updatedAt = ? WHERE status = 'CONNECTED' AND requisitionId != ?;`,
        [now, input.requisitionId]
      );
    }

    const existing = await this.getConnectionByRequisitionId(input.requisitionId);

    if (existing) {
      await db.execute(
        `UPDATE bank_connections SET
           institutionId = ?, institutionName = ?, status = ?, expiresAt = ?, updatedAt = ?
         WHERE id = ?;`,
        [
          input.institutionId,
          input.institutionName,
          input.status ?? 'CONNECTED',
          input.expiresAt ?? existing.expiresAt,
          now,
          existing.id,
        ]
      );
      dbEvents.emit('finance_changed');
      return (await db.queryFirst('SELECT * FROM bank_connections WHERE id = ?;', [existing.id]))!;
    }

    const id = generateId('conn');
    await db.execute(
      `INSERT INTO bank_connections (
         id, institutionId, institutionName, requisitionId, status, lastSyncedAt, expiresAt, createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, null, ?, ?, ?);`,
      [
        id,
        input.institutionId,
        input.institutionName,
        input.requisitionId,
        input.status ?? 'CONNECTED',
        input.expiresAt ?? null,
        now,
        now,
      ]
    );

    dbEvents.emit('finance_changed');
    return (await db.queryFirst('SELECT * FROM bank_connections WHERE id = ?;', [id]))!;
  },

  async updateConnectionStatus(
    id: string,
    status: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED',
    lastSyncedAt?: string
  ): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    if (lastSyncedAt) {
      await db.execute(
        `UPDATE bank_connections SET status = ?, lastSyncedAt = ?, updatedAt = ? WHERE id = ?;`,
        [status, lastSyncedAt, now, id]
      );
    } else {
      await db.execute(
        `UPDATE bank_connections SET status = ?, updatedAt = ? WHERE id = ?;`,
        [status, now, id]
      );
    }
    dbEvents.emit('finance_changed');
  },

  async updateLastSynced(id: string, lastSyncedAt: string = new Date().toISOString()): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE bank_connections SET lastSyncedAt = ?, updatedAt = ? WHERE id = ?;`,
      [lastSyncedAt, now, id]
    );
    dbEvents.emit('finance_changed');
  },

  async disconnectConnection(id: string): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE bank_connections SET status = 'DISCONNECTED', updatedAt = ? WHERE id = ?;`,
      [now, id]
    );
    dbEvents.emit('finance_changed');
  },

  async deleteConnection(id: string, removeTransactions = false): Promise<void> {
    const db = getDatabase();
    if (removeTransactions) {
      const accounts = await this.listAccounts(id);
      for (const acc of accounts) {
        await db.execute('DELETE FROM bank_transactions WHERE bankAccountId = ?;', [acc.id]);
      }
    }
    await db.execute('DELETE FROM bank_accounts WHERE connectionId = ?;', [id]);
    await db.execute('DELETE FROM bank_connections WHERE id = ?;', [id]);
    dbEvents.emit('finance_changed');
  },

  // 2. Account Management
  async saveAccounts(
    connectionId: string,
    accounts: Array<{
      gocardlessAccountId: string;
      iban: string;
      identificationHash?: string | null;
      accountName?: string | null;
      currency?: string;
      balance?: number;
      availableBalance?: number | null;
      bankName?: string;
      status?: string;
    }>
  ): Promise<BankAccount[]> {
    const db = getDatabase();
    const now = new Date().toISOString();

    for (const acc of accounts) {
      // 1. Match by stable identificationHash if available
      let existing: any = null;
      if (acc.identificationHash) {
        existing = await db.queryFirst<any>(
          'SELECT id FROM bank_accounts WHERE identificationHash = ? LIMIT 1;',
          [acc.identificationHash]
        );
      }

      // 2. Fallback: match by gocardlessAccountId (account UID)
      if (!existing) {
        existing = await db.queryFirst<any>(
          'SELECT id FROM bank_accounts WHERE gocardlessAccountId = ? LIMIT 1;',
          [acc.gocardlessAccountId]
        );
      }

      // 3. Fallback: match by connectionId and iban
      if (!existing) {
        existing = await db.queryFirst<any>(
          'SELECT id FROM bank_accounts WHERE connectionId = ? AND iban = ? LIMIT 1;',
          [connectionId, acc.iban]
        );
      }

      if (existing) {
        await db.execute(
          `UPDATE bank_accounts SET
             connectionId = ?, gocardlessAccountId = ?, iban = ?, identificationHash = ?,
             accountName = ?, currency = ?, balance = ?, availableBalance = ?,
             bankName = ?, status = ?, updatedAt = ?
           WHERE id = ?;`,
          [
            connectionId,
            acc.gocardlessAccountId,
            acc.iban,
            acc.identificationHash ?? null,
            acc.accountName ?? null,
            acc.currency ?? 'EUR',
            acc.balance ?? 0.0,
            acc.availableBalance ?? null,
            acc.bankName ?? 'ING Netherlands',
            acc.status ?? 'READY',
            now,
            existing.id,
          ]
        );
      } else {
        const id = generateId('acc');
        await db.execute(
          `INSERT INTO bank_accounts (
             id, connectionId, gocardlessAccountId, iban, identificationHash, accountName, currency,
             balance, availableBalance, bankName, status, createdAt, updatedAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            id,
            connectionId,
            acc.gocardlessAccountId,
            acc.iban,
            acc.identificationHash ?? null,
            acc.accountName ?? null,
            acc.currency ?? 'EUR',
            acc.balance ?? 0.0,
            acc.availableBalance ?? null,
            acc.bankName ?? 'ING Netherlands',
            acc.status ?? 'READY',
            now,
            now,
          ]
        );
      }
    }

    dbEvents.emit('finance_changed');
    return this.listAccounts(connectionId);
  },

  async listAccounts(connectionId?: string): Promise<BankAccount[]> {
    const db = getDatabase();
    if (connectionId) {
      return db.query('SELECT * FROM bank_accounts WHERE connectionId = ? ORDER BY createdAt ASC;', [connectionId]);
    }
    return db.query('SELECT * FROM bank_accounts ORDER BY createdAt ASC;');
  },

  // 3. Transactions & Deduplication
  async saveTransactions(
    bankAccountId: string,
    transactions: BankTransactionInput[]
  ): Promise<{ inserted: number; updated: number; skipped: number }> {
    const db = getDatabase();
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const tx of transactions) {
      const existing = await db.queryFirst<any>(
        `SELECT id, amount, status, bookingDate, remittanceInformation FROM bank_transactions
         WHERE bankAccountId = ? AND gocardlessTransactionId = ? LIMIT 1;`,
        [bankAccountId, tx.gocardlessTransactionId]
      );

      if (existing) {
        const isChanged =
          existing.status !== (tx.status ?? 'BOOKED') ||
          Math.abs(existing.amount - tx.amount) > 0.001 ||
          existing.bookingDate !== tx.bookingDate ||
          (existing.remittanceInformation || '') !== (tx.remittanceInformation || '');

        if (isChanged) {
          await db.execute(
            `UPDATE bank_transactions SET
               amount = ?,
               status = ?,
               bookingDate = ?,
               valueDate = ?,
               remittanceInformation = ?,
               creditorName = ?,
               debtorName = ?,
               categoryId = COALESCE(?, categoryId),
               isRentMatch = ?
             WHERE id = ?;`,
            [
              tx.amount,
              tx.status ?? 'BOOKED',
              tx.bookingDate,
              tx.valueDate ?? null,
              tx.remittanceInformation ?? null,
              tx.creditorName ?? null,
              tx.debtorName ?? null,
              tx.categoryId ?? null,
              tx.isRentMatch ? 1 : 0,
              existing.id,
            ]
          );
          updated++;
        } else {
          skipped++;
        }
      } else {
        const txId = generateId('btx');
        await db.execute(
          `INSERT INTO bank_transactions (
             id, bankAccountId, gocardlessTransactionId, amount, currency,
             bookingDate, valueDate, remittanceInformation, creditorName,
             debtorName, categoryId, status, isRentMatch, source, createdAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BANK', ?);`,
          [
            txId,
            bankAccountId,
            tx.gocardlessTransactionId,
            tx.amount,
            tx.currency ?? 'EUR',
            tx.bookingDate,
            tx.valueDate ?? null,
            tx.remittanceInformation ?? null,
            tx.creditorName ?? null,
            tx.debtorName ?? null,
            tx.categoryId ?? null,
            tx.status ?? 'BOOKED',
            tx.isRentMatch ? 1 : 0,
            now,
          ]
        );
        inserted++;
      }
    }

    if (inserted > 0 || updated > 0) {
      dbEvents.emit('finance_changed');
    }

    return { inserted, updated, skipped };
  },

  async listTransactions(filters?: {
    bankAccountId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<BankTransaction[]> {
    const db = getDatabase();
    let sql = `
      SELECT t.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
      FROM bank_transactions t
      LEFT JOIN expense_categories c ON c.id = t.categoryId
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.bankAccountId) {
      sql += ' AND t.bankAccountId = ?';
      params.push(filters.bankAccountId);
    }
    if (filters?.startDate) {
      sql += ' AND t.bookingDate >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ' AND t.bookingDate <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY t.bookingDate DESC, t.createdAt DESC';

    if (filters?.limit) {
      sql += ` LIMIT ${Math.floor(filters.limit)}`;
    }

    const rows = await db.query<any>(sql, params);
    return rows.map((r) => ({
      ...r,
      isRentMatch: Boolean(r.isRentMatch),
    }));
  },

  async getTransactionsSummary(
    startDate?: string,
    endDate?: string
  ): Promise<{ totalInflow: number; totalOutflow: number; count: number }> {
    const db = getDatabase();
    let sql = 'SELECT amount FROM bank_transactions WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      sql += ' AND bookingDate >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND bookingDate <= ?';
      params.push(endDate);
    }

    const rows = await db.query<{ amount: number }>(sql, params);
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const r of rows) {
      if (r.amount > 0) {
        totalInflow += r.amount;
      } else {
        totalOutflow += Math.abs(r.amount);
      }
    }

    return {
      totalInflow: Number(totalInflow.toFixed(2)),
      totalOutflow: Number(totalOutflow.toFixed(2)),
      count: rows.length,
    };
  },
};
