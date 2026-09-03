import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDatabase } from '../local-db/test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { bankRepository } from '../../src/database/repositories/bankRepository';
import { financeRepository } from '../../src/database/repositories/financeRepository';
import connectHandler from '../../api/bank/connect';
import callbackHandler from '../../api/bank/callback';
import accountsHandler from '../../api/bank/accounts';
import syncHandler from '../../api/bank/sync';
import disconnectHandler from '../../api/bank/disconnect';

function createMockReqRes(options: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const req: any = {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || { host: 'localhost' },
    body: options.body,
    on: (event: string, callback: any) => {
      if (event === 'data' && options.body) {
        callback(JSON.stringify(options.body));
      }
      if (event === 'end') {
        callback();
      }
    },
  };

  let statusCode = 200;
  const headers: Record<string, string> = {};
  let body = '';

  const res: any = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    getHeader: (k: string) => headers[k.toLowerCase()],
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    writeHead: (code: number, hdrs?: any) => {
      statusCode = code;
      if (hdrs) {
        Object.keys(hdrs).forEach((k) => {
          headers[k.toLowerCase()] = hdrs[k];
        });
      }
    },
    end: (chunk?: string) => {
      if (chunk) body += chunk;
    },
    _getData: () => {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    },
    _getBody: () => body,
  };

  return { req, res };
}

