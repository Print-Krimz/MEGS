import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { AuthContextType } from "./context/AuthContext";
import { Role } from "./lib/types/enums";
import { AuthLayout } from "./layouts/AuthLayout";
import { ApplicantLayout } from "./layouts/ApplicantLayout";
import { TALayout } from "./layouts/TALayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { NotFoundPage } from "./pages/common/NotFoundPage";
import { ForbiddenPage } from "./pages/common/ForbiddenPage";
import { ChangePasswordPage } from "./pages/common/ChangePasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { SetupAccountPage } from "./pages/auth/SetupAccountPage";
import { ComponentGalleryPage } from "./pages/dev/ComponentGalleryPage";

// Applicant Pages
import { ApplicantDashboard } from "./pages/applicant/ApplicantDashboard";
import { ProfilePage } from "./pages/applicant/ProfilePage";
import { JobsPage } from "./pages/applicant/JobsPage";
import { JobDetailPage } from "./pages/applicant/JobDetailPage";
import { MyApplicationsPage } from "./pages/applicant/MyApplicationsPage";
import { ApplicationDetailPage as ApplicantApplicationDetailPage } from "./pages/applicant/ApplicationDetailPage";
import { NotificationsPage } from "./pages/applicant/NotificationsPage";

// Talent Acquisition (TA) Pages
import { TADashboard } from "./pages/ta/TADashboard";
import { ApplicationsPage as TAApplicationsPage } from "./pages/ta/ApplicationsPage";
import { ApplicationDetailPage as TAApplicationDetailPage } from "./pages/ta/ApplicationDetailPage";
import { JobPostingsPage } from "./pages/ta/JobPostingsPage";
import { JobPostingDetailPage } from "./pages/ta/JobPostingDetailPage";
import { MRFListPage } from "./pages/ta/MRFListPage";
import { MRFCreatePage } from "./pages/ta/MRFCreatePage";
import { MRFDetailPage } from "./pages/ta/MRFDetailPage";
import { TalentPoolPage } from "./pages/ta/TalentPoolPage";
import { InterviewsPage } from "./pages/ta/InterviewsPage";
import { ClientsPage } from "./pages/ta/ClientsPage";
import { ClientDetailPage } from "./pages/ta/ClientDetailPage";
import { CompliancePage } from "./pages/ta/CompliancePage";
import { DeploymentsPage } from "./pages/ta/DeploymentsPage";
import { DeploymentDetailPage } from "./pages/ta/DeploymentDetailPage";
import { EmployeesPage } from "./pages/ta/EmployeesPage";
import { EmployeeDetailPage } from "./pages/ta/EmployeeDetailPage";
import { AnalyticsPage } from "./pages/ta/AnalyticsPage";

// Admin Pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { UsersPage } from "./pages/admin/UsersPage";
import { ScoringConfigPage } from "./pages/admin/ScoringConfigPage";
import { ScoringQualityPage } from "./pages/admin/ScoringQualityPage";
import { RevalidationQueuePage } from "./pages/admin/RevalidationQueuePage";
import { AuditLogsPage } from "./pages/admin/AuditLogsPage";

export interface RouterContext {
  auth: AuthContextType;
  queryClient: QueryClient;
}

// -------------------------------------------------------------
// 1. Root Route
// -------------------------------------------------------------
export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});

import { LandingPage } from "./pages/public/LandingPage";

// -------------------------------------------------------------
// 2. Public Root Route ('/') - Corporate Landing Page
// -------------------------------------------------------------
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

// -------------------------------------------------------------
// 3. Auth Layout & Public Child Routes
// -------------------------------------------------------------
export const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth-layout",
  component: AuthLayout,
});

export interface LoginSearch {
  redirect?: string;
  email?: string;
}

export const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: LoginPage,
});

export const registerRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/register",
  component: RegisterPage,
});

export interface ForgotPasswordSearch {
  email?: string;
}

export const forgotPasswordRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/forgot-password",
  validateSearch: (search: Record<string, unknown>): ForgotPasswordSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: ForgotPasswordPage,
});

export const resetPasswordRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
});

export const setupAccountRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/setup-account/$token",
  component: SetupAccountPage,
});

export const changePasswordRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/change-password",
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: ChangePasswordPage,
});

export const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forbidden",
  component: ForbiddenPage,
});

export const devGalleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dev",
  component: ComponentGalleryPage,
});

// -------------------------------------------------------------
// 4. Applicant Protected Layout & Child Routes
// -------------------------------------------------------------
export const applicantLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "applicant-layout",
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    if (context.auth.mustChangePassword) {
      throw redirect({ to: "/change-password" });
    }
    if (context.auth.user?.role !== Role.APPLICANT && context.auth.user?.role !== Role.ADMINISTRATOR) {
      throw redirect({ to: "/forbidden" });
    }
  },
  component: ApplicantLayout,
});

export const applicantDashboardRoute = createRoute({
  getParentRoute: () => applicantLayoutRoute,
  path: "/app",
  component: ApplicantDashboard,
});

export const applicantJobsRoute = createRoute({
  getParentRoute: () => applicantLayoutRoute,
  path: "/app/jobs",
  component: JobsPage,
});

export const applicantJobDetailRoute = createRoute({
  getParentRoute: () => applicantLayoutRoute,
  path: "/app/jobs/$jobId",
  component: JobDetailPage,
});

