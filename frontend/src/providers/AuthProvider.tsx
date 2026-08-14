import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { authApi } from '../lib/api/auth';
import type {
  User,
  AuthSession,
  LoginRequest,
  RegisterRequest,
} from '../lib/types/api';
import { AuthContext } from './AuthContext';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setSession = useCallback((newSession: AuthSession | null) => {
    setSessionState(newSession);
    if (newSession?.user) {
      setUser(newSession.user);
      localStorage.setItem('megs_access_token', newSession.access_token);
      localStorage.setItem('megs_user', JSON.stringify(newSession.user));
    } else {
      setUser(null);
      localStorage.removeItem('megs_access_token');
      localStorage.removeItem('megs_user');
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<User | null> => {
    try {
      const response = await authApi.getCurrentUser();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('megs_user', JSON.stringify(response.data.user));
        return response.data.user;
      }
    } catch {
      // If fetching user fails with invalid token, clear auth
      setSession(null);
    }
    return null;
  }, [setSession]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('megs_access_token');
        const storedUser = localStorage.getItem('megs_user');

        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            // Ignore invalid JSON in localStorage
          }
        }

        if (storedToken) {
          // Verify with backend
          await refreshProfile();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen to unauthorized global events from API client
    const handleUnauthorized = () => {
      setSession(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    // Subscribe to Supabase auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, sbSession) => {
        if (event === 'SIGNED_OUT' || !sbSession) {
          setSession(null);
        } else if (event === 'TOKEN_REFRESHED' && sbSession) {
          localStorage.setItem('megs_access_token', sbSession.access_token);
        }
      }
    );

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      authListener?.subscription?.unsubscribe();
    };
  }, [refreshProfile, setSession]);

  const login = async (credentials: LoginRequest): Promise<AuthSession> => {
    const response = await authApi.login(credentials);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Login failed');
    }

    const sessionData = response.data;
    setSession(sessionData);
    return sessionData;
  };

  const register = async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    if (!response.success) {
      throw new Error(response.message || 'Registration failed');
    }
    return response.data;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Proceed with local logout regardless of network error
    } finally {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore supabase signout error
      }
      setSession(null);
    }
  };

  const role = user?.role ?? null;
  const isAuthenticated = !!user;
  const mustChangePassword = !!user?.mustChangePassword;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        session,
        isAuthenticated,
        isLoading,
        mustChangePassword,
        login,
        register,
        logout,
        refreshProfile,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
