import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma.js';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  timezone: z.string().default('Europe/Amsterdam'),
  currency: z.string().default('EUR'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthService {
  static async register(input: z.infer<typeof registerSchema>) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        timezone: input.timezone,
        currency: input.currency,
      },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        currency: true,
        createdAt: true,
      },
    });

    return user;
  }

  static async login(input: z.infer<typeof loginSchema>) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      currency: user.currency,
    };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        currency: true,
        initialSavings: true,
        employments: {
          where: { isActive: true },
          include: {
            employer: true,
            payrollConfigurations: {
              where: { isDefault: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}
