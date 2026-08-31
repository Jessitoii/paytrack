import { secureStorage } from './storage';
import Constants from 'expo-constants';

function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Derive PC host IP automatically from Metro bundler host in development
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000/api`;
  }

  return 'http://127.0.0.1:3000/api';
}

const BASE_URL = getBaseUrl();

let activeAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  activeAuthToken = token;
}

export function getAuthToken(): string | null {
  return activeAuthToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = activeAuthToken || (await secureStorage.getToken());
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      await secureStorage.removeToken();
      activeAuthToken = null;
    }
    throw new Error(data.message || `API error: ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (payload: { email: string; password: string; name: string }) =>
    request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => request<{ user: any }>('/auth/me'),

  // Work Sessions
  startWork: (payload?: { shiftId?: string; actualStart?: Date; notes?: string }) =>
    request<{ session: any }>('/work/start', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  finishWork: (id: string, payload?: { rawFinish?: Date; breaks?: any[]; notes?: string }) =>
    request<{ session: any; calculation: any }>(`/work/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  createManualWork: (payload: {
    shiftId?: string;
    actualStart: Date;
    rawFinish: Date;
    breaks?: any[];
    notes?: string;
  }) =>
    request<{ session: any; calculation: any }>('/work/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  checkAutoStart: () =>
    request<{ autoStartedCount: number; autoStarted: any[] }>('/work/auto-start-check'),

  updateWork: (id: string, payload: any) =>
    request<{ session: any; calculation: any }>(`/work/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listWorkSessions: (params?: { startDate?: string; endDate?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request<{ sessions: any[] }>(`/work${query}`);
  },

  getWorkSession: (id: string) => request<{ session: any; calculation: any }>(`/work/${id}`),

  // Shifts
  listShifts: (params?: { startDate?: string; endDate?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request<{ shifts: any[] }>(`/shifts${query}`);
  },

  createShift: (payload: any) =>
    request<{ shift: any }>('/shifts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  bulkSaveWeek: (payload: { weekStartDate: Date; shifts: any[] }) =>
    request<{ shifts: any[] }>('/shifts/bulk-week', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  copyPreviousWeek: (payload: { targetWeekStartDate: Date }) =>
    request<{ shifts: any[] }>('/shifts/copy-previous-week', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateShift: (id: string, payload: any) =>
    request<{ shift: any }>(`/shifts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteShift: (id: string) => request<{ success: boolean }>(`/shifts/${id}`, { method: 'DELETE' }),

  // Payslips
  uploadPayslip: (payload: { fileBase64: string; fileName: string; provider?: string }) =>
    request<any>('/payslips/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirmPayslip: (id: string, payload: any) =>
    request<{ payslip: any }>(`/payslips/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reconcilePayslip: (id: string) => request<any>(`/payslips/${id}/reconcile`),

  listPayslips: () => request<{ payslips: any[] }>('/payslips'),

  // Finance
  getCategories: () => request<{ categories: any[] }>('/finance/categories'),

  getOverview: (year?: number, month?: number) => {
    const query = year && month ? `?year=${year}&month=${month}` : '';
    return request<{ overview: any }>(`/finance/overview${query}`);
  },

  getForecast: (horizonMonths = 6) =>
    request<{ forecast: any }>(`/finance/forecast?horizonMonths=${horizonMonths}`),

  listExpenses: (params?: { categoryId?: string; startDate?: string; endDate?: string }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request<{ expenses: any[] }>(`/finance/expenses${query}`);
  },

  createExpense: (payload: any) =>
    request<{ expense: any }>('/finance/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listSavingsGoals: () => request<{ goals: any[] }>('/finance/savings-goals'),

  createSavingsGoal: (payload: any) =>
    request<{ goal: any }>('/finance/savings-goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
