import { createContext } from 'react';
import type {
  User,
  AuthSession,
  LoginRequest,
  RegisterRequest,
} from '../lib/types/api';
import type { Role } from '../lib/types/enums';

export interface AuthContextType {
  user: User | null;
  role: Role | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  login: (credentials: LoginRequest) => Promise<AuthSession>;
  register: (data: RegisterRequest) => Promise<{ id: string; email: string; role: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
  setSession: (session: AuthSession | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
