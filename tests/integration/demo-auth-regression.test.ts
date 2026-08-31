import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server/src/app';
import { prisma } from '../../server/src/db/prisma';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

describe('Demo Account Authentication Regression Test Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Ensure demo account exists in test database
    await prisma.user.deleteMany({ where: { email: 'demo@paytrack.app' } });

    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        email: 'demo@paytrack.app',
        passwordHash,
        name: 'Alper Ozer',
        timezone: 'Europe/Amsterdam',
        currency: 'EUR',
        initialSavings: 1500.0,
      },
    });

    const employer = await prisma.employer.create({
      data: { name: 'Albert Heijn Bleiswijk', agency: 'Carrière' },
    });

    await prisma.employment.create({
      data: {
        userId: user.id,
        employerId: employer.id,
        startDate: new Date('2026-01-01'),
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('authenticates demo account with password123 successfully and returns JWT token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'demo@paytrack.app',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.token).toBeDefined();
    expect(json.user.email).toBe('demo@paytrack.app');
    expect(json.user.name).toBe('Alper Ozer');

    // Verify GET /api/auth/me with the issued JWT
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${json.token}` },
    });

    expect(meRes.statusCode).toBe(200);
    const meJson = JSON.parse(meRes.body);
    expect(meJson.user.email).toBe('demo@paytrack.app');
    expect(meJson.user.employments.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects demo account when given an incorrect password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'demo@paytrack.app',
        password: 'wrongPassword999',
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toContain('Invalid email or password');
  });
});
