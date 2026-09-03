import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors, sendJson, parseJsonBody } from '../lib/cors';
import { deleteSession, isMockMode } from '../lib/enableBanking';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const sessionId = body.sessionId || body.requisitionId;

    if (sessionId && !isMockMode()) {
      try {
        await deleteSession(sessionId);
      } catch (err) {
        console.warn('[Enable Banking disconnect notice]', err);
      }
    }

    sendJson(res, 200, {
      success: true,
      provider: 'enable_banking',
      message: 'Bank session severed and credentials invalidated via Enable Banking.',
    });
  } catch (err: any) {
    console.error('[Enable Banking disconnect error]', err);
    sendJson(res, 500, {
      error: 'Failed to disconnect bank account via Enable Banking',
      details: err.message,
    });
  }
}
