import { prisma } from '../../db/prisma.js';
import { z } from 'zod';

export const createShiftSchema = z.object({
  employmentId: z.string().optional(),
  date: z.coerce.date(),
  shiftType: z.enum(['MORNING', 'AFTERNOON', 'NIGHT', 'OFF', 'CUSTOM']),
  plannedStart: z.coerce.date().optional(),
  plannedEnd: z.coerce.date().optional(),
  isDayOff: z.boolean().default(false),
  notes: z.string().optional(),
});

export const updateShiftSchema = z.object({
  date: z.coerce.date().optional(),
  shiftType: z.enum(['MORNING', 'AFTERNOON', 'NIGHT', 'OFF', 'CUSTOM']).optional(),
  plannedStart: z.coerce.date().nullable().optional(),
  plannedEnd: z.coerce.date().nullable().optional(),
  isDayOff: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export class ShiftsService {
  /**
   * Create planned shift.
   */
  static async createShift(userId: string, input: z.infer<typeof createShiftSchema>) {
    let employmentId = input.employmentId;

    if (!employmentId) {
      const activeEmployment = await prisma.employment.findFirst({
        where: { userId, isActive: true },
      });
      if (!activeEmployment) {
        throw new Error('No active employment found. Please configure employment profile first.');
      }
      employmentId = activeEmployment.id;
    }

    const shift = await prisma.shift.create({
      data: {
        userId,
        employmentId,
        date: input.date,
        shiftType: input.shiftType,
        plannedStart: input.plannedStart,
        plannedEnd: input.plannedEnd,
        isDayOff: input.isDayOff ?? (input.shiftType === 'OFF'),
        notes: input.notes,
      },
      include: {
        employment: { include: { employer: true } },
      },
    });

    return shift;
  }

  /**
   * Update shift.
   */
  static async updateShift(userId: string, shiftId: string, input: z.infer<typeof updateShiftSchema>) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, userId },
    });

    if (!shift) {
      throw new Error('Shift not found or unauthorized');
    }

    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        date: input.date ?? shift.date,
        shiftType: input.shiftType ?? shift.shiftType,
        plannedStart: input.plannedStart !== undefined ? input.plannedStart : shift.plannedStart,
        plannedEnd: input.plannedEnd !== undefined ? input.plannedEnd : shift.plannedEnd,
        isDayOff: input.isDayOff !== undefined ? input.isDayOff : shift.isDayOff,
        notes: input.notes !== undefined ? input.notes : shift.notes,
      },
      include: {
        employment: { include: { employer: true } },
      },
    });

    return updated;
  }

  /**
   * List shifts.
   */
  static async listShifts(userId: string, filters?: { startDate?: Date; endDate?: Date }) {
    const where: any = { userId };

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        employment: { include: { employer: true } },
        workSessions: true,
      },
      orderBy: { date: 'asc' },
    });

    return shifts;
  }

  /**
   * Delete shift.
   */
  static async deleteShift(userId: string, shiftId: string) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, userId },
    });

    if (!shift) {
      throw new Error('Shift not found or unauthorized');
    }

    await prisma.shift.delete({
      where: { id: shiftId },
    });

    return { success: true };
  }
}
