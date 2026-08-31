import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken } from '../services/api.js';
import { secureStorage } from '../services/storage.js';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  employment?: any;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from SecureStore on startup
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await secureStorage.getToken();
        if (storedToken) {
          setAuthToken(storedToken);
          setTokenState(storedToken);

          // Validate token with backend /api/auth/me
          const response = await api.getMe();
          setUser(response.user);
        }
      } catch (err) {
        // Token expired or invalid
        await secureStorage.removeToken();
        setAuthToken(null);
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    await secureStorage.saveToken(data.token);
    setAuthToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const data = await api.register({ email, password, name });
    await secureStorage.saveToken(data.token);
    setAuthToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await secureStorage.removeToken();
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
