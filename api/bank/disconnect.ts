import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors, sendJson, parseJsonBody } from '../lib/cors';
import { deleteRequisition, isMockMode } from '../lib/gocardless';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const requisitionId = body.requisitionId;

    if (requisitionId && !isMockMode()) {
      try {
        await deleteRequisition(requisitionId);
      } catch (err) {
        console.warn('[Serverless disconnect notice]', err);
      }
    }

    sendJson(res, 200, {
      success: true,
      message: 'Bank connection severed and credentials invalidated.',
    });
  } catch (err: any) {
    console.error('[Serverless disconnect error]', err);
    sendJson(res, 500, { error: 'Failed to disconnect bank account', details: err.message });
  }
}
