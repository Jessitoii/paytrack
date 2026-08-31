import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { workRoutes } from './modules/work/work.routes.js';
import { shiftsRoutes } from './modules/shifts/shifts.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
  });

  // Plugins
  app.register(cors, {
    origin: true,
  });

  app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Health Endpoint
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'PayTrack API',
    };
  });

  // API Routes
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(workRoutes, { prefix: '/api/work' });
  app.register(shiftsRoutes, { prefix: '/api/shifts' });

  // Global Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    request.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
    });
  });

  return app;
}
