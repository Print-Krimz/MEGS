import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { AuthContextType } from "./context/AuthContext";
import { parseAdminReportSearch, type AdminReportSearch } from "./lib/admin-report-search";
import { getHomePath, landingRedirectPending, markLandingRedirected } from "./lib/home-path";
import { ApplicationStatus, PIPELINE_FILTER_STAGES, Role } from "./lib/types/enums";

// TanStack preloads every matched route component after synchronous guards run.
// Its native lazy components therefore load layouts and leaf pages in parallel.
const RoutePending = () => (
  <div className="flex min-h-32 items-center justify-center text-sm text-slate-600" role="status" aria-live="polite">
    Loading workspace…
  </div>
);

const LandingPage = lazyRouteComponent(() => import("./pages/public/LandingPage"), "LandingPage");

const AuthLayout = lazyRouteComponent(() => import("./layouts/AuthLayout"), "AuthLayout");
const ApplicantLayout = lazyRouteComponent(() => import("./layouts/ApplicantLayout"), "ApplicantLayout");
const TALayout = lazyRouteComponent(() => import("./layouts/TALayout"), "TALayout");
const AdminLayout = lazyRouteComponent(() => import("./layouts/AdminLayout"), "AdminLayout");

const RouteErrorPage = lazyRouteComponent(() => import("./components/common/StatusPage"), "RouteErrorPage");
const NotFoundPage = lazyRouteComponent(() => import("./pages/common/NotFoundPage"), "NotFoundPage");
const ForbiddenPage = lazyRouteComponent(() => import("./pages/common/ForbiddenPage"), "ForbiddenPage");
const ChangePasswordPage = lazyRouteComponent(() => import("./pages/common/ChangePasswordPage"), "ChangePasswordPage");

const LoginPage = lazyRouteComponent(() => import("./pages/auth/LoginPage"), "LoginPage");
const RegisterPage = lazyRouteComponent(() => import("./pages/auth/RegisterPage"), "RegisterPage");
const ForgotPasswordPage = lazyRouteComponent(() => import("./pages/auth/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyRouteComponent(() => import("./pages/auth/ResetPasswordPage"), "ResetPasswordPage");
const SetupAccountPage = lazyRouteComponent(() => import("./pages/auth/SetupAccountPage"), "SetupAccountPage");
const ClaimAccountPage = lazyRouteComponent(() => import("./pages/auth/ClaimAccountPage"), "ClaimAccountPage");
const TrackPage = lazyRouteComponent(() => import("./pages/public/TrackPage"), "TrackPage");
const OfferPage = lazyRouteComponent(() => import("./pages/public/OfferPage"), "OfferPage");
const CheckInPage = lazyRouteComponent(() => import("./pages/public/CheckInPage"), "CheckInPage");

const ApplicantDashboard = lazyRouteComponent(() => import("./pages/applicant/ApplicantDashboard"), "ApplicantDashboard");
const ProfilePage = lazyRouteComponent(() => import("./pages/applicant/ProfilePage"), "ProfilePage");
const JobsPage = lazyRouteComponent(() => import("./pages/applicant/JobsPage"), "JobsPage");
const JobDetailPage = lazyRouteComponent(() => import("./pages/applicant/JobDetailPage"), "JobDetailPage");
const MyApplicationsPage = lazyRouteComponent(() => import("./pages/applicant/MyApplicationsPage"), "MyApplicationsPage");
const MyDocumentsPage = lazyRouteComponent(() => import("./pages/applicant/MyDocumentsPage"), "MyDocumentsPage");
const ApplicantApplicationDetailPage = lazyRouteComponent(() => import("./pages/applicant/ApplicationDetailPage"), "ApplicationDetailPage");
const NotificationsPage = lazyRouteComponent(() => import("./pages/applicant/NotificationsPage"), "NotificationsPage");

const AdminDashboard = lazyRouteComponent(() => import("./pages/admin/AdminDashboard"), "AdminDashboard");
const AdminAnalyticsPage = lazyRouteComponent(() => import("./pages/admin/AdminAnalyticsPage"), "AdminAnalyticsPage");
const AdminApplicationPage = lazyRouteComponent(() => import("./pages/admin/AdminApplicationPage"), "AdminApplicationPage");
const UsersPage = lazyRouteComponent(() => import("./pages/admin/UsersPage"), "UsersPage");
const ScoringConfigPage = lazyRouteComponent(() => import("./pages/admin/ScoringConfigPage"), "ScoringConfigPage");
const ScoringQualityPage = lazyRouteComponent(() => import("./pages/admin/ScoringQualityPage"), "ScoringQualityPage");
const DatabaseMaintenancePage = lazyRouteComponent(() => import("./pages/admin/DatabaseMaintenancePage"), "DatabaseMaintenancePage");
const AuditLogsPage = lazyRouteComponent(() => import("./pages/admin/AuditLogsPage"), "AuditLogsPage");

const TADashboard = lazyRouteComponent(() => import("./pages/ta/TADashboard"), "TADashboard");
const TAApplicationsPage = lazyRouteComponent(() => import("./pages/ta/ApplicationsPage"), "ApplicationsPage");
const TAApplicationDetailPage = lazyRouteComponent(() => import("./pages/ta/ApplicationDetailPage"), "ApplicationDetailPage");
const JobPostingsPage = lazyRouteComponent(() => import("./pages/ta/JobPostingsPage"), "JobPostingsPage");
const JobPostingDetailPage = lazyRouteComponent(() => import("./pages/ta/JobPostingDetailPage"), "JobPostingDetailPage");
const MRFListPage = lazyRouteComponent(() => import("./pages/ta/MRFListPage"), "MRFListPage");
const MRFCreatePage = lazyRouteComponent(() => import("./pages/ta/MRFCreatePage"), "MRFCreatePage");
const MRFDetailPage = lazyRouteComponent(() => import("./pages/ta/MRFDetailPage"), "MRFDetailPage");
const AdminMrfDetailPage = lazyRouteComponent(
  () => import("./pages/ta/MRFDetailPage").then(({ MRFDetailPage }) => ({
    default: (props: any) => <MRFDetailPage {...props} readOnly baseBackPath="/admin/notifications" />,
  })),
);
// const TalentPoolPage = lazyRouteComponent(() => import("./pages/ta/TalentPoolPage"), "TalentPoolPage");
const InterviewsPage = lazyRouteComponent(() => import("./pages/ta/InterviewsPage"), "InterviewsPage");
const ClientsPage = lazyRouteComponent(() => import("./pages/ta/ClientsPage"), "ClientsPage");
const ClientDetailPage = lazyRouteComponent(() => import("./pages/ta/ClientDetailPage"), "ClientDetailPage");
const DeploymentDetailPage = lazyRouteComponent(() => import("./pages/ta/DeploymentDetailPage"), "DeploymentDetailPage");
const EmployeeDetailPage = lazyRouteComponent(() => import("./pages/ta/EmployeeDetailPage"), "EmployeeDetailPage");
const WorkforcePage = lazyRouteComponent(() => import("./pages/ta/WorkforcePage"), "WorkforcePage");
const CompliancePage = lazyRouteComponent(() => import("./pages/ta/CompliancePage"), "CompliancePage");
const AnalyticsPage = lazyRouteComponent(() => import("./pages/ta/AnalyticsPage"), "AnalyticsPage");

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

// -------------------------------------------------------------
// 2. Public Root Route ('/') - Corporate Landing Page
// -------------------------------------------------------------
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated || !context.auth.user || !landingRedirectPending()) return;
    markLandingRedirected();
    throw redirect({ to: context.auth.mustChangePassword ? "/change-password" : getHomePath(context.auth.user) });
  },
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
  reason?: "idle";
}

