import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding development database...');

  // 1. Clean existing records for fresh seed
  await prisma.workBreak.deleteMany();
  await prisma.workSession.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.payrollCalculationComponent.deleteMany();
  await prisma.payrollCalculation.deleteMany();
  await prisma.payrollWeek.deleteMany();
  await prisma.payslipComponent.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.savingsGoal.deleteMany();
  await prisma.payrollConfiguration.deleteMany();
  await prisma.employment.deleteMany();
  await prisma.employer.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.user.deleteMany();

  // 2. Default Expense Categories
  const categories = [
    { name: 'Housing', icon: 'home', color: '#3B82F6', isDefault: true },
    { name: 'Food', icon: 'utensils', color: '#10B981', isDefault: true },
    { name: 'Transportation', icon: 'bus', color: '#F59E0B', isDefault: true },
    { name: 'Health', icon: 'heart', color: '#EF4444', isDefault: true },
    { name: 'Shopping', icon: 'shopping-bag', color: '#8B5CF6', isDefault: true },
    { name: 'Bills', icon: 'file-text', color: '#6B7280', isDefault: true },
    { name: 'Entertainment', icon: 'film', color: '#EC4899', isDefault: true },
    { name: 'Subscriptions', icon: 'credit-card', color: '#06B6D4', isDefault: true },
    { name: 'Travel', icon: 'plane', color: '#14B8A6', isDefault: true },
    { name: 'Other', icon: 'tag', color: '#9CA3AF', isDefault: true },
  ];

  for (const cat of categories) {
    await prisma.expenseCategory.create({ data: cat });
  }

  // 3. Demo User
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

  // 4. Employer & Employment
  const employer = await prisma.employer.create({
    data: {
      name: 'Albert Heijn B.V. Bleiswijk',
      agency: 'Carrière Personeelsdiensten B.V.',
      country: 'NL',
    },
  });

  const employment = await prisma.employment.create({
    data: {
      userId: user.id,
      employerId: employer.id,
      startDate: new Date('2026-01-01'),
      isActive: true,
    },
  });

  // 5. Versioned Payroll Configurations (Weeks 1-12 and Week 13+)
  await prisma.payrollConfiguration.create({
    data: {
      employmentId: employment.id,
      name: 'Carrière - Albert Heijn (2026 W1-W12)',
      effectiveFromDate: new Date('2026-01-01'),
      effectiveUntilDate: new Date('2026-03-22'),
      effectiveFromWeek: 1,
      effectiveUntilWeek: 12,
      baseHourlyRate: 14.99,
      advHourlyRate: 1.35,
      advPercentage: 9.005,
      holidayAllowancePercentage: 8.00,
      holidayEntitlementPercentage: 10.49777,
      pawwRatePercentage: 0.1000,
      azvRatePercentage: 0.7000,
      stippRatePercentage: 7.5000,
      wgaRatePercentage: 0.4050,
      healthInsuranceWeekly: 38.01,
      additionalInsuranceWeekly: 2.76,
      taxEstimationMode: 'CONFIGURABLE_RATE',
      estimatedTaxRatePercentage: 18.0,
      isDefault: true,
    },
  });

  await prisma.payrollConfiguration.create({
    data: {
      employmentId: employment.id,
      name: 'Carrière - Albert Heijn (2026 W13+)',
      effectiveFromDate: new Date('2026-03-23'),
      effectiveFromWeek: 13,
      effectiveUntilWeek: 52,
      baseHourlyRate: 15.13,
      advHourlyRate: 1.36,
      advPercentage: 9.005,
      holidayAllowancePercentage: 8.00,
      holidayEntitlementPercentage: 10.49777,
      pawwRatePercentage: 0.1000,
      azvRatePercentage: 0.7000,
      stippRatePercentage: 7.5000,
      wgaRatePercentage: 0.4050,
      healthInsuranceWeekly: 38.01,
      additionalInsuranceWeekly: 2.76,
      taxEstimationMode: 'CONFIGURABLE_RATE',
      estimatedTaxRatePercentage: 18.0,
      isDefault: false,
    },
  });

  // 6. Sample Planned Shifts
  const mondayShift = await prisma.shift.create({
    data: {
      userId: user.id,
      employmentId: employment.id,
      date: new Date('2026-08-17'),
      shiftType: 'AFTERNOON',
      plannedStart: new Date('2026-08-17T14:30:00'),
      plannedEnd: new Date('2026-08-17T23:00:00'),
      isDayOff: false,
      notes: 'Afternoon rotation shift',
    },
  });

  await prisma.shift.create({
    data: {
      userId: user.id,
      employmentId: employment.id,
      date: new Date('2026-08-18'),
      shiftType: 'AFTERNOON',
      plannedStart: new Date('2026-08-18T14:30:00'),
      plannedEnd: new Date('2026-08-18T23:00:00'),
      isDayOff: false,
    },
  });

  // 7. Completed Sample Work Session (with 5-minute upward rounded finish)
  const session = await prisma.workSession.create({
    data: {
      userId: user.id,
      shiftId: mondayShift.id,
      actualStart: new Date('2026-08-17T14:30:00'),
      rawFinish: new Date('2026-08-17T23:23:00'), // Raw logout
      roundedFinish: new Date('2026-08-17T23:25:00'), // 5-min ceiling rounded
      elapsedMinutes: 535, // 8h 55m
      paidMinutes: 505, // 8h 25m (minus 30m unpaid break)
      status: 'COMPLETED',
      isManualEntry: false,
    },
  });

  await prisma.workBreak.createMany({
    data: [
      {
        workSessionId: session.id,
        type: 'PAID_15',
        durationMinutes: 15,
        isPaid: true,
        name: 'Morning paid coffee break',
      },
      {
        workSessionId: session.id,
        type: 'UNPAID_30',
        durationMinutes: 30,
        isPaid: false,
        name: 'Meal break (unpaid)',
      },
    ],
  });

  // 8. Sample Savings Goal
  await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: 'Emergency Fund',
      targetAmount: 5000.0,
      currentAmount: 1500.0,
      targetDate: new Date('2027-01-01'),
      color: '#10B981',
      icon: 'shield',
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
