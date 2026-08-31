import type { FastifyPluginAsync } from 'fastify';
import { AuthService, registerSchema, loginSchema } from './auth.service.js';
import { authenticate } from '../../middleware/auth.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/register
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      const user = await AuthService.register(body);
      const token = fastify.jwt.sign({ userId: user.id, email: user.email });

      return reply.status(201).send({
        user,
        token,
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      const user = await AuthService.login(body);
      const token = fastify.jwt.sign({ userId: user.id, email: user.email });

      return reply.send({
        user,
        token,
      });
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message,
      });
    }
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const user = await AuthService.getMe(request.userPayload!.userId);
      return reply.send({ user });
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message,
      });
    }
  });
};
