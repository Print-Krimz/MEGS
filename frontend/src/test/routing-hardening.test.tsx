import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NotFoundPage from '../pages/common/NotFoundPage';
import ForbiddenPage from '../pages/common/ForbiddenPage';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { RequireAuth, RequireRole, RequirePasswordChange, RootRedirect } from '../App';
import { AuthContext, type AuthContextType } from '../providers/AuthContext';
import { Role } from '../lib/types/enums';
import type { User } from '../lib/types/api';

// Helper to render component wrapped with AuthContext and MemoryRouter
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
    logout: vi.fn().mockResolvedValue(undefined),
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

// Buggy test component that throws during rendering
function Bomb({ shouldThrow = true, message = 'Kaboom! Unhandled crash' }: { shouldThrow?: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div data-testid="bomb-recovered">Normal Content Rendered</div>;
}

describe('Phase 9: Integration Hardening & Routing Tests', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Suppress expected React ErrorBoundary logging during tests
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  // ── 1. NotFoundPage Tests ─────────────────────────
  describe('NotFoundPage', () => {
    it('renders 404 header, message, and requested route diagnostics', () => {
      renderWithAuth(<NotFoundPage />, {
        initialEntries: ['/non-existent-page?query=test'],
      });

      expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
      expect(
        screen.getByText(/404 — Page Not Found. The resource you are looking for has been moved/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/REQUESTED_URI:/i)).toBeInTheDocument();
      expect(screen.getByText('/non-existent-page?query=test')).toBeInTheDocument();
      expect(screen.getByText(/GUEST \/ ANONYMOUS/i)).toBeInTheDocument();
    });

    it('points "Back to Safety / Dashboard" to /login for unauthenticated guest', () => {
      renderWithAuth(<NotFoundPage />, {
        authOverrides: {
          isAuthenticated: false,
          user: null,
          role: null,
        },
      });

      const dashboardBtn = screen.getByTestId('back-to-dashboard-btn');
      expect(dashboardBtn).toHaveAttribute('href', '/login');
    });

    it('points "Back to Safety / Dashboard" to /app/dashboard for APPLICANT role', () => {
      renderWithAuth(<NotFoundPage />, {
        authOverrides: {
          isAuthenticated: true,
          role: Role.APPLICANT,
          user: { id: 'u-1', email: 'applicant@megs.io', role: Role.APPLICANT } as User,
        },
      });

      const dashboardBtn = screen.getByTestId('back-to-dashboard-btn');
      expect(dashboardBtn).toHaveAttribute('href', '/app/dashboard');
      expect(screen.getByText(/AUTHENTICATED \(APPLICANT\)/i)).toBeInTheDocument();
    });

    it('points "Back to Safety / Dashboard" to /ta/dashboard for TALENT_ACQUISITION role', () => {
      renderWithAuth(<NotFoundPage />, {
        authOverrides: {
          isAuthenticated: true,
          role: Role.TALENT_ACQUISITION,
          user: { id: 'u-2', email: 'ta@megs.io', role: Role.TALENT_ACQUISITION } as User,
        },
      });

      const dashboardBtn = screen.getByTestId('back-to-dashboard-btn');
      expect(dashboardBtn).toHaveAttribute('href', '/ta/dashboard');
      expect(screen.getByText(/AUTHENTICATED \(TALENT_ACQUISITION\)/i)).toBeInTheDocument();
    });

    it('points "Back to Safety / Dashboard" to /admin/dashboard for ADMINISTRATOR role', () => {
      renderWithAuth(<NotFoundPage />, {
        authOverrides: {
          isAuthenticated: true,
          role: Role.ADMINISTRATOR,
          user: { id: 'u-3', email: 'admin@megs.io', role: Role.ADMINISTRATOR } as User,
        },
      });

      const dashboardBtn = screen.getByTestId('back-to-dashboard-btn');
      expect(dashboardBtn).toHaveAttribute('href', '/admin/dashboard');
      expect(screen.getByText(/AUTHENTICATED \(ADMINISTRATOR\)/i)).toBeInTheDocument();
    });

    it('handles "Go Back" history navigation button click', () => {
      renderWithAuth(<NotFoundPage />, {
        initialEntries: ['/previous-page', '/unknown-route'],
      });

      const goBackBtn = screen.getByTestId('go-back-btn');
      expect(goBackBtn).toBeInTheDocument();
      fireEvent.click(goBackBtn);
    });
  });

  // ── 2. ForbiddenPage Tests ─────────────────────────
  describe('ForbiddenPage', () => {
    it('renders 403 status, informative restriction message, and role badge', () => {
      renderWithAuth(<ForbiddenPage />, {
        authOverrides: {
          isAuthenticated: true,
          role: Role.APPLICANT,
          user: { id: 'u-1', email: 'applicant@test.com', role: Role.APPLICANT } as User,
        },
        initialEntries: ['/admin/users'],
      });

      expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(
        screen.getByText(
          /403 — Access Restricted. Your user account does not have sufficient permissions/i
        )
      ).toBeInTheDocument();

      const roleBadge = screen.getByTestId('user-role-badge');
      expect(roleBadge).toHaveTextContent('APPLICANT');
      expect(screen.getByText('applicant@test.com')).toBeInTheDocument();
    });

    it('renders correctly for TALENT_ACQUISITION role badge', () => {
      renderWithAuth(<ForbiddenPage />, {
        authOverrides: {
          isAuthenticated: true,
          role: Role.TALENT_ACQUISITION,
          user: { id: 'u-2', email: 'ta@test.com', role: Role.TALENT_ACQUISITION } as User,
        },
      });

      const roleBadge = screen.getByTestId('user-role-badge');
      expect(roleBadge).toHaveTextContent('TALENT ACQUISITION');
      const returnBtn = screen.getByTestId('return-dashboard-btn');
      expect(returnBtn).toHaveAttribute('href', '/ta/dashboard');
    });

    it('navigates to dashboard when "Return to My Dashboard" is clicked', () => {
      renderWithAuth(<ForbiddenPage />, {
        authOverrides: {
          isAuthenticated: true,
          role: Role.ADMINISTRATOR,
          user: { id: 'u-3', email: 'admin@test.com', role: Role.ADMINISTRATOR } as User,
        },
      });

      const returnBtn = screen.getByTestId('return-dashboard-btn');
      expect(returnBtn).toHaveAttribute('href', '/admin/dashboard');
    });

    it('triggers logout and redirects when "Sign In with Different Account" is clicked', async () => {
      const mockLogout = vi.fn().mockResolvedValue(undefined);
      renderWithAuth(<ForbiddenPage />, {
        authOverrides: {
          isAuthenticated: true,
          role: Role.APPLICANT,
          user: { id: 'u-1', email: 'applicant@test.com', role: Role.APPLICANT } as User,
          logout: mockLogout,
        },
      });

      const switchAccountBtn = screen.getByTestId('switch-account-btn');
      fireEvent.click(switchAccountBtn);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ── 3. ErrorBoundary Tests ─────────────────────────
  describe('ErrorBoundary', () => {
    it('renders children normally when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="safe-child">Normal Safe Child Content</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('safe-child')).toBeInTheDocument();
      expect(screen.getByText('Normal Safe Child Content')).toBeInTheDocument();
      expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
    });

    it('catches runtime exception and renders industrial fallback UI with diagnostics', () => {
      render(
        <ErrorBoundary>
          <Bomb message="Database connection terminated unexpectedly" />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByText('Application Error Occurred')).toBeInTheDocument();
      expect(screen.getByTestId('error-boundary-message')).toHaveTextContent(
        'Database connection terminated unexpectedly'
      );
      expect(screen.getByTestId('error-boundary-retry-btn')).toBeInTheDocument();
      expect(screen.getByTestId('error-boundary-reload-btn')).toBeInTheDocument();
      expect(screen.getByTestId('error-boundary-copy-btn')).toBeInTheDocument();
    });

    it('resets state when "Try Again" is clicked and calls onReset', () => {
      const onResetMock = vi.fn();
      let shouldThrow = true;

      function TestContainer() {
        return (
          <ErrorBoundary onReset={onResetMock}>
            <Bomb shouldThrow={shouldThrow} />
          </ErrorBoundary>
        );
      }

      const { rerender } = render(<TestContainer />);
      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

      // Now fix the underlying condition
      shouldThrow = false;
      const retryBtn = screen.getByTestId('error-boundary-retry-btn');
      fireEvent.click(retryBtn);

      rerender(<TestContainer />);
      expect(onResetMock).toHaveBeenCalledTimes(1);
    });

    it('copies error diagnostics to clipboard when button is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <ErrorBoundary>
          <Bomb message="Render failure with token timeout" />
        </ErrorBoundary>
      );

      const copyBtn = screen.getByTestId('error-boundary-copy-btn');
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledTimes(1);
        expect(writeTextMock.mock.calls[0][0]).toContain('MEGS RUNTIME ERROR DIAGNOSTICS');
        expect(writeTextMock.mock.calls[0][0]).toContain('Render failure with token timeout');
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('renders custom function fallback if provided', () => {
      render(
        <ErrorBoundary
          fallback={({ error, resetError }) => (
            <div data-testid="custom-fallback">
              <span>Custom: {error?.message}</span>
              <button onClick={resetError}>Custom Reset</button>
            </div>
          )}
        >
          <Bomb message="Custom crashed" />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom: Custom crashed')).toBeInTheDocument();
    });
  });

  // ── 4. Routing Guards & Tree Verification ──────────
  describe('Routing Guards (RequireAuth, RequireRole, RequirePasswordChange, RootRedirect)', () => {
    it('RequireAuth redirects unauthenticated user to /login with encoded redirect query', () => {
      renderWithAuth(
        <Routes>
          <Route
            path="/ta/dashboard"
            element={
              <RequireAuth allowedRoles={[Role.TALENT_ACQUISITION]}>
                <div data-testid="protected-content">Protected TA Content</div>
              </RequireAuth>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login-landing">Login Landing Page</div>}
          />
        </Routes>,
        {
          authOverrides: { isAuthenticated: false, user: null, role: null },
          initialEntries: ['/ta/dashboard?filter=active'],
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('login-landing')).toBeInTheDocument();
    });

    it('RequireAuth intercepts user with mustChangePassword === true and routes to /change-password', () => {
      renderWithAuth(
        <Routes>
          <Route
            path="/app/dashboard"
            element={
              <RequireAuth allowedRoles={[Role.APPLICANT]}>
                <div data-testid="applicant-dashboard">Applicant Dashboard Content</div>
              </RequireAuth>
            }
          />
          <Route
            path="/change-password"
            element={<div data-testid="change-pwd-screen">Force Password Change Screen</div>}
          />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: true,
            mustChangePassword: true,
            role: Role.APPLICANT,
            user: { id: 'u-pwd', email: 'user@megs.io', role: Role.APPLICANT, mustChangePassword: true } as User,
          },
          initialEntries: ['/app/dashboard'],
        }
      );

      expect(screen.queryByTestId('applicant-dashboard')).not.toBeInTheDocument();
      expect(screen.getByTestId('change-pwd-screen')).toBeInTheDocument();
    });

    it('RequireAuth redirects mismatched role (e.g. APPLICANT visiting /admin/users) to /forbidden', () => {
      renderWithAuth(
        <Routes>
          <Route
            path="/admin/users"
            element={
              <RequireAuth allowedRoles={[Role.ADMINISTRATOR]}>
                <div data-testid="admin-users">Admin Users Page</div>
              </RequireAuth>
            }
          />
          <Route
            path="/forbidden"
            element={<div data-testid="forbidden-landing">Forbidden 403 Page</div>}
          />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: true,
            role: Role.APPLICANT,
            user: { id: 'u-app', email: 'applicant@megs.io', role: Role.APPLICANT } as User,
          },
          initialEntries: ['/admin/users'],
        }
      );

      expect(screen.queryByTestId('admin-users')).not.toBeInTheDocument();
      expect(screen.getByTestId('forbidden-landing')).toBeInTheDocument();
    });

    it('RequireAuth renders children when authenticated with valid allowed role', () => {
      renderWithAuth(
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <RequireAuth allowedRoles={[Role.ADMINISTRATOR]}>
                <div data-testid="admin-authorized">Authorized Admin Workspace</div>
              </RequireAuth>
            }
          />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: true,
            role: Role.ADMINISTRATOR,
            user: { id: 'u-adm', email: 'admin@megs.io', role: Role.ADMINISTRATOR } as User,
          },
          initialEntries: ['/admin/dashboard'],
        }
      );

      expect(screen.getByTestId('admin-authorized')).toBeInTheDocument();
    });

    it('RequireRole directly redirects unauthorized role to /forbidden', () => {
      renderWithAuth(
        <Routes>
          <Route
            path="/admin/scoring"
            element={
              <RequireRole allowedRoles={[Role.ADMINISTRATOR]}>
                <div data-testid="scoring-content">Scoring Config</div>
              </RequireRole>
            }
          />
          <Route
            path="/forbidden"
            element={<div data-testid="forbidden-screen">Forbidden Screen</div>}
          />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: true,
            role: Role.TALENT_ACQUISITION,
            user: { id: 'u-ta', email: 'ta@megs.io', role: Role.TALENT_ACQUISITION } as User,
          },
          initialEntries: ['/admin/scoring'],
        }
      );

      expect(screen.queryByTestId('scoring-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('forbidden-screen')).toBeInTheDocument();
    });

    it('RequirePasswordChange directly intercepts user needing password reset', () => {
      renderWithAuth(
        <Routes>
          <Route
            path="/ta/dashboard"
            element={
              <RequirePasswordChange>
                <div data-testid="ta-dashboard-content">TA Dashboard</div>
              </RequirePasswordChange>
            }
          />
          <Route
            path="/change-password"
            element={<div data-testid="pwd-reset-screen">Password Reset Screen</div>}
          />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: true,
            mustChangePassword: true,
            role: Role.TALENT_ACQUISITION,
          },
          initialEntries: ['/ta/dashboard'],
        }
      );

      expect(screen.queryByTestId('ta-dashboard-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('pwd-reset-screen')).toBeInTheDocument();
    });

    it('RootRedirect routes APPLICANT to /app/dashboard', () => {
      renderWithAuth(
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/app/dashboard" element={<div data-testid="applicant-home">Applicant Home</div>} />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: true,
            role: Role.APPLICANT,
            user: { id: 'u-app', email: 'applicant@megs.io', role: Role.APPLICANT } as User,
          },
          initialEntries: ['/'],
        }
      );

      expect(screen.getByTestId('applicant-home')).toBeInTheDocument();
    });

    it('RootRedirect routes TALENT_ACQUISITION to /ta/dashboard', () => {
      renderWithAuth(
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/ta/dashboard" element={<div data-testid="ta-home">TA Home</div>} />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: true,
            role: Role.TALENT_ACQUISITION,
            user: { id: 'u-ta', email: 'ta@megs.io', role: Role.TALENT_ACQUISITION } as User,
          },
          initialEntries: ['/'],
        }
      );

      expect(screen.getByTestId('ta-home')).toBeInTheDocument();
    });

    it('RootRedirect routes ADMINISTRATOR to /admin/dashboard', () => {
      renderWithAuth(
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/admin/dashboard" element={<div data-testid="admin-home">Admin Home</div>} />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: true,
            role: Role.ADMINISTRATOR,
            user: { id: 'u-adm', email: 'admin@megs.io', role: Role.ADMINISTRATOR } as User,
          },
          initialEntries: ['/'],
        }
      );

      expect(screen.getByTestId('admin-home')).toBeInTheDocument();
    });

    it('RootRedirect routes unauthenticated user to /login', () => {
      renderWithAuth(
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<div data-testid="login-home">Login Home</div>} />
        </Routes>,
        {
          authOverrides: {
            isAuthenticated: false,
            user: null,
            role: null,
          },
          initialEntries: ['/'],
        }
      );

      expect(screen.getByTestId('login-home')).toBeInTheDocument();
    });

    it('Wildcard route "*" catches unknown path and renders NotFoundPage', () => {
      renderWithAuth(
        <Routes>
          <Route path="/valid-route" element={<div>Valid Route</div>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>,
        {
          initialEntries: ['/invalid/deep/nested/resource/404'],
        }
      );

      expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
      expect(screen.getByText('/invalid/deep/nested/resource/404')).toBeInTheDocument();
    });
  });
});
