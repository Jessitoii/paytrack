import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors, sendJson, parseJsonBody } from '../lib/cors';
import {
  getAccountTransactions,
  getAccountBalances,
  isMockMode,
} from '../lib/gocardless';
import {
  mockGetAccountTransactions,
  mockGetAccountBalances,
} from '../lib/mock';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const accountId = body.accountId;
    const dateFrom = body.dateFrom;

    if (!accountId) {
      sendJson(res, 400, { error: 'Missing accountId in request body.' });
      return;
    }

    const mock = isMockMode();
    const transactions = mock
      ? mockGetAccountTransactions(accountId)
      : await getAccountTransactions(accountId, dateFrom);

    let balances = null;
    try {
      balances = mock
        ? mockGetAccountBalances(accountId)
        : await getAccountBalances(accountId);
    } catch (_) {}

    sendJson(res, 200, {
      accountId,
      balances,
      transactions,
      count: transactions.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Serverless sync error]', err);
    sendJson(res, 500, { error: 'Failed to sync bank transactions', details: err.message });
  }
}
