import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import SetupAccountPage from '../pages/auth/SetupAccountPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import { AuthContext, type AuthContextType } from '../providers/AuthContext';
import { authApi } from '../lib/api/auth';
import { Role } from '../lib/types/enums';
import type { User, AuthSession } from '../lib/types/api';

// Helper to render component wrapped with custom AuthContext and MemoryRouter
function renderWithAuth(
  ui: React.ReactElement,
  {
    authOverrides = {},
    initialEntries = ['/'],
  }: {
    authOverrides?: Partial<AuthContextType>;
    initialEntries?: string[];
  } = {}
) {
  const defaultAuthValue: AuthContextType = {
    user: null,
    role: null,
    session: null,
    isAuthenticated: false,
    isLoading: false,
    mustChangePassword: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    setSession: vi.fn(),
    ...authOverrides,
  };

  return {
    ...render(
      <AuthContext.Provider value={defaultAuthValue}>
        <MemoryRouter initialEntries={initialEntries}>
          {ui}
        </MemoryRouter>
      </AuthContext.Provider>
    ),
    authValue: defaultAuthValue,
  };
}

describe('MEGS Phase 3: Auth & Onboarding Interfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── 1. LoginPage Tests ─────────────────────────
  describe('LoginPage', () => {
    it('renders login form elements and links correctly', () => {
      renderWithAuth(<LoginPage />);

      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^email address$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /forgot password\?/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /create an account/i })).toBeInTheDocument();
    });

    it('validates empty email and password submission', async () => {
      renderWithAuth(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: /^sign in$/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('validates invalid email format', async () => {
      renderWithAuth(<LoginPage />);

      const emailInput = screen.getByLabelText(/^email address$/i);
      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });

      const submitButton = screen.getByRole('button', { name: /^sign in$/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      });
    });

    it('validates password length under 8 characters', async () => {
      renderWithAuth(<LoginPage />);

      const emailInput = screen.getByLabelText(/^email address$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'short' } });

      const submitButton = screen.getByRole('button', { name: /^sign in$/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('successfully calls login on valid submission', async () => {
      const mockSession: AuthSession = {
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        user: {
          id: 'usr-123',
          email: 'applicant@example.com',
          role: Role.APPLICANT,
          accountStatus: 'ACTIVE',
          mustChangePassword: false,
        },
      };

      const loginSpy = vi.fn().mockResolvedValue(mockSession);

      renderWithAuth(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div data-testid="dashboard-target">Dashboard Home</div>} />
        </Routes>,
        {
          authOverrides: { login: loginSpy },
          initialEntries: ['/login'],
        }
      );

      fireEvent.change(screen.getByLabelText(/^email address$/i), {
        target: { value: 'applicant@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(loginSpy).toHaveBeenCalledWith({
          email: 'applicant@example.com',
          password: 'Password123!',
        });
      });
    });

    it('redirects to /change-password if mustChangePassword is true', async () => {
      const mockSessionMustChange: AuthSession = {
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        user: {
          id: 'usr-staff',
          email: 'staff@example.com',
          role: Role.TALENT_ACQUISITION,
          accountStatus: 'ACTIVE',
          mustChangePassword: true,
        },
      };

      const loginSpy = vi.fn().mockResolvedValue(mockSessionMustChange);

      renderWithAuth(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<div data-testid="change-password-target">Change Password Screen</div>} />
        </Routes>,
        {
          authOverrides: { login: loginSpy },
          initialEntries: ['/login'],
        }
      );

      fireEvent.change(screen.getByLabelText(/^email address$/i), {
        target: { value: 'staff@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'TempPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('change-password-target')).toBeInTheDocument();
      });
    });

    it('displays error banner when login fails', async () => {
      const loginSpy = vi.fn().mockRejectedValue(new Error('Invalid email or password'));

      renderWithAuth(<LoginPage />, {
        authOverrides: { login: loginSpy },
      });

      fireEvent.change(screen.getByLabelText(/^email address$/i), {
        target: { value: 'wrong@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'WrongPassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        const errorAlert = screen.getByTestId('login-error-alert');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent('Invalid email or password');
      });
    });

    it('toggles password visibility', () => {
      renderWithAuth(<LoginPage />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleButton = screen.getByLabelText(/password visibility/i);
      fireEvent.click(toggleButton);

      expect(passwordInput).toHaveAttribute('type', 'text');
    });
  });

  // ── 2. RegisterPage Tests ──────────────────────
  describe('RegisterPage', () => {
    it('renders all registration fields', () => {
      renderWithAuth(<RegisterPage />);

      expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^first name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^last name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email address$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('validates password mismatch on registration', async () => {
      renderWithAuth(<RegisterPage />);

      fireEvent.change(screen.getByLabelText(/^first name$/i), { target: { value: 'John' } });
      fireEvent.change(screen.getByLabelText(/^last name$/i), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByLabelText(/^email address$/i), { target: { value: 'john.doe@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Password123' } });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: 'DifferentPass123' } });

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('successfully calls authApi.register and redirects to /login', async () => {
      const registerSpy = vi.spyOn(authApi, 'register').mockResolvedValue({
        success: true,
        message: 'Account created successfully',
        data: { id: 'usr-new', email: 'applicant@test.com', role: 'APPLICANT' },
      });

      renderWithAuth(
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div data-testid="login-target">Sign In Target</div>} />
        </Routes>,
        { initialEntries: ['/register'] }
      );

      fireEvent.change(screen.getByLabelText(/^first name$/i), { target: { value: 'Maria' } });
      fireEvent.change(screen.getByLabelText(/^last name$/i), { target: { value: 'Santos' } });
      fireEvent.change(screen.getByLabelText(/^email address$/i), { target: { value: 'maria.santos@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Secret123!' } });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: 'Secret123!' } });

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(registerSpy).toHaveBeenCalledWith({
          email: 'maria.santos@example.com',
          password: 'Secret123!',
        });
        expect(screen.getByTestId('login-target')).toBeInTheDocument();
      });
    });

    it('renders error banner when registration API rejects', async () => {
      vi.spyOn(authApi, 'register').mockRejectedValue(new Error('An account with this email already exists'));

      renderWithAuth(<RegisterPage />);

      fireEvent.change(screen.getByLabelText(/^first name$/i), { target: { value: 'Maria' } });
      fireEvent.change(screen.getByLabelText(/^last name$/i), { target: { value: 'Santos' } });
      fireEvent.change(screen.getByLabelText(/^email address$/i), { target: { value: 'existing@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Secret123!' } });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: 'Secret123!' } });

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        const errorAlert = screen.getByTestId('register-error-alert');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent(/already exists/i);
      });
    });
  });

  // ── 3. ForgotPasswordPage Tests ────────────────
  describe('ForgotPasswordPage', () => {
    it('validates required email field', async () => {
      renderWithAuth(<ForgotPasswordPage />);

      fireEvent.click(screen.getByRole('button', { name: /send recovery link/i }));

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });
    });

    it('successfully calls authApi.forgotPassword and shows confirmation state', async () => {
      const forgotPasswordSpy = vi.spyOn(authApi, 'forgotPassword').mockResolvedValue({
        success: true,
        message: 'If an account exists, a link was sent',
        data: { message: 'If an account exists, a link was sent' },
      });

      renderWithAuth(<ForgotPasswordPage />);

      fireEvent.change(screen.getByLabelText(/registered email address/i), {
        target: { value: 'candidate@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /send recovery link/i }));

      await waitFor(() => {
        expect(forgotPasswordSpy).toHaveBeenCalledWith({
          email: 'candidate@example.com',
        });
        expect(screen.getByTestId('forgot-password-success-state')).toBeInTheDocument();
        expect(screen.getByText(/candidate@example.com/)).toBeInTheDocument();
      });
    });

    it('renders error banner on API failure', async () => {
      vi.spyOn(authApi, 'forgotPassword').mockRejectedValue(new Error('Network service unavailable'));

      renderWithAuth(<ForgotPasswordPage />);

      fireEvent.change(screen.getByLabelText(/registered email address/i), {
        target: { value: 'candidate@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /send recovery link/i }));

      await waitFor(() => {
        const alert = screen.getByTestId('forgot-password-error-alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent('Network service unavailable');
      });
    });
  });

  // ── 4. ResetPasswordPage Tests ─────────────────
  describe('ResetPasswordPage', () => {
    it('shows missing token warning if token is absent from URL', () => {
      renderWithAuth(<ResetPasswordPage />, {
        initialEntries: ['/reset-password'],
      });

      expect(screen.getByTestId('reset-password-missing-token')).toBeInTheDocument();
      expect(screen.getByText(/invalid or missing reset token/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /request new reset link/i })).toBeInTheDocument();
    });

    it('renders reset form when token query param exists', () => {
      renderWithAuth(<ResetPasswordPage />, {
        initialEntries: ['/reset-password?token=valid-test-token'],
      });

      expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^confirm new password$/i)).toBeInTheDocument();
    });

    it('validates password mismatch on reset form', async () => {
      renderWithAuth(<ResetPasswordPage />, {
        initialEntries: ['/reset-password?token=valid-test-token'],
      });

      fireEvent.change(screen.getByLabelText(/^new password$/i), {
        target: { value: 'NewPassword123' },
      });
      fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
        target: { value: 'MismatchPassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('successfully calls authApi.resetPassword with extracted token and redirects', async () => {
      const resetPasswordSpy = vi.spyOn(authApi, 'resetPassword').mockResolvedValue({
        success: true,
        message: 'Password reset successfully',
        data: null,
      });

      renderWithAuth(
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div data-testid="login-screen">Login Page</div>} />
        </Routes>,
        { initialEntries: ['/reset-password?token=secret-token-123'] }
      );

      fireEvent.change(screen.getByLabelText(/^new password$/i), {
        target: { value: 'BrandNewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
        target: { value: 'BrandNewPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(resetPasswordSpy).toHaveBeenCalledWith({
          token: 'secret-token-123',
          password: 'BrandNewPassword123!',
        });
        expect(screen.getByTestId('login-screen')).toBeInTheDocument();
      });
    });
  });

  // ── 5. SetupAccountPage Tests ──────────────────
  describe('SetupAccountPage', () => {
    it('shows missing token warning if token is absent from URL', () => {
      renderWithAuth(<SetupAccountPage />, {
        initialEntries: ['/setup-account'],
      });

      expect(screen.getByTestId('setup-account-missing-token')).toBeInTheDocument();
      expect(screen.getByText(/invalid or missing invitation link/i)).toBeInTheDocument();
    });

    it('renders activation form when token query param exists', () => {
      renderWithAuth(<SetupAccountPage />, {
        initialEntries: ['/setup-account?token=invitation-token-abc'],
      });

      expect(screen.getByRole('heading', { name: /setup your account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^create password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /activate account/i })).toBeInTheDocument();
    });

    it('validates password mismatch on account setup', async () => {
      renderWithAuth(<SetupAccountPage />, {
        initialEntries: ['/setup-account?token=invitation-token-abc'],
      });

      fireEvent.change(screen.getByLabelText(/^create password$/i), {
        target: { value: 'StaffSecret123' },
      });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
        target: { value: 'WrongStaffSecret123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /activate account/i }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('successfully calls authApi.setupAccount and redirects to /login', async () => {
      const setupAccountSpy = vi.spyOn(authApi, 'setupAccount').mockResolvedValue({
        success: true,
        message: 'Account setup completed',
        data: {
          id: 'usr-ta-1',
          email: 'recruiter@company.com',
          role: Role.TALENT_ACQUISITION,
          accountStatus: 'ACTIVE',
        },
      });

      renderWithAuth(
        <Routes>
          <Route path="/setup-account" element={<SetupAccountPage />} />
          <Route path="/login" element={<div data-testid="login-screen">Login Page</div>} />
        </Routes>,
        { initialEntries: ['/setup-account?token=invitation-token-abc'] }
      );

      fireEvent.change(screen.getByLabelText(/^create password$/i), {
        target: { value: 'StaffSecret123!' },
      });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
        target: { value: 'StaffSecret123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /activate account/i }));

      await waitFor(() => {
        expect(setupAccountSpy).toHaveBeenCalledWith({
          token: 'invitation-token-abc',
          password: 'StaffSecret123!',
        });
        expect(screen.getByTestId('login-screen')).toBeInTheDocument();
      });
    });
  });

  // ── 6. ChangePasswordPage Tests ────────────────
  describe('ChangePasswordPage', () => {
    const mockUser: User = {
      id: 'usr-1',
      email: 'user@example.com',
      role: Role.APPLICANT,
      accountStatus: 'ACTIVE',
      mustChangePassword: true,
    };

    it('shows mandatory notice if mustChangePassword is true', () => {
      renderWithAuth(<ChangePasswordPage />, {
        authOverrides: {
          user: mockUser,
          mustChangePassword: true,
        },
      });

      expect(screen.getByTestId('must-change-password-notice')).toBeInTheDocument();
      expect(screen.getByText(/security policy/i)).toBeInTheDocument();
    });

    it('validates password mismatch and identical old/new passwords', async () => {
      renderWithAuth(<ChangePasswordPage />, {
        authOverrides: {
          user: mockUser,
          mustChangePassword: true,
        },
      });

      // Test matching current and new password
      fireEvent.change(screen.getByLabelText(/^current password$/i), {
        target: { value: 'SameOldPassword123' },
      });
      fireEvent.change(screen.getByLabelText(/^new password$/i), {
        target: { value: 'SameOldPassword123' },
      });
      fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
        target: { value: 'SameOldPassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(screen.getByText(/new password must be different/i)).toBeInTheDocument();
      });
    });

    it('successfully calls authApi.changePassword and updates state', async () => {
      const changePasswordSpy = vi.spyOn(authApi, 'changePassword').mockResolvedValue({
        success: true,
        message: 'Password changed successfully',
        data: null,
      });

      const setSessionSpy = vi.fn();

      renderWithAuth(
        <Routes>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/" element={<div data-testid="home-target">Role Dashboard Home</div>} />
        </Routes>,
        {
          authOverrides: {
            user: mockUser,
            mustChangePassword: true,
            setSession: setSessionSpy,
          },
          initialEntries: ['/change-password'],
        }
      );

      fireEvent.change(screen.getByLabelText(/^current password$/i), {
        target: { value: 'OldTempPassword123' },
      });
      fireEvent.change(screen.getByLabelText(/^new password$/i), {
        target: { value: 'NewSecurePassword123!' },
      });
      fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
        target: { value: 'NewSecurePassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(changePasswordSpy).toHaveBeenCalledWith({
          currentPassword: 'OldTempPassword123',
          newPassword: 'NewSecurePassword123!',
        });
        expect(setSessionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            user: expect.objectContaining({
              mustChangePassword: false,
            }),
          })
        );
        expect(screen.getByTestId('home-target')).toBeInTheDocument();
      });
    });
  });
});
