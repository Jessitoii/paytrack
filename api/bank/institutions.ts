import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { handleCors, sendJson } from '../lib/cors';
import { getInstitutions, isMockMode } from '../lib/gocardless';
import { mockGetInstitutions } from '../lib/mock';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const country = parsedUrl.searchParams.get('country') || 'NL';

    const institutions = isMockMode()
      ? mockGetInstitutions()
      : await getInstitutions(country);

    sendJson(res, 200, { institutions });
  } catch (err: any) {
    console.error('[Serverless institutions error]', err);
    sendJson(res, 500, { error: 'Failed to retrieve institutions list', details: err.message });
  }
}
