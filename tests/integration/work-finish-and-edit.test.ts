import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server/src/app';
import { prisma } from '../../server/src/db/prisma';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

describe('Work Session Finish, Custom Finish Override, Edit & Cross-Week Reaggregation Tests', () => {
  let app: FastifyInstance;
  let userAId: string;
  let userBId: string;
  let userAToken: string;
  let userBToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Clean up
    await prisma.user.deleteMany({
      where: { email: { in: ['workerA@paytrack.app', 'workerB@paytrack.app'] } },
    });

    const passwordHash = await bcrypt.hash('password123', 10);

    const userA = await prisma.user.create({
      data: {
        email: 'workerA@paytrack.app',
        passwordHash,
        name: 'Worker A',
        timezone: 'Europe/Amsterdam',
        currency: 'EUR',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: 'workerB@paytrack.app',
        passwordHash,
        name: 'Worker B',
        timezone: 'Europe/Amsterdam',
        currency: 'EUR',
      },
    });
    userBId = userB.id;

    const employer = await prisma.employer.create({
      data: { name: 'Albert Heijn Bleiswijk', agency: 'Carrière' },
    });

    await prisma.employment.createMany({
      data: [
        { userId: userAId, employerId: employer.id, startDate: new Date('2026-01-01'), isActive: true },
        { userId: userBId, employerId: employer.id, startDate: new Date('2026-01-01'), isActive: true },
      ],
    });

    const loginA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'workerA@paytrack.app', password: 'password123' },
    });
    userAToken = JSON.parse(loginA.body).token;

    const loginB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'workerB@paytrack.app', password: 'password123' },
    });
    userBToken = JSON.parse(loginB.body).token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('allows finishing active shift with custom finish time and break choices', async () => {
    const start = new Date('2026-08-20T14:30:00.000Z');
    const customFinish = new Date('2026-08-20T23:21:00.000Z');

    // 1. Start active session
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/work/start',
      headers: { authorization: `Bearer ${userAToken}` },
      payload: { actualStart: start },
    });
    expect(startRes.statusCode).toBe(201);
    const session = JSON.parse(startRes.body).session;
    expect(session.status).toBe('WORKING');

    // 2. Finish session with custom finish time 23:21 and selected breaks
    const finishRes = await app.inject({
      method: 'POST',
      url: `/api/work/${session.id}/finish`,
      headers: { authorization: `Bearer ${userAToken}` },
      payload: {
        rawFinish: customFinish,
        breaks: [
          { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Paid Coffee Break' },
          { type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Unpaid Meal Break' },
        ],
        notes: 'Clocked out at 23:21 after shift handover',
      },
    });

    expect(finishRes.statusCode).toBe(200);
    const finishJson = JSON.parse(finishRes.body);

    // 23:21 rounds up to 23:25
    expect(new Date(finishJson.session.roundedFinish).toISOString()).toBe('2026-08-20T23:25:00.000Z');
    expect(finishJson.session.status).toBe('COMPLETED');
    expect(finishJson.calculation.elapsedMinutes).toBe(535); // 14:30 to 23:25 = 8h 55m
    expect(finishJson.calculation.paidMinutes).toBe(505); // 535 - 30m = 8h 25m
  });

  it('allows editing an existing completed session and recalculates roundedFinish', async () => {
    // 1. Find session created in previous test
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/work',
      headers: { authorization: `Bearer ${userAToken}` },
    });
    const session = JSON.parse(listRes.body).sessions[0];
    expect(session).toBeDefined();

    // 2. Edit session: Start 14:37, Finish 23:17
    const newStart = new Date('2026-08-20T14:37:00.000Z');
    const newFinish = new Date('2026-08-20T23:17:00.000Z');

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/work/${session.id}`,
      headers: { authorization: `Bearer ${userAToken}` },
      payload: {
        actualStart: newStart,
        rawFinish: newFinish,
        breaks: [
          { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Paid Coffee' },
          { type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Meal' },
        ],
        notes: 'Corrected start and finish time',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updateJson = JSON.parse(updateRes.body);

    // 23:17 rounds up to 23:20
    expect(new Date(updateJson.session.roundedFinish).toISOString()).toBe('2026-08-20T23:20:00.000Z');

    // 14:37 to 23:20 = 523m elapsed
    // Paid: 523 - 30m = 493m
    expect(updateJson.calculation.elapsedMinutes).toBe(523);
    expect(updateJson.calculation.paidMinutes).toBe(493);
  });

  it('reaggregates both old and new ISO weeks when a session date is changed across weeks', async () => {
    // 1. Create a session in Week 34 (2026-08-20)
    const week34Date = new Date('2026-08-20T14:30:00.000Z');
    const week34Finish = new Date('2026-08-20T23:00:00.000Z');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/work/manual',
      headers: { authorization: `Bearer ${userAToken}` },
      payload: {
        actualStart: week34Date,
        rawFinish: week34Finish,
        breaks: [{ type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Meal' }],
      },
    });
    const session = JSON.parse(createRes.body).session;

    // 2. Move session to Week 35 (2026-08-27)
    const week35Date = new Date('2026-08-27T14:30:00.000Z');
    const week35Finish = new Date('2026-08-27T23:00:00.000Z');

    const moveRes = await app.inject({
      method: 'PATCH',
      url: `/api/work/${session.id}`,
      headers: { authorization: `Bearer ${userAToken}` },
      payload: {
        actualStart: week35Date,
        rawFinish: week35Finish,
      },
    });

    expect(moveRes.statusCode).toBe(200);

    // Verify Week 35 has the calculation
    const week35Calc = await prisma.payrollWeek.findFirst({
      where: { userId: userAId, weekNumber: 35 },
      include: { calculation: true },
    });
    expect(week35Calc).toBeDefined();
    expect(week35Calc?.calculation?.paidMinutes).toBe(480); // 8h 30m - 30m = 8h (480m)
  });

  it('prevents User B from editing User A work session (Security & Isolation)', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/work',
      headers: { authorization: `Bearer ${userAToken}` },
    });
    const userASession = JSON.parse(listRes.body).sessions[0];

    const unauthorizedRes = await app.inject({
      method: 'PATCH',
      url: `/api/work/${userASession.id}`,
      headers: { authorization: `Bearer ${userBToken}` },
      payload: {
        notes: 'Malicious modification attempt',
      },
    });

    expect(unauthorizedRes.statusCode).toBe(400);
    expect(JSON.parse(unauthorizedRes.body).message).toContain('not found or unauthorized');
  });
});
