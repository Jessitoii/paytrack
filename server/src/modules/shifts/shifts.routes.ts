import type { FastifyPluginAsync } from 'fastify';
import {
  ShiftsService,
  createShiftSchema,
  updateShiftSchema,
  bulkSaveWeekSchema,
  copyPreviousWeekSchema,
} from './shifts.service.js';
import { authenticate } from '../../middleware/auth.js';

export const shiftsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  // POST /api/shifts (Single shift)
  fastify.post('/', async (request, reply) => {
    try {
      const body = createShiftSchema.parse(request.body);
      const shift = await ShiftsService.createShift(request.userPayload!.userId, body);
      return reply.status(201).send({ shift });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // POST /api/shifts/bulk-week (Atomic entire week save Mon-Sun)
  fastify.post('/bulk-week', async (request, reply) => {
    try {
      const body = bulkSaveWeekSchema.parse(request.body);
      const shifts = await ShiftsService.bulkSaveWeek(request.userPayload!.userId, body);
      return reply.status(200).send({ shifts });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // POST /api/shifts/copy-previous-week (Atomic week duplicate)
  fastify.post('/copy-previous-week', async (request, reply) => {
    try {
      const body = copyPreviousWeekSchema.parse(request.body);
      const shifts = await ShiftsService.copyPreviousWeek(request.userPayload!.userId, body);
      return reply.status(200).send({ shifts });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // PATCH /api/shifts/:id
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const body = updateShiftSchema.parse(request.body ?? {});
      const shift = await ShiftsService.updateShift(
        request.userPayload!.userId,
        request.params.id,
        body
      );
      return reply.send({ shift });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // GET /api/shifts
  fastify.get<{
    Querystring: { startDate?: string; endDate?: string };
  }>('/', async (request, reply) => {
    try {
      const filters = {
        startDate: request.query.startDate ? new Date(request.query.startDate) : undefined,
        endDate: request.query.endDate ? new Date(request.query.endDate) : undefined,
      };
      const shifts = await ShiftsService.listShifts(request.userPayload!.userId, filters);
      return reply.send({ shifts });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // DELETE /api/shifts/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const result = await ShiftsService.deleteShift(
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
