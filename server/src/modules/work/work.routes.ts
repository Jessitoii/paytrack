import type { FastifyPluginAsync } from 'fastify';
import {
  WorkService,
  startWorkSchema,
  finishWorkSchema,
  updateWorkSchema,
} from './work.service.js';
import { authenticate } from '../../middleware/auth.js';

export const workRoutes: FastifyPluginAsync = async (fastify) => {
  // All work routes require authentication
  fastify.addHook('preHandler', authenticate);

  // POST /api/work/start
  fastify.post('/start', async (request, reply) => {
    try {
      const body = startWorkSchema.parse(request.body ?? {});
      const session = await WorkService.startWork(request.userPayload!.userId, body);
      return reply.status(201).send({ session });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // POST /api/work/:id/finish
  fastify.post<{ Params: { id: string } }>('/:id/finish', async (request, reply) => {
    try {
      const body = finishWorkSchema.parse(request.body ?? {});
      const result = await WorkService.finishWork(
        request.userPayload!.userId,
        request.params.id,
        body
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // PATCH /api/work/:id
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const body = updateWorkSchema.parse(request.body ?? {});
      const result = await WorkService.updateWork(
        request.userPayload!.userId,
        request.params.id,
        body
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // GET /api/work
  fastify.get<{
    Querystring: { startDate?: string; endDate?: string; status?: string };
  }>('/', async (request, reply) => {
    try {
      const filters = {
        startDate: request.query.startDate ? new Date(request.query.startDate) : undefined,
        endDate: request.query.endDate ? new Date(request.query.endDate) : undefined,
        status: request.query.status,
      };
      const sessions = await WorkService.listWorkSessions(request.userPayload!.userId, filters);
      return reply.send({ sessions });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // GET /api/work/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const result = await WorkService.getWorkSession(
        request.userPayload!.userId,
        request.params.id
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message,
      });
    }
  });

  // DELETE /api/work/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const result = await WorkService.deleteWorkSession(
        request.userPayload!.userId,
        request.params.id
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message,
      });
    }
  });
};
