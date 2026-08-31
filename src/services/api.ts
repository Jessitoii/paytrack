const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API error: ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (payload: { email: string; password: string }) =>
    request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => request<{ user: any }>('/auth/me'),

  // Work Sessions
  startWork: (payload?: { shiftId?: string; notes?: string }) =>
    request<{ session: any }>('/work/start', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  finishWork: (id: string, payload?: { rawFinish?: Date; breaks?: any[]; notes?: string }) =>
    request<{ session: any; calculation: any }>(`/work/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

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
  getOverview: (year?: number, month?: number) => {
    const query = year && month ? `?year=${year}&month=${month}` : '';
    return request<{ overview: any }>(`/finance/overview${query}`);
  },

  getForecast: (horizonMonths = 6) =>
    request<{ forecast: any }>(`/finance/forecast?horizonMonths=${horizonMonths}`),

  listExpenses: () => request<{ expenses: any[] }>('/finance/expenses'),

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
