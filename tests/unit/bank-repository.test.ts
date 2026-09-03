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
      institutionId: 'ING_INGBNL2A',
      institutionName: 'ING Netherlands',
      requisitionId: 'req_test_12345',
      status: 'CONNECTED',
    });

    expect(conn.id).toBeDefined();
    expect(conn.institutionName).toBe('ING Netherlands');
    expect(conn.status).toBe('CONNECTED');

    const active = await bankRepository.getActiveConnection();
    expect(active).not.toBeNull();
    expect(active?.requisitionId).toBe('req_test_12345');
  });

  it('saves and updates bank accounts linked to a connection', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING_INGBNL2A',
      institutionName: 'ING Netherlands',
      requisitionId: 'req_test_acc',
    });

    const accounts = await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'gc_acc_001',
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
        gocardlessAccountId: 'gc_acc_001',
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
      institutionId: 'ING_INGBNL2A',
      institutionName: 'ING Netherlands',
      requisitionId: 'req_test_dedup',
    });

    const [acc] = await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'gc_acc_dedup',
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

  it('disconnects connection while keeping transaction records intact', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING_INGBNL2A',
      institutionName: 'ING Netherlands',
      requisitionId: 'req_test_disconnect',
    });

    const [acc] = await bankRepository.saveAccounts(conn.id, [
      { gocardlessAccountId: 'gc_acc_disc', iban: 'NL91INGB0001234567' },
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
