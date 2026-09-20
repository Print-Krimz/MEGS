import React from "react";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { AuthContextType } from "./context/AuthContext";
import { ApplicationStatus, PIPELINE_FILTER_STAGES, Role } from "./lib/types/enums";
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

// Applicant Pages
import { ApplicantDashboard } from "./pages/applicant/ApplicantDashboard";
import { ProfilePage } from "./pages/applicant/ProfilePage";
import { JobsPage } from "./pages/applicant/JobsPage";
import { JobDetailPage } from "./pages/applicant/JobDetailPage";
import { MyApplicationsPage } from "./pages/applicant/MyApplicationsPage";
import { ApplicationDetailPage as ApplicantApplicationDetailPage } from "./pages/applicant/ApplicationDetailPage";
import { NotificationsPage } from "./pages/applicant/NotificationsPage";

// Talent Acquisition (TA) Pages are loaded on demand so the login and first
// dashboard paint do not pay for every detail workflow up front.
const withRouteSuspense = (Page: React.ComponentType<any>) => (props: any) => (
  <React.Suspense
    fallback={
      <div className="flex min-h-32 items-center justify-center text-sm text-slate-600" role="status">
        Loading workspace…
      </div>
    }
  >
    <Page {...props} />
  </React.Suspense>
);

const TADashboard = withRouteSuspense(React.lazy(() => import("./pages/ta/TADashboard").then((module) => ({ default: module.TADashboard }))));
const TAApplicationsPage = withRouteSuspense(React.lazy(() => import("./pages/ta/ApplicationsPage").then((module) => ({ default: module.ApplicationsPage }))));
const TAApplicationDetailPage = withRouteSuspense(React.lazy(() => import("./pages/ta/ApplicationDetailPage").then((module) => ({ default: module.ApplicationDetailPage }))));
const JobPostingsPage = withRouteSuspense(React.lazy(() => import("./pages/ta/JobPostingsPage").then((module) => ({ default: module.JobPostingsPage }))));
const JobPostingDetailPage = withRouteSuspense(React.lazy(() => import("./pages/ta/JobPostingDetailPage").then((module) => ({ default: module.JobPostingDetailPage }))));
const MRFListPage = withRouteSuspense(React.lazy(() => import("./pages/ta/MRFListPage").then((module) => ({ default: module.MRFListPage }))));
const MRFCreatePage = withRouteSuspense(React.lazy(() => import("./pages/ta/MRFCreatePage").then((module) => ({ default: module.MRFCreatePage }))));
const MRFDetailPage = withRouteSuspense(React.lazy(() => import("./pages/ta/MRFDetailPage").then((module) => ({ default: module.MRFDetailPage }))));
const TalentPoolPage = withRouteSuspense(React.lazy(() => import("./pages/ta/TalentPoolPage").then((module) => ({ default: module.TalentPoolPage }))));
const InterviewsPage = withRouteSuspense(React.lazy(() => import("./pages/ta/InterviewsPage").then((module) => ({ default: module.InterviewsPage }))));
const ClientsPage = withRouteSuspense(React.lazy(() => import("./pages/ta/ClientsPage").then((module) => ({ default: module.ClientsPage }))));
const ClientDetailPage = withRouteSuspense(React.lazy(() => import("./pages/ta/ClientDetailPage").then((module) => ({ default: module.ClientDetailPage }))));
const DeploymentDetailPage = withRouteSuspense(React.lazy(() => import("./pages/ta/DeploymentDetailPage").then((module) => ({ default: module.DeploymentDetailPage }))));
const EmployeeDetailPage = withRouteSuspense(React.lazy(() => import("./pages/ta/EmployeeDetailPage").then((module) => ({ default: module.EmployeeDetailPage }))));
const WorkforcePage = withRouteSuspense(React.lazy(() => import("./pages/ta/WorkforcePage").then((module) => ({ default: module.WorkforcePage }))));
const AnalyticsPage = withRouteSuspense(React.lazy(() => import("./pages/ta/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage }))));

// Admin Pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminAnalyticsPage } from "./pages/admin/AdminAnalyticsPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ScoringConfigPage } from "./pages/admin/ScoringConfigPage";
import { ScoringQualityPage } from "./pages/admin/ScoringQualityPage";
import { DatabaseMaintenancePage } from "./pages/admin/DatabaseMaintenancePage";
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
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated && context.auth.user) {
      if (context.auth.mustChangePassword) {
        throw redirect({ to: "/change-password" });
      }
      if (context.auth.user.role === Role.ADMINISTRATOR) {
        throw redirect({ to: "/admin" });
      }
      if (context.auth.user.role === Role.TALENT_ACQUISITION) {
        throw redirect({ to: "/ta" });
      }
      throw redirect({ to: "/app" });
    }
  },
  component: LoginPage,
});

