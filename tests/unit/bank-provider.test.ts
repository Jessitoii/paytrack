import { describe, it, expect } from 'vitest';
import {
  mockGetInstitutions,
  mockCreateRequisition,
  mockGetRequisition,
  mockGetAccountDetails,
  mockGetAccountBalances,
  mockGetAccountTransactions,
} from '../../api/lib/mock';
import { getValidAccessToken } from '../../api/lib/gocardless';

describe('Serverless Bank Provider & Mock Engine', () => {
  describe('Mock Serverless Data', () => {
    it('returns Dutch institutions with ING Netherlands listed', () => {
      const institutions = mockGetInstitutions();
      expect(institutions.length).toBeGreaterThan(0);
      const ing = institutions.find((i) => i.id === 'ING_INGBNL2A');
      expect(ing).toBeDefined();
      expect(ing?.name).toBe('ING Netherlands');
    });

    it('creates requisition and returns redirect link', () => {
      const { id, link } = mockCreateRequisition(
        'ING_INGBNL2A',
        'https://paytrack.app/api/bank/callback',
        'ref_test'
      );
      expect(id).toBeDefined();
      expect(link).toContain('https://paytrack.app/api/bank/callback');
    });

    it('fetches requisition details and linked accounts', () => {
      const req = mockGetRequisition('req_mock_default');
      expect(req.accounts).toContain('acc_mock_ing_001');
      expect(req.status).toBe('LN');
    });

    it('returns realistic ING Netherlands account details and balance', () => {
      const details = mockGetAccountDetails('acc_mock_ing_001');
      expect(details.iban).toBe('NL91INGB0001234567');
      expect(details.bankName).toBe('ING Netherlands');

      const balances = mockGetAccountBalances('acc_mock_ing_001');
      expect(balances.balance).toBeGreaterThan(0);
      expect(balances.currency).toBe('EUR');
    });

    it('provides realistic Dutch bank transactions including €160 Monday rent', () => {
      const txs = mockGetAccountTransactions('acc_mock_ing_001');
      expect(txs.length).toBeGreaterThan(0);

      const rentTx = txs.find((t) => t.amount === -160.0);
      expect(rentTx).toBeDefined();
      expect(rentTx?.remittanceInformation).toContain('huur');

      const ahTx = txs.find((t) => t.creditorName?.includes('Albert Heijn'));
      expect(ahTx).toBeDefined();
    });
  });

  describe('GoCardless Serverless Secret Enforcement', () => {
    it('throws error when GC_SECRET_ID or GC_SECRET_KEY are missing from environment', async () => {
      const origId = process.env.GC_SECRET_ID;
      const origKey = process.env.GC_SECRET_KEY;
      delete process.env.GC_SECRET_ID;
      delete process.env.GC_SECRET_KEY;

      await expect(getValidAccessToken()).rejects.toThrow(
        'GoCardless server credentials (GC_SECRET_ID and GC_SECRET_KEY) are missing.'
      );

      if (origId) process.env.GC_SECRET_ID = origId;
      if (origKey) process.env.GC_SECRET_KEY = origKey;
    });
  });
});