export const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    reason: search.reason === "idle" ? "idle" : undefined,
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

export const claimAccountRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/claim",
  component: ClaimAccountPage,
});

export const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forbidden",
  component: ForbiddenPage,
});

// Public, no login: opened from a printed walk-in slip QR or a texted offer link.
export interface PublicTokenSearch {
  token?: string;
}

const parsePublicTokenSearch = (search: Record<string, unknown>): PublicTokenSearch => ({
  token: typeof search.token === "string" ? search.token : undefined,
});

export const trackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/t/$code",
  validateSearch: parsePublicTokenSearch,
  component: TrackPage,
});

export const offerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/offer/$id",
  validateSearch: parsePublicTokenSearch,
  component: OfferPage,
});

// Self check-in from the MEGS poster QR, then the applicant's own status link.
export const checkInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/check-in",
  component: CheckInPage,
});

export const checkInStatusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/check-in/$publicId",
  validateSearch: parsePublicTokenSearch,
  component: CheckInPage,
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

export const applicantDocumentsRoute = createRoute({ getParentRoute: () => applicantLayoutRoute, path: "/app/documents", component: MyDocumentsPage });

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
  // Render 404s inside the TA shell (the layout's <Outlet /> shows this).
  notFoundComponent: NotFoundPage,
});

export type ApplicationSourceFilter = "ONLINE" | "WALK_IN";
const APPLICATION_SOURCE_FILTERS: ApplicationSourceFilter[] = ["ONLINE", "WALK_IN"];

