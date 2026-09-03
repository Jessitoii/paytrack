import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors, sendJson } from '../lib/cors';
import { isMockMode } from '../lib/gocardless';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (handleCors(req, res)) return;

  sendJson(res, 200, {
    status: 'ok',
    runtime: 'serverless',
    mode: isMockMode() ? 'mock' : 'gocardless',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
}
