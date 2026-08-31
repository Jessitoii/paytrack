import { prisma } from '../../db/prisma.js';
import { z } from 'zod';
import { roundFinishDateTo5Minutes } from '../../../../shared/time/rounding.js';
import { calculateWorkSession } from '../../../../shared/time/periods.js';
import type { TimeBreak } from '../../../../shared/types/time.js';

export const startWorkSchema = z.object({
  shiftId: z.string().optional(),
  actualStart: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const breakInputSchema = z.object({
  type: z.enum(['PAID_15', 'UNPAID_30', 'PAID_15_EXTRA', 'CUSTOM']),
  durationMinutes: z.number().int().positive(),
  isPaid: z.boolean(),
  name: z.string().optional(),
});

export const finishWorkSchema = z.object({
  rawFinish: z.coerce.date().optional(),
  breaks: z.array(breakInputSchema).optional(),
  notes: z.string().optional(),
});

export const updateWorkSchema = z.object({
  shiftId: z.string().nullable().optional(),
  actualStart: z.coerce.date().optional(),
  rawFinish: z.coerce.date().nullable().optional(),
  breaks: z.array(breakInputSchema).optional(),
  status: z.enum(['WORKING', 'COMPLETED', 'EDITED', 'CANCELLED']).optional(),
  notes: z.string().nullable().optional(),
});

export class WorkService {
  /**
   * 1-Tap Start Work.
   */
  static async startWork(userId: string, input: z.infer<typeof startWorkSchema>) {
    const actualStart = input.actualStart ?? new Date();

    const session = await prisma.workSession.create({
      data: {
        userId,
        shiftId: input.shiftId,
        actualStart,
        status: 'WORKING',
        notes: input.notes,
        isManualEntry: input.actualStart !== undefined,
      },
      include: {
        breaks: true,
        shift: true,
      },
    });

    return session;
  }

  /**
   * 1-Tap Finish Work with 5-minute upward rounding & deterministic break calculation.
   */
  static async finishWork(userId: string, sessionId: string, input: z.infer<typeof finishWorkSchema>) {
    const session = await prisma.workSession.findFirst({
      where: { id: sessionId, userId },
      include: { breaks: true },
    });

    if (!session) {
      throw new Error('Work session not found or unauthorized');
    }

    const rawFinish = input.rawFinish ?? new Date();
    const roundedFinish = roundFinishDateTo5Minutes(rawFinish);

    // If breaks provided in finish payload, replace or add them
    if (input.breaks && input.breaks.length > 0) {
      await prisma.workBreak.deleteMany({ where: { workSessionId: sessionId } });
      await prisma.workBreak.createMany({
        data: input.breaks.map((b) => ({
          workSessionId: sessionId,
          type: b.type,
          durationMinutes: b.durationMinutes,
          isPaid: b.isPaid,
          name: b.name,
        })),
      });
    }

    // Retrieve active breaks for calculation
    const allBreaks = await prisma.workBreak.findMany({ where: { workSessionId: sessionId } });
    const domainBreaks: TimeBreak[] = allBreaks.map((b) => ({
      id: b.id,
      type: b.type.toLowerCase() as any,
      durationMinutes: b.durationMinutes,
      isPaid: b.isPaid,
      name: b.name ?? undefined,
    }));

    // Calculate deterministic session metrics using shared calculation engine
    const calculation = calculateWorkSession(session.actualStart, rawFinish, domainBreaks);

    const updated = await prisma.workSession.update({
      where: { id: sessionId },
      data: {
        rawFinish,
        roundedFinish,
        elapsedMinutes: calculation.elapsedMinutes,
        paidMinutes: calculation.paidMinutes,
        status: 'COMPLETED',
        notes: input.notes ?? session.notes,
      },
      include: {
        breaks: true,
        shift: true,
      },
    });

    return {
      session: updated,
      calculation,
    };
  }

  /**
   * Update work session with automatic recalculation of derived cache fields.
   */
  static async updateWork(userId: string, sessionId: string, input: z.infer<typeof updateWorkSchema>) {
    const session = await prisma.workSession.findFirst({
      where: { id: sessionId, userId },
      include: { breaks: true },
    });

    if (!session) {
      throw new Error('Work session not found or unauthorized');
    }

    const actualStart = input.actualStart ?? session.actualStart;
    const rawFinish = input.rawFinish !== undefined ? input.rawFinish : session.rawFinish;
    const roundedFinish = rawFinish ? roundFinishDateTo5Minutes(rawFinish) : null;

    if (input.breaks) {
      await prisma.workBreak.deleteMany({ where: { workSessionId: sessionId } });
      await prisma.workBreak.createMany({
        data: input.breaks.map((b) => ({
          workSessionId: sessionId,
          type: b.type,
          durationMinutes: b.durationMinutes,
          isPaid: b.isPaid,
          name: b.name,
        })),
      });
    }

    const allBreaks = await prisma.workBreak.findMany({ where: { workSessionId: sessionId } });
    const domainBreaks: TimeBreak[] = allBreaks.map((b) => ({
      id: b.id,
      type: b.type.toLowerCase() as any,
      durationMinutes: b.durationMinutes,
      isPaid: b.isPaid,
      name: b.name ?? undefined,
    }));

    let elapsedMinutes = 0;
    let paidMinutes = 0;
    let calculation = null;

    if (rawFinish) {
      calculation = calculateWorkSession(actualStart, rawFinish, domainBreaks);
      elapsedMinutes = calculation.elapsedMinutes;
      paidMinutes = calculation.paidMinutes;
    }

    const updated = await prisma.workSession.update({
      where: { id: sessionId },
      data: {
        shiftId: input.shiftId !== undefined ? input.shiftId : session.shiftId,
        actualStart,
        rawFinish,
        roundedFinish,
        elapsedMinutes,
        paidMinutes,
        status: input.status ?? (rawFinish ? 'EDITED' : session.status),
        isManualEntry: true,
        notes: input.notes !== undefined ? input.notes : session.notes,
      },
      include: {
        breaks: true,
        shift: true,
      },
    });

    return {
      session: updated,
      calculation,
    };
  }

  /**
   * List work sessions with optional filters.
   */
  static async listWorkSessions(
    userId: string,
    filters?: { startDate?: Date; endDate?: Date; status?: string }
  ) {
    const where: any = { userId };

    if (filters?.startDate || filters?.endDate) {
      where.actualStart = {};
      if (filters.startDate) where.actualStart.gte = filters.startDate;
      if (filters.endDate) where.actualStart.lte = filters.endDate;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const sessions = await prisma.workSession.findMany({
      where,
      include: {
        breaks: true,
        shift: true,
      },
      orderBy: { actualStart: 'desc' },
    });

    return sessions;
  }

  /**
   * Get single work session with full calculation breakdown.
   */
  static async getWorkSession(userId: string, sessionId: string) {
    const session = await prisma.workSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        breaks: true,
        shift: true,
      },
    });

    if (!session) {
      throw new Error('Work session not found or unauthorized');
    }

    let calculation = null;
    if (session.rawFinish) {
      const domainBreaks: TimeBreak[] = session.breaks.map((b) => ({
        id: b.id,
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: b.isPaid,
        name: b.name ?? undefined,
      }));
      calculation = calculateWorkSession(session.actualStart, session.rawFinish, domainBreaks);
    }

    return {
      session,
      calculation,
    };
  }

  /**
   * Delete work session.
   */
  static async deleteWorkSession(userId: string, sessionId: string) {
    const session = await prisma.workSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Work session not found or unauthorized');
    }

    await prisma.workSession.delete({
      where: { id: sessionId },
    });

    return { success: true };
  }
}