export const registerRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/register",
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated && context.auth.user) {
      if (context.auth.mustChangePassword) {
        throw redirect({ to: "/change-password" });
      }
      if (context.auth.user.role === Role.ADMINISTRATOR) {
        throw redirect({ to: "/admin" });
      }
      if (context.auth.user.role === Role.TALENT_ACQUISITION) {
        throw redirect({ to: "/ta" });
      }
      throw redirect({ to: "/app" });
    }
  },
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
    if (context.auth.user?.role !== Role.APPLICANT) {
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

export const applicantInvitationsRoute = createRoute({
  getParentRoute: () => applicantLayoutRoute,
  path: "/app/invitations",
  beforeLoad: () => {
    throw redirect({
      to: "/app/applications",
      search: { tab: "invitations" },
    });
  },
  component: () => null,
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
    if (context.auth.user?.role !== Role.TALENT_ACQUISITION) {
      throw redirect({ to: "/forbidden" });
    }
  },
  component: TALayout,
});

export interface TAApplicationSearch {
  q?: string;
  stage?: ApplicationStatus;
  clientId?: number;
  jobId?: number;
  mine?: boolean;
  archived?: boolean;
  page?: number;
  tab?: string;
}

const parsePositiveNumber = (value: unknown): number | undefined => {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return undefined;
};

const parseTAApplicationSearch = (
  search: Record<string, unknown>,
  includeTab = false,
): TAApplicationSearch => {
  const stage = typeof search.stage === "string" && PIPELINE_FILTER_STAGES.includes(search.stage as ApplicationStatus)
    ? (search.stage as ApplicationStatus)
    : undefined;
  return {
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
    stage,
    clientId: parsePositiveNumber(search.clientId),
    jobId: parsePositiveNumber(search.jobId),
    mine: parseBoolean(search.mine),
    archived: parseBoolean(search.archived),
    page: parsePositiveNumber(search.page),
    tab: includeTab && typeof search.tab === "string" ? search.tab : undefined,
  };
};

export const taDashboardRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta",
  component: TADashboard,
});

export const taApplicationsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/applications",
  validateSearch: (search: Record<string, unknown>): TAApplicationSearch => parseTAApplicationSearch(search),
  component: TAApplicationsPage,
});

export const taApplicationDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/applications/$applicationId",
  validateSearch: (search: Record<string, unknown>): TAApplicationSearch => parseTAApplicationSearch(search, true),
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

export interface WorkforceSearch {
  tab?: "deployments" | "employees" | "clearances";
}

export const taComplianceRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/compliance",
  beforeLoad: () => {
    throw redirect({ to: "/ta/workforce", search: { tab: "clearances" } });
  },
  component: () => null,
});

export const taDeploymentsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/deployments",
  beforeLoad: () => {
    throw redirect({ to: "/ta/workforce", search: { tab: "deployments" } });
  },
  component: () => null,
});

export const taDeploymentDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/deployments/$deploymentId",
  component: DeploymentDetailPage,
});

export const taEmployeesRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/employees",
  beforeLoad: () => {
    throw redirect({ to: "/ta/workforce", search: { tab: "employees" } });
  },
  component: () => null,
});

export const taEmployeeDetailRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/employees/$employeeId",
  component: EmployeeDetailPage,
});

export const taWorkforceRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/workforce",
  validateSearch: (search: Record<string, unknown>): WorkforceSearch => {
    const tab = search.tab;
    if (tab === "employees" || tab === "clearances" || tab === "deployments") {
      return { tab };
    }
    return { tab: "deployments" };
  },
  component: WorkforcePage,
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

export const adminAnalyticsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/analytics",
  component: AdminAnalyticsPage,
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

export const adminMaintenanceRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/maintenance",
  component: DatabaseMaintenancePage,
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

export const adminMrfDetailRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/mrfs/$mrfId",
  component: () => <MRFDetailPage readOnly baseBackPath="/admin/notifications" />,
});

// -------------------------------------------------------------
// 7. Route Tree Assembly & Router Creation
// -------------------------------------------------------------
const routeTree = rootRoute.addChildren([
  indexRoute,
  forbiddenRoute,
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
    applicantInvitationsRoute,
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
    taWorkforceRoute,
    taAnalyticsRoute,
    taNotificationsRoute,
  ]),
  adminLayoutRoute.addChildren([
    adminDashboardRoute,
    adminAnalyticsRoute,
    adminUsersRoute,
    adminScoringRoute,
    adminScoringQualityRoute,
    adminMaintenanceRoute,
    adminAuditRoute,
    adminNotificationsRoute,
    adminMrfDetailRoute,
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
