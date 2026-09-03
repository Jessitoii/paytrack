import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendJson } from '../lib/cors';
import {
  getRequisition,
  getAccountDetails,
  getAccountBalances,
  isMockMode,
} from '../lib/gocardless';
import {
  mockGetRequisition,
  mockGetAccountDetails,
  mockGetAccountBalances,
} from '../lib/mock';
import { BankAccountBalances } from '../lib/types';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const requisitionId = parsedUrl.searchParams.get('requisitionId');

    if (!requisitionId) {
      sendJson(res, 400, { error: 'Missing requisitionId query parameter.' });
      return;
    }

    const mock = isMockMode();
    const requisition = mock
      ? mockGetRequisition(requisitionId)
      : await getRequisition(requisitionId);

    const accountIds = requisition.accounts || [];

    const accountsWithDetails = await Promise.all(
      accountIds.map(async (accId) => {
        try {
          const details = mock
            ? mockGetAccountDetails(accId)
            : await getAccountDetails(accId);

          let balances: BankAccountBalances = { balance: 0.0, availableBalance: null, currency: 'EUR' };
          try {
            balances = mock
              ? mockGetAccountBalances(accId)
              : await getAccountBalances(accId);
          } catch (balErr) {
            console.warn(`[Accounts] Could not fetch balances for account ${accId}:`, balErr);
          }

          return {
            id: accId,
            iban: details.iban,
            accountName: details.accountName || details.ownerName || 'ING Checking Account',
            currency: details.currency || balances.currency || 'EUR',
            balance: balances.balance,
            availableBalance: balances.availableBalance,
            status: details.status || 'READY',
            bankName: details.bankName || 'ING Netherlands',
          };
        } catch (err: any) {
          console.error(`[Accounts] Error for account ${accId}:`, err);
          return null;
        }
      })
    );

    const validAccounts = accountsWithDetails.filter(Boolean);
    sendJson(res, 200, {
      requisitionId,
      status: requisition.status,
      accounts: validAccounts,
    });
  } catch (err: any) {
    console.error('[Serverless accounts error]', err);
    sendJson(res, 500, { error: 'Failed to retrieve accounts', details: err.message });
  }
}
