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

export const bulkShiftItemSchema = z.object({
  date: z.coerce.date(),
  shiftType: z.enum(['MORNING', 'AFTERNOON', 'NIGHT', 'OFF', 'CUSTOM']),
  plannedStart: z.coerce.date().optional(),
  plannedEnd: z.coerce.date().optional(),
  isDayOff: z.boolean().default(false),
  notes: z.string().optional(),
});

export const bulkSaveWeekSchema = z.object({
  weekStartDate: z.coerce.date(), // Monday
  shifts: z.array(bulkShiftItemSchema).min(1).max(14),
});

export const copyPreviousWeekSchema = z.object({
  targetWeekStartDate: z.coerce.date(), // Target Monday
});

export class ShiftsService {
  /**
   * Create or update single day shift.
   */
  static async createShift(userId: string, input: z.infer<typeof createShiftSchema>) {
    let employmentId = input.employmentId;

    if (employmentId) {
      const userEmployment = await prisma.employment.findFirst({
        where: { id: employmentId, userId },
      });
      if (!userEmployment) {
        throw new Error('Employment profile not found or unauthorized');
      }
    } else {
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
   * Atomic Bulk Save for an entire week (Mon-Sun) inside a Prisma transaction.
   */
  static async bulkSaveWeek(userId: string, input: z.infer<typeof bulkSaveWeekSchema>) {
    const activeEmployment = await prisma.employment.findFirst({
      where: { userId, isActive: true },
    });

    if (!activeEmployment) {
      throw new Error('No active employment found. Please configure employment profile first.');
    }

    const mon = new Date(input.weekStartDate);
    mon.setHours(0, 0, 0, 0);

    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    return prisma.$transaction(async (tx) => {
      // 1. Delete existing shifts in this week's date window
      await tx.shift.deleteMany({
        where: {
          userId,
          date: { gte: mon, lte: sun },
        },
      });

      // 2. Create new shifts
      const created = [];
      for (const item of input.shifts) {
        const isDayOff = item.isDayOff ?? (item.shiftType === 'OFF');
        const shift = await tx.shift.create({
          data: {
            userId,
            employmentId: activeEmployment.id,
            date: item.date,
            shiftType: item.shiftType,
            plannedStart: isDayOff ? null : item.plannedStart,
            plannedEnd: isDayOff ? null : item.plannedEnd,
            isDayOff,
            notes: item.notes,
          },
          include: {
            employment: { include: { employer: true } },
          },
        });
        created.push(shift);
      }

      return created;
    });
  }

  /**
   * Copy previous week shifts into target week atomically.
   */
  static async copyPreviousWeek(userId: string, input: z.infer<typeof copyPreviousWeekSchema>) {
    const activeEmployment = await prisma.employment.findFirst({
      where: { userId, isActive: true },
    });

    if (!activeEmployment) {
      throw new Error('No active employment found.');
    }

    const targetMon = new Date(input.targetWeekStartDate);
    targetMon.setHours(0, 0, 0, 0);

    const prevMon = new Date(targetMon);
    prevMon.setDate(targetMon.getDate() - 7);
    prevMon.setHours(0, 0, 0, 0);

    const prevSun = new Date(prevMon);
    prevSun.setDate(prevMon.getDate() + 6);
    prevSun.setHours(23, 59, 59, 999);

    // Fetch previous week's shifts
    const prevShifts = await prisma.shift.findMany({
      where: {
        userId,
        date: { gte: prevMon, lte: prevSun },
      },
      orderBy: { date: 'asc' },
    });

    if (prevShifts.length === 0) {
      throw new Error('No shifts found in the previous week to copy.');
    }

    const targetSun = new Date(targetMon);
    targetSun.setDate(targetMon.getDate() + 6);
    targetSun.setHours(23, 59, 59, 999);

    return prisma.$transaction(async (tx) => {
      // Clear target week
      await tx.shift.deleteMany({
        where: {
          userId,
          date: { gte: targetMon, lte: targetSun },
        },
      });

      const copied = [];
      for (const shift of prevShifts) {
        // Shift date by +7 days
        const newDate = new Date(shift.date);
        newDate.setDate(newDate.getDate() + 7);

        let newStart: Date | null = null;
        let newEnd: Date | null = null;

        if (shift.plannedStart) {
          newStart = new Date(shift.plannedStart);
          newStart.setDate(newStart.getDate() + 7);
        }
        if (shift.plannedEnd) {
          newEnd = new Date(shift.plannedEnd);
          newEnd.setDate(newEnd.getDate() + 7);
        }

        const newShift = await tx.shift.create({
          data: {
            userId,
            employmentId: activeEmployment.id,
            date: newDate,
            shiftType: shift.shiftType,
            plannedStart: newStart,
            plannedEnd: newEnd,
            isDayOff: shift.isDayOff,
            notes: shift.notes,
          },
          include: {
            employment: { include: { employer: true } },
          },
        });
        copied.push(newShift);
      }

      return copied;
    });
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
   * List shifts with flexible date bounds.
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