export interface TAApplicationSearch {
  q?: string;
  stage?: ApplicationStatus;
  clientId?: number;
  jobId?: number;
  archived?: boolean;
  returning?: boolean;
  /** How the application reached MEGS; omitted means all sources. */
  source?: ApplicationSourceFilter;
  /** Applications list order; omitted means best match. */
  sort?: "newest" | "oldest" | "waiting";
  needsAction?: boolean;
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
    archived: parseBoolean(search.archived),
    returning: parseBoolean(search.returning),
    source: APPLICATION_SOURCE_FILTERS.includes(search.source as ApplicationSourceFilter)
      ? (search.source as ApplicationSourceFilter)
      : undefined,
    sort: search.sort === "newest" || search.sort === "oldest" || search.sort === "waiting" ? search.sort : undefined,
    needsAction: parseBoolean(search.needsAction),
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
  // Starts the page's data requests on hover or navigation instead of after its code renders.
  // Failures are swallowed here: the page's own queries show the error state.
  loader: async ({ context, params }) => {
    try {
      // Imported here so the entry bundle stays small; the detail page shares this chunk.
      const q = await import("./lib/api/ta.queries");
      const { queryClient } = context;
      const id = params.applicationId;
      const [application] = await Promise.all([
        queryClient.ensureQueryData(q.taApplicationDetailQuery(id)).catch(() => undefined),
        queryClient.ensureQueryData(q.taApplicationDecisionsQuery(id)).catch(() => undefined),
        queryClient.ensureQueryData(q.taClientsQuery()).catch(() => undefined),
      ]);
      const profile = application?.user?.applicantProfile;
      if (profile?.id) void queryClient.prefetchQuery(q.resumeParseStateQuery(profile.id));
    } catch {
      // The page's own queries show the error state.
    }
  },
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

// Candidate pool hidden for now. Restore this route, its lazy import, and its entry in the route tree.
// export const taTalentPoolRoute = createRoute({
//   getParentRoute: () => taLayoutRoute,
//   path: "/ta/talent-pool",
//   component: TalentPoolPage,
// });

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
  /** `clearances` is the old pre-employment tab; it redirects to /ta/requirements. */
  tab?: "deployments" | "employees" | "follow-ups" | "redeployment" | "clearances";
  /** Search text for the Deployments tab, used by "View all deployments" links. */
  q?: string;
}

// Pre-employment requirements live in the Recruitment group; /ta/compliance was its old address.
export const taRequirementsRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/requirements",
  component: CompliancePage,
});

export const taComplianceRoute = createRoute({
  getParentRoute: () => taLayoutRoute,
  path: "/ta/compliance",
  beforeLoad: () => {
    throw redirect({ to: "/ta/requirements" });
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
    const q = typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined;
    const withQuery = <T extends WorkforceSearch>(value: T): T => (q ? { ...value, q } : value);
    // post_deployment is the old name of the follow-ups tab.
    if (tab === "post_deployment" || tab === "follow-ups") return withQuery({ tab: "follow-ups" });
    if (tab === "employees" || tab === "clearances" || tab === "deployments" || tab === "redeployment") {
      return withQuery({ tab });
    }
    return withQuery({ tab: "deployments" });
  },
  beforeLoad: ({ search }) => {
    if (search.tab === "clearances") throw redirect({ to: "/ta/requirements" });
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
  validateSearch: (search: Record<string, unknown>): AdminReportSearch => parseAdminReportSearch(search),
  component: AdminAnalyticsPage,
});

export interface AdminUsersSearch {
  status?: "active" | "inactive" | "invited";
  role?: Role;
  lastLogin?: "7d" | "30d" | "never";
}

export const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/users",
  validateSearch: (search: Record<string, unknown>): AdminUsersSearch => ({
    status: search.status === "active" || search.status === "inactive" || search.status === "invited" ? search.status : undefined,
    role: Object.values(Role).includes(search.role as Role) ? (search.role as Role) : undefined,
    lastLogin: search.lastLogin === "7d" || search.lastLogin === "30d" || search.lastLogin === "never" ? search.lastLogin : undefined,
  }),
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

export const adminApplicationDetailRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/applications/$applicationId",
  component: AdminApplicationPage,
});

export const adminMrfDetailRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/mrfs/$mrfId",
  component: AdminMrfDetailPage,
});

// -------------------------------------------------------------
// 7. Route Tree Assembly & Router Creation
// -------------------------------------------------------------
const routeTree = rootRoute.addChildren([
  indexRoute,
  forbiddenRoute,
  trackRoute,
  offerRoute,
  checkInRoute,
  checkInStatusRoute,
  authLayoutRoute.addChildren([
    loginRoute,
    registerRoute,
    forgotPasswordRoute,
    resetPasswordRoute,
    setupAccountRoute,
    claimAccountRoute,
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
    applicantDocumentsRoute,
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
    // taTalentPoolRoute,
    taInterviewsRoute,
    taClientsRoute,
    taClientDetailRoute,
    taRequirementsRoute,
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
    adminApplicationDetailRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
    queryClient: undefined!,
  },
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteErrorPage,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