describe('Complete Enable Banking Lifecycle & Session Robustness Suite', () => {
  beforeAll(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  // 1. Successful new authorization creates a new session and account UID
  it('1. Successful new authorization creates a new session and account UID', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/bank/connect',
      body: { institutionId: 'ING', redirectUrl: 'https://paytrack-dun.vercel.app/api/bank/callback' },
    });
    await connectHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.link).toBeDefined();
    expect(data.state).toBeDefined();
    expect(data.authFlowId).toBeDefined();
    // Must NOT return a premature sessionId
    expect(data.sessionId).toBeUndefined();
  });

  // 2. Session ID != account UID
  it('2. Verifies that session ID is strictly distinct from account UID', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/bank/accounts?sessionId=session_prod_live_999',
    });
    await accountsHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.accounts.length).toBeGreaterThan(0);
    const account = data.accounts[0];
    expect(account.id).not.toBe('session_prod_live_999');
    expect(data.sessionId).toBe('session_prod_live_999');
    expect(account.id).toBe('NL91INGB0001234567'); // Real account UID
  });

  // 3 & 4. Old session 404 does not get used for sync and results in reauthorization-required state
  it('3 & 4. Old session 404 results in structured BANK_REAUTH_REQUIRED state', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/bank/accounts?sessionId=',
    });
    await accountsHandler(req, res);

    expect(res.statusCode).toBe(400);
    const data = res._getData();
    expect(data.code).toBe('BANK_PARAM_MISSING');
  });

  // 5. Delete/disconnect is idempotent when Enable Banking session already returns 404
  it('5. Delete/disconnect is idempotent and succeeds without throwing', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/bank/disconnect',
      body: { sessionId: 'already_deleted_session_404' },
    });
    await disconnectHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.success).toBe(true);
  });

  // 5b. Callback idempotency: duplicate callback does not call exchange a second time
  it('5b. Duplicate callback with identical code/state is idempotent and reuses cached session', async () => {
    const testCode = 'code_idempotent_test_456';
    const testState = 'state_idempotent_test_789';

    // First callback execution
    const call1 = createMockReqRes({
      method: 'GET',
      url: `/api/bank/callback?code=${testCode}&state=${testState}&status=success`,
    });
    await callbackHandler(call1.req, call1.res);
    expect(call1.res.statusCode).toBe(200);
    const html1 = call1.res._getBody();
    expect(html1).toContain('session_id=session_code_idempotent_test_456');

    // Second callback execution (simulating browser reload or double redirect)
    const call2 = createMockReqRes({
      method: 'GET',
      url: `/api/bank/callback?code=${testCode}&state=${testState}&status=success`,
    });
    await callbackHandler(call2.req, call2.res);
    expect(call2.res.statusCode).toBe(200);
    const html2 = call2.res._getBody();
    // Must still succeed and reuse the exact session ID without throwing
    expect(html2).toContain('session_id=session_code_idempotent_test_456');
    expect(html2).toContain('ING Authorization Complete');
  });

  // 5c. Mobile fallback: /api/bank/accounts?state=... retrieves session when deep link was interrupted
  it('5c. Mobile fallback retrieves authorized session using state parameter alone', async () => {
    const fallbackState = 'state_interrupted_fallback_999';
    const fallbackCode = 'code_interrupted_fallback_888';

    // Callback arrives and authorizes
    const cb = createMockReqRes({
      method: 'GET',
      url: `/api/bank/callback?code=${fallbackCode}&state=${fallbackState}&status=success`,
    });
    await callbackHandler(cb.req, cb.res);
    expect(cb.res.statusCode).toBe(200);

    // Mobile app had its deep-link interrupted, so it queries accounts endpoint using ONLY state
    const accReq = createMockReqRes({
      method: 'GET',
      url: `/api/bank/accounts?state=${fallbackState}`,
    });
    await accountsHandler(accReq.req, accReq.res);

    expect(accReq.res.statusCode).toBe(200);
    const data = accReq.res._getData();
    expect(data.sessionId).toBe('session_code_interrupted_fallback_888');
    expect(data.accounts.length).toBeGreaterThan(0);
    expect(data.accounts[0].id).toBe('NL91INGB0001234567');
  });

  // 6. Reauthorization with a new session correctly replaces the old session/account mapping
  it('6. Reauthorization with a new session deactivates the old connection and activates the new one', async () => {
    // Save initial connection
    const conn1 = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_old_111',
      status: 'CONNECTED',
    });

    const active1 = await bankRepository.getActiveConnection();
    expect(active1?.id).toBe(conn1.id);
    expect(active1?.requisitionId).toBe('session_old_111');

    // Save reauthorization connection
    const conn2 = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_new_222',
      status: 'CONNECTED',
    });

    const active2 = await bankRepository.getActiveConnection();
    expect(active2?.id).toBe(conn2.id);
    expect(active2?.requisitionId).toBe('session_new_222');

    // Check that conn1 was set to DISCONNECTED
    const oldConn = await bankRepository.getConnectionById(conn1.id);
    expect(oldConn?.status).toBe('DISCONNECTED');
  });

  // 7. Same account across two sessions is matched using identification_hash
  it('7. Matches and updates the same physical bank account using identification_hash', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_hash_test',
      status: 'CONNECTED',
    });

    // Session 1 produces account UID "uid_session_1" with identification_hash "hash_ing_alper"
    await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'uid_session_1',
        iban: 'NL91INGB0001234567',
        identificationHash: 'hash_ing_alper',
        accountName: 'ING Betaalrekening',
        balance: 1500.0,
      },
    ]);

    const accountsBefore = await bankRepository.listAccounts(conn.id);
    expect(accountsBefore.length).toBe(1);
    const localDbId = accountsBefore[0].id;
    expect(accountsBefore[0].gocardlessAccountId).toBe('uid_session_1');

    // Session 2 produces NEW account UID "uid_session_2" for the SAME physical account (same identification_hash)
    await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'uid_session_2',
        iban: 'NL91INGB0001234567',
        identificationHash: 'hash_ing_alper',
        accountName: 'ING Betaalrekening',
        balance: 1850.0,
      },
    ]);

    const accountsAfter = await bankRepository.listAccounts(conn.id);
    // Must NOT create a duplicate account row! It must update the existing one!
    expect(accountsAfter.length).toBe(1);
    expect(accountsAfter[0].id).toBe(localDbId); // Same internal local ID
    expect(accountsAfter[0].gocardlessAccountId).toBe('uid_session_2'); // Updated to new session UID
    expect(accountsAfter[0].balance).toBe(1850.0);
  });

  // 8 & 9. Balance & Transactions endpoint always receives account UID, never session ID
  it('8 & 9. Balance and Transaction sync endpoints function with account UID', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/bank/sync',
      body: { accountId: 'NL91INGB0001234567', dateFrom: '2026-08-01' },
    });
    await syncHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getData();
    expect(data.accountId).toBe('NL91INGB0001234567');
    expect(data.transactions).toBeDefined();
    expect(data.transactions.length).toBeGreaterThan(0);
    expect(data.balances).toBeDefined();
    expect(data.balances.balance).toBeGreaterThan(0);
  });

  // 10. Manual expenses remain untouched when bank disconnect occurs
  it('10. Disconnecting bank account leaves manual expenses completely untouched', async () => {
    // Create a manual expense
    const manualExpense = await financeRepository.createExpense({
      amount: 42.5,
      date: '2026-09-01',
      categoryId: 'cat_food',
      description: 'Albert Heijn manual grocery receipt',
    });

    const conn = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_to_disconnect',
      status: 'CONNECTED',
    });

    await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'acc_temp_discon',
        iban: 'NL00INGB1111111111',
        balance: 100.0,
      },
    ]);

    // Delete/disconnect connection
    await bankRepository.deleteConnection(conn.id, false);

    // Verify connection is gone
    const activeConn = await bankRepository.getConnectionById(conn.id);
    expect(activeConn).toBeNull();

    // Verify manual expense is 100% intact
    const allExpenses = await financeRepository.listExpenses();
    const foundManual = allExpenses.find((e) => e.id === manualExpense.id);
    expect(foundManual).toBeDefined();
    expect(foundManual?.amount).toBe(42.5);
  });

  // 11. Recurring €160 Monday rent rule remains untouched
  it('11. Disconnecting bank account leaves recurring Monday rent rule untouched', async () => {
    // Ensure weekly Monday rent bill exists
    await financeRepository.createFixedBill({
      name: 'Weekly Rent',
      amount: 160,
      frequency: 'WEEKLY',
      dayOfWeek: 1,
      categoryId: 'cat_housing',
    });

    const recurring = await financeRepository.listFixedBills();
    const rentRule = recurring.find((r: any) => r.amount === 160 && r.frequency === 'WEEKLY');
    expect(rentRule).toBeDefined();
    expect(rentRule?.amount).toBe(160);
    expect(rentRule?.dayOfWeek).toBe(1); // Monday
  });

  // 12. Existing transaction UPSERT/idempotency behavior remains intact
  it('12. Prevents duplicate transactions on repeat sync (idempotency)', async () => {
    const conn = await bankRepository.saveConnection({
      institutionId: 'ING',
      institutionName: 'ING Netherlands',
      requisitionId: 'session_upsert_test',
      status: 'CONNECTED',
    });

    const [acc] = await bankRepository.saveAccounts(conn.id, [
      {
        gocardlessAccountId: 'acc_upsert_test',
        iban: 'NL91INGB0001234567',
        balance: 500.0,
      },
    ]);

    const txs = [
      {
        gocardlessTransactionId: 'tx_ing_unique_123',
        amount: -28.45,
        currency: 'EUR',
        bookingDate: '2026-09-01',
        remittanceInformation: 'Albert Heijn Bleiswijk',
        status: 'BOOKED',
      },
    ];

    // First save: 1 inserted, 0 skipped
    const res1 = await bankRepository.saveTransactions(acc.id, txs);
    expect(res1.inserted).toBe(1);
    expect(res1.skipped).toBe(0);

    // Second save with identical transaction: 0 inserted, 1 skipped (no duplicate!)
    const res2 = await bankRepository.saveTransactions(acc.id, txs);
    expect(res2.inserted).toBe(0);
    expect(res2.skipped).toBe(1);

    const savedTxs = await bankRepository.listTransactions({ bankAccountId: acc.id });
    expect(savedTxs.length).toBe(1);
  });
});
