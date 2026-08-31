import type { FastifyPluginAsync } from 'fastify';
import { PayslipsService } from './payslips.service.js';
import { confirmPayslipSchema } from '../../../../shared/schemas/payslip.schema.js';
import { authenticate } from '../../middleware/auth.js';

export const payslipsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  // POST /api/payslips/upload
  fastify.post('/upload', async (request, reply) => {
    try {
      let fileBuffer: Buffer | null = null;
      let fileName = 'payslip.pdf';
      let preferredProvider: 'groq' | 'cerebras' | 'mock' | undefined;

      // Handle multipart file upload if multipart content-type
      if (request.isMultipart()) {
        const data = await request.file();
        if (!data) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file provided in upload' });
        }
        fileBuffer = await data.toBuffer();
        fileName = data.filename || 'payslip.pdf';
        
        const fields: any = data.fields;
        if (fields?.provider?.value) {
          preferredProvider = fields.provider.value as any;
        }
      } else {
        // Fallback for direct JSON / Base64 payload in tests/API clients
        const body: any = request.body;
        if (!body?.fileBase64) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No PDF file payload provided' });
        }
        fileBuffer = Buffer.from(body.fileBase64, 'base64');
        fileName = body.fileName || 'payslip.pdf';
        preferredProvider = body.provider;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Uploaded file is empty' });
      }

      const result = await PayslipsService.uploadAndParse(
        request.userPayload!.userId,
        fileBuffer,
        fileName,
        preferredProvider
      );

      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // POST /api/payslips/:id/confirm
  fastify.post<{ Params: { id: string } }>('/:id/confirm', async (request, reply) => {
    try {
      const body = confirmPayslipSchema.parse(request.body);
      const confirmedPayslip = await PayslipsService.confirmPayslip(
        request.userPayload!.userId,
        request.params.id,
        body
      );
      return reply.send({ payslip: confirmedPayslip });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // GET /api/payslips/:id/reconcile
  fastify.get<{ Params: { id: string } }>('/:id/reconcile', async (request, reply) => {
    try {
      const reconciliation = await PayslipsService.reconcilePayslip(
        request.userPayload!.userId,
        request.params.id
      );
      return reply.send(reconciliation);
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message,
      });
    }
  });

  // GET /api/payslips
  fastify.get('/', async (request, reply) => {
    try {
      const payslips = await PayslipsService.listPayslips(request.userPayload!.userId);
      return reply.send({ payslips });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });

  // GET /api/payslips/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const payslip = await PayslipsService.getPayslip(
        request.userPayload!.userId,
        request.params.id
      );
      return reply.send({ payslip });
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message,
      });
    }
  });

  // DELETE /api/payslips/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const result = await PayslipsService.deletePayslip(
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
