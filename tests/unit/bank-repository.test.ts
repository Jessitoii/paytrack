import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase } from '../local-db/test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { bankRepository } from '../../src/database/repositories/bankRepository';

describe('Bank Repository & Deduplication Lifecycle', () => {
  beforeEach(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  it('saves and retrieves active bank connection', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_test_12345',
      status: 'CONNECTED',
    });

    expect(conn.id).toBeDefined();
    expect(conn.institutionName).toBe('ING Netherlands');
    expect(conn.status).toBe('CONNECTED');

    const active = await bankRepository.getActiveConnection();
    expect(active).not.toBeNull();
    expect(active?.requisitionId).toBe('session_test_12345');
  });

  it('saves and updates bank accounts linked to a connection', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_test_acc',
    });

    const accounts = await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'NL91INGB0001234567',
        iban: 'NL91INGB0001234567',
        accountName: 'Betaalrekening',
        currency: 'EUR',
        balance: 1450.5,
        bankName: 'ING Netherlands',
      },
    ]);

    expect(accounts).toHaveLength(1);
    expect(accounts[0].iban).toBe('NL91INGB0001234567');
    expect(accounts[0].balance).toBe(1450.5);

    // Update balance
    await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'NL91INGB0001234567',
        iban: 'NL91INGB0001234567',
        balance: 1520.0,
      },
    ]);

    const updated = await bankRepository.listAccounts(conn.id);
    expect(updated).toHaveLength(1);
    expect(updated[0].balance).toBe(1520.0);
  });

  it('idempotently deduplicates transactions preventing double insertion', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_test_dedup',
    });

    const [acc] = await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'acc_dedup_01',
        iban: 'NL91INGB0001234567',
      },
    ]);

    const txBatch = [
      {
        gocardlessTransactionId: 'tx_ah_101',
        amount: -34.8,
        currency: 'EUR',
        bookingDate: '2026-09-01',
        creditorName: 'Albert Heijn',
        categoryId: 'cat_food',
      },
      {
        gocardlessTransactionId: 'tx_rent_102',
        amount: -160.0,
        currency: 'EUR',
        bookingDate: '2026-09-01',
        creditorName: 'Huisvesting Bleiswijk',
        categoryId: 'cat_housing',
        isRentMatch: true,
      },
    ];

    // First sync
    const firstSync = await bankRepository.saveTransactions(acc.id, txBatch);
    expect(firstSync.inserted).toBe(2);
    expect(firstSync.skipped).toBe(0);

    const txsAfterFirst = await bankRepository.listTransactions({ bankAccountId: acc.id });
    expect(txsAfterFirst).toHaveLength(2);

    // Second sync with the same transactions
    const secondSync = await bankRepository.saveTransactions(acc.id, txBatch);
    expect(secondSync.inserted).toBe(0);
    expect(secondSync.skipped).toBe(2);

    // Total count in database must remain 2 (no duplicates!)
    const txsAfterSecond = await bankRepository.listTransactions({ bankAccountId: acc.id });
    expect(txsAfterSecond).toHaveLength(2);
  });

  it('correctly updates existing transaction via UPSERT when status changes from PENDING to BOOKED', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_test_upsert',
    });

    const [acc] = await bankRepository.saveAccounts(conn.id, [
      { gocardlessAccountId: 'acc_upsert_01', iban: 'NL91INGB0001234567' },
    ]);

    // Initial sync with a pending transaction
    const initialSync = await bankRepository.saveTransactions(acc.id, [
      {
        gocardlessTransactionId: 'tx_pending_1',
        amount: -45.0,
        bookingDate: '2026-09-01',
        remittanceInformation: 'Pending Card Payment',
        status: 'PENDING',
      },
    ]);
    expect(initialSync.inserted).toBe(1);

    let rows = await bankRepository.listTransactions({ bankAccountId: acc.id });
    expect(rows[0].status).toBe('PENDING');

    // Later sync where bank has settled and booked the transaction
    const laterSync = await bankRepository.saveTransactions(acc.id, [
      {
        gocardlessTransactionId: 'tx_pending_1',
        amount: -45.0,
        bookingDate: '2026-09-02',
        remittanceInformation: 'Settled Card Payment Bakkerij',
        status: 'BOOKED',
      },
    ]);
    expect(laterSync.inserted).toBe(0);
    expect(laterSync.updated).toBe(1);
    expect(laterSync.skipped).toBe(0);

    rows = await bankRepository.listTransactions({ bankAccountId: acc.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('BOOKED');
    expect(rows[0].remittanceInformation).toBe('Settled Card Payment Bakkerij');
  });

  it('disconnects connection while keeping transaction records intact', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_test_disconnect',
    });

    const [acc] = await bankRepository.saveAccounts(conn.id, [
      { gocardlessAccountId: 'acc_disc_01', iban: 'NL91INGB0001234567' },
    ]);

    await bankRepository.saveTransactions(acc.id, [
      {
        gocardlessTransactionId: 'tx_keep_me',
        amount: -25.0,
        bookingDate: '2026-09-01',
      },
    ]);

    // Disconnect
    await bankRepository.disconnectConnection(conn.id);

    // Active connection should now be null
    const active = await bankRepository.getActiveConnection();
    expect(active).toBeNull();

    // Transactions must still be preserved for user financial history!
    const txs = await bankRepository.listTransactions({ bankAccountId: acc.id });
    expect(txs).toHaveLength(1);
    expect(txs[0].gocardlessTransactionId).toBe('tx_keep_me');
  });
});
