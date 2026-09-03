import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors, sendJson, parseJsonBody } from '../lib/cors';
import { createRequisition, isMockMode, getSecretCredentials } from '../lib/gocardless';
import { mockCreateRequisition } from '../lib/mock';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const institutionId = body.institutionId || 'ING_INGBNL2A';
    const reference = body.reference || `paytrack_ref_${Date.now()}`;
    const { redirectUri } = getSecretCredentials();
    const redirectUrl = body.redirectUrl || redirectUri || `https://${req.headers.host}/api/bank/callback`;

    const result = isMockMode()
      ? mockCreateRequisition(institutionId, redirectUrl, reference)
      : await createRequisition(institutionId, redirectUrl, reference);

    sendJson(res, 200, {
      requisitionId: result.id,
      link: result.link,
      institutionId,
    });
  } catch (err: any) {
    console.error('[Serverless connect error]', err);
    sendJson(res, 500, { error: 'Failed to initiate bank connection', details: err.message });
  }
}
