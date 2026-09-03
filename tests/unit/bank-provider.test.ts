import { describe, it, expect } from 'vitest';
import {
  mockGetInstitutions,
  mockStartAuthorization,
  mockExchangeCodeForSession,
  mockGetSession,
  mockGetAccountDetails,
  mockGetAccountBalances,
  mockGetAccountTransactions,
} from '../../api/_lib/mock';
import { createEnableBankingJwt } from '../../api/_lib/enableBanking';

describe('Enable Banking Provider & Mock Engine', () => {
  describe('Mock Serverless Data', () => {
    it('returns Dutch institutions with ING Netherlands listed first', () => {
      const institutions = mockGetInstitutions();
      expect(institutions.length).toBeGreaterThan(0);
      const ing = institutions.find((i) => i.id === 'ING');
      expect(ing).toBeDefined();
      expect(ing?.name).toBe('ING Netherlands');
    });

    it('creates authorization session and returns redirect URL', () => {
      const { url, sessionId } = mockStartAuthorization(
        'ING',
        'https://paytrack.app/api/bank/callback',
        'csrf_test_state_123'
      );
      expect(sessionId).toBeDefined();
      expect(url).toContain('https://paytrack.app/api/bank/callback');
      expect(url).toContain('csrf_test_state_123');
    });

    it('exchanges code for session details and linked accounts', () => {
      const session = mockExchangeCodeForSession('code_abc_123');
      expect(session.id).toBe('session_code_abc_123');
      expect(session.status).toBe('AUTHORIZED');
      expect(session.accounts.length).toBeGreaterThan(0);
      expect(session.accounts[0]).toBe('NL91INGB0001234567');
    });

    it('fetches session details and linked accounts', () => {
      const session = mockGetSession('session_mock_default');
      expect(session.accounts).toContain('NL91INGB0001234567');
      expect(session.status).toBe('AUTHORIZED');
    });

    it('returns realistic ING Netherlands account details and balance', () => {
      const details = mockGetAccountDetails('NL91INGB0001234567');
      expect(details.iban).toBe('NL91INGB0001234567');
      expect(details.bankName).toBe('ING Netherlands');

      const balances = mockGetAccountBalances('NL91INGB0001234567');
      expect(balances.balance).toBeGreaterThan(0);
      expect(balances.currency).toBe('EUR');
    });

    it('provides realistic Dutch bank transactions including €160 Monday rent', () => {
      const txs = mockGetAccountTransactions('NL91INGB0001234567');
      expect(txs.length).toBeGreaterThan(0);

      const rentTx = txs.find((t) => t.amount === -160.0 && t.remittanceInformation?.includes('huur'));
      expect(rentTx).toBeDefined();

      const ahTx = txs.find((t) => t.creditorName?.includes('Albert Heijn'));
      expect(ahTx).toBeDefined();

      const mediaMarktTx = txs.find((t) => t.creditorName?.includes('MediaMarkt'));
      expect(mediaMarktTx).toBeDefined();
      expect(mediaMarktTx?.amount).toBe(-160.0);
    });
  });

  describe('Enable Banking Serverless Secret Enforcement', () => {
    it('throws descriptive error when ENABLE_BANKING_APP_ID or ENABLE_BANKING_PRIVATE_KEY are missing', () => {
      const origAppId = process.env.ENABLE_BANKING_APP_ID;
      const origKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
      delete process.env.ENABLE_BANKING_APP_ID;
      delete process.env.ENABLE_BANKING_PRIVATE_KEY;

      expect(() => createEnableBankingJwt()).toThrow(
        'Enable Banking server credentials (ENABLE_BANKING_APP_ID or ENABLE_BANKING_PRIVATE_KEY) are missing in environment.'
      );

      if (origAppId) process.env.ENABLE_BANKING_APP_ID = origAppId;
      if (origKey) process.env.ENABLE_BANKING_PRIVATE_KEY = origKey;
    });
  });
});