export const applicantApplicationsRoute = createRoute({
  getParentRoute: () => applicantLayoutRoute,
  path: "/app/applications",
  component: MyApplicationsPage,
});

export const applicantApplicationDetailRoute = createRoute({
  getParentRoute: () => applicantLayoutRoute,
  path: "/app/applications/$applicationId",
  component: ApplicantApplicationDetailPage,
});

export const applicantProfileRoute = createRoute({
  getParentRoute: () => applicantLayoutRoute,
  path: "/app/profile",
  component: ProfilePage,
});

export const applicantNotificationsRoute = createRoute({
  getParentRoute: () => applicantLayoutRoute,
  path: "/app/notifications",
  component: NotificationsPage,
});

// -------------------------------------------------------------
// 5. TA Protected Layout & Child Routes
// -------------------------------------------------------------
export const taLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "ta-layout",
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    if (context.auth.mustChangePassword) {
      throw redirect({ to: "/change-password" });
    }
    if (
      context.auth.user?.role !== Role.TALENT_ACQUISITION &&
      context.auth.user?.role !== Role.ADMINISTRATOR
    ) {
      throw redirect({ to: "/forbidden" });
    }
  },
  component: TALayout,
});

export const taDashboardRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta",
  component: TADashboard,
});

export const taApplicationsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/applications",
  component: TAApplicationsPage,
});

export const taApplicationDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/applications/$applicationId",
  component: TAApplicationDetailPage,
});

export const taJobsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/jobs",
  component: JobPostingsPage,
});

export const taJobDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/jobs/$jobId",
  component: JobPostingDetailPage,
});

export const taMrfRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/mrfs",
  component: MRFListPage,
});

export const taMrfCreateRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/mrfs/create",
  component: MRFCreatePage,
});

export const taMrfDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/mrfs/$mrfId",
  component: MRFDetailPage,
});

export const taTalentPoolRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/talent-pool",
  component: TalentPoolPage,
});

export const taInterviewsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/interviews",
  component: InterviewsPage,
});

export const taClientsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/clients",
  component: ClientsPage,
});

export const taClientDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/clients/$clientId",
  component: ClientDetailPage,
});

export const taComplianceRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/compliance",
  component: CompliancePage,
});

export const taDeploymentsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/deployments",
  component: DeploymentsPage,
});

export const taDeploymentDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/deployments/$deploymentId",
  component: DeploymentDetailPage,
});

export const taEmployeesRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/employees",
  component: EmployeesPage,
});

export const taEmployeeDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/employees/$employeeId",
  component: EmployeeDetailPage,
});

export const taAnalyticsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/analytics",
  component: AnalyticsPage,
});

export const taNotificationsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/notifications",
  component: NotificationsPage,
});

// -------------------------------------------------------------
// 6. Admin Protected Layout & Child Routes
// -------------------------------------------------------------
export const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin-layout",
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    if (context.auth.mustChangePassword) {
      throw redirect({ to: "/change-password" });
    }
    if (context.auth.user?.role !== Role.ADMINISTRATOR) {
      throw redirect({ to: "/forbidden" });
    }
  },
  component: AdminLayout,
});

export const adminDashboardRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin",
  component: AdminDashboard,
});

export const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/users",
  component: UsersPage,
});

export const adminScoringRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/scoring",
  component: ScoringConfigPage,
});

export const adminScoringQualityRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/scoring/quality",
  component: ScoringQualityPage,
});

export const adminRevalidationRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/revalidation",
  component: RevalidationQueuePage,
});

export const adminAuditRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/audit",
  component: AuditLogsPage,
});

export const adminNotificationsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/notifications",
  component: NotificationsPage,
});

// -------------------------------------------------------------
// 7. Route Tree Assembly & Router Creation
// -------------------------------------------------------------
const routeTree = rootRoute.addChildren([
  indexRoute,
  forbiddenRoute,
  devGalleryRoute,
  authLayoutRoute.addChildren([
    loginRoute,
    registerRoute,
    forgotPasswordRoute,
    resetPasswordRoute,
    setupAccountRoute,
    changePasswordRoute,
  ]),
  applicantLayoutRoute.addChildren([
    applicantDashboardRoute,
    applicantJobsRoute,
    applicantJobDetailRoute,
    applicantApplicationsRoute,
    applicantApplicationDetailRoute,
    applicantProfileRoute,
    applicantNotificationsRoute,
  ]),
  taLayoutRoute.addChildren([
    taDashboardRoute,
    taApplicationsRoute,
    taApplicationDetailRoute,
    taJobsRoute,
    taJobDetailRoute,
    taMrfRoute,
    taMrfCreateRoute,
    taMrfDetailRoute,
    taTalentPoolRoute,
    taInterviewsRoute,
    taClientsRoute,
    taClientDetailRoute,
    taComplianceRoute,
    taDeploymentsRoute,
    taDeploymentDetailRoute,
    taEmployeesRoute,
    taEmployeeDetailRoute,
    taAnalyticsRoute,
    taNotificationsRoute,
  ]),
  adminLayoutRoute.addChildren([
    adminDashboardRoute,
    adminUsersRoute,
    adminScoringRoute,
    adminScoringQualityRoute,
    adminRevalidationRoute,
    adminAuditRoute,
    adminNotificationsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
    queryClient: undefined!,
  },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
