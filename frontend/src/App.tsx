import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from './hooks/useAuth';
import { Role } from './lib/types/enums';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingState } from './components/common/LoadingState';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { ApplicantLayout } from './layouts/ApplicantLayout';
import { TALayout } from './layouts/TALayout';
import { AdminLayout } from './layouts/AdminLayout';

// ── Lazy Loaded Pages ─────────────────────────

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const SetupAccountPage = lazy(() => import('./pages/auth/SetupAccountPage'));
const ChangePasswordPage = lazy(() => import('./pages/auth/ChangePasswordPage'));

// Applicant
const ApplicantDashboardPage = lazy(() => import('./pages/applicant/ApplicantDashboardPage'));
const ApplicantProfilePage = lazy(() => import('./pages/applicant/ApplicantProfilePage'));
const ApplicantJobsPage = lazy(() => import('./pages/applicant/ApplicantJobsPage'));
const ApplicantJobDetailPage = lazy(() => import('./pages/applicant/ApplicantJobDetailPage'));
const ApplicantApplicationsPage = lazy(() => import('./pages/applicant/ApplicantApplicationsPage'));
const ApplicantApplicationDetailPage = lazy(() => import('./pages/applicant/ApplicantApplicationDetailPage'));

// Talent Acquisition
const TADashboardPage = lazy(() => import('./pages/ta/TADashboardPage'));
const TAApplicationsPage = lazy(() => import('./pages/ta/TAApplicationsPage'));
const TAApplicationDetailPage = lazy(() => import('./pages/ta/TAApplicationDetailPage'));
const TAJobsPage = lazy(() => import('./pages/ta/TAJobsPage'));
const TAJobDetailPage = lazy(() => import('./pages/ta/TAJobDetailPage'));
const TAClientsPage = lazy(() => import('./pages/ta/TAClientsPage'));
const TAClientDetailPage = lazy(() => import('./pages/ta/TAClientDetailPage'));
const TAMRFsPage = lazy(() => import('./pages/ta/TAMRFsPage'));
const TAMRFDetailPage = lazy(() => import('./pages/ta/TAMRFDetailPage'));
const TATalentPoolPage = lazy(() => import('./pages/ta/TATalentPoolPage'));
const TAInterviewsPage = lazy(() => import('./pages/ta/TAInterviewsPage'));
const TACompliancePage = lazy(() => import('./pages/ta/TACompliancePage'));
const TADeploymentsPage = lazy(() => import('./pages/ta/TADeploymentsPage'));
const TAEmployeesPage = lazy(() => import('./pages/ta/TAEmployeesPage'));
const TAEmployeeDetailPage = lazy(() => import('./pages/ta/TAEmployeeDetailPage'));
const TAAnalyticsPage = lazy(() => import('./pages/ta/TAAnalyticsPage'));

// Administrator
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminScoringPage = lazy(() => import('./pages/admin/AdminScoringPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage'));

// Shared / Error
const NotFoundPage = lazy(() => import('./pages/common/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./pages/common/ForbiddenPage'));

// ── Route Guards ──────────────────────────────

export interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export function RequireAuth({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role, mustChangePassword } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (!isAuthenticated) {
    const searchTarget = location.search
      ? `${location.pathname}${location.search}`
      : location.pathname;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(searchTarget)}`}
        state={{ from: location }}
        replace
      />
    );
  }

  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}

export function RequireRole({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles: Role[];
}) {
  const { role, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingState variant="page" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }
  return <>{children}</>;
}

export function RequirePasswordChange({ children }: { children: ReactNode }) {
  const { mustChangePassword, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingState variant="page" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

export function RootRedirect() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (role) {
    case Role.APPLICANT:
      return <Navigate to="/app/dashboard" replace />;
    case Role.TALENT_ACQUISITION:
      return <Navigate to="/ta/dashboard" replace />;
    case Role.ADMINISTRATOR:
      return <Navigate to="/admin/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

// ── App Component & Routing Tree ─────────────

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <Suspense fallback={<LoadingState variant="page" />}>
          <Routes>
            {/* Dynamic Root Redirection based on user role */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/setup-account" element={<SetupAccountPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>

            {/* Applicant Protected Routes */}
            <Route
              path="/app"
              element={
                <RequireAuth allowedRoles={[Role.APPLICANT]}>
                  <ApplicantLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<ApplicantDashboardPage />} />
              <Route path="profile" element={<ApplicantProfilePage />} />
              <Route path="jobs" element={<ApplicantJobsPage />} />
              <Route path="jobs/:id" element={<ApplicantJobDetailPage />} />
              <Route path="applications" element={<ApplicantApplicationsPage />} />
              <Route path="applications/:id" element={<ApplicantApplicationDetailPage />} />
            </Route>

            {/* Talent Acquisition Protected Routes (also accessible by Admin) */}
            <Route
              path="/ta"
              element={
                <RequireAuth allowedRoles={[Role.TALENT_ACQUISITION, Role.ADMINISTRATOR]}>
                  <TALayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/ta/dashboard" replace />} />
              <Route path="dashboard" element={<TADashboardPage />} />
              <Route path="applications" element={<TAApplicationsPage />} />
              <Route path="applications/:id" element={<TAApplicationDetailPage />} />
              <Route path="jobs" element={<TAJobsPage />} />
              <Route path="jobs/:id" element={<TAJobDetailPage />} />
              <Route path="clients" element={<TAClientsPage />} />
              <Route path="clients/:id" element={<TAClientDetailPage />} />
              <Route path="mrfs" element={<TAMRFsPage />} />
              <Route path="mrfs/:id" element={<TAMRFDetailPage />} />
              <Route path="talent-pool" element={<TATalentPoolPage />} />
              <Route path="interviews" element={<TAInterviewsPage />} />
              <Route path="compliance" element={<TACompliancePage />} />
              <Route path="deployments" element={<TADeploymentsPage />} />
              <Route path="employees" element={<TAEmployeesPage />} />
              <Route path="employees/:id" element={<TAEmployeeDetailPage />} />
              <Route path="analytics" element={<TAAnalyticsPage />} />
            </Route>

            {/* Administrator Protected Routes */}
            <Route
              path="/admin"
              element={
                <RequireAuth allowedRoles={[Role.ADMINISTRATOR]}>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="scoring" element={<AdminScoringPage />} />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              {/* Admin shared navigation aliases */}
              <Route path="clients" element={<TAClientsPage />} />
              <Route path="mrfs" element={<TAMRFsPage />} />
              <Route path="analytics" element={<TAAnalyticsPage />} />
            </Route>

            {/* Generic Error / Status Routes */}
            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
