import React from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { employeesApi } from "../../lib/api/employees.api";
import { Send, IdCard, FileCheck2, FileClock } from "lucide-react";
import { PageHeader, Tabs } from "../../components/common";
import { TA_COPY } from "../../lib/ta-copy";

const DeploymentsPage = React.lazy(() =>
  import("./DeploymentsPage").then(({ DeploymentsPage }) => ({ default: DeploymentsPage })),
);
const EmployeesPage = React.lazy(() =>
  import("./EmployeesPage").then(({ EmployeesPage }) => ({ default: EmployeesPage })),
);
const CompliancePage = React.lazy(() =>
  import("./CompliancePage").then(({ CompliancePage }) => ({ default: CompliancePage })),
);
const PostDeploymentCompliancePage = React.lazy(() =>
  import("./PostDeploymentCompliancePage").then(({ PostDeploymentCompliancePage }) => ({ default: PostDeploymentCompliancePage })),
);
const RedeploymentQueuePage = React.lazy(() => import("./RedeploymentQueuePage").then(({ RedeploymentQueuePage }) => ({ default: RedeploymentQueuePage })));

export type WorkforceTab = "deployments" | "employees" | "clearances" | "post_deployment" | "redeployment";

const VALID_TABS: readonly WorkforceTab[] = [
  "deployments",
  "employees",
  "clearances",
  "post_deployment",
  "redeployment",
];

export const WorkforcePage: React.FC<{ initialTab?: WorkforceTab }> = ({ initialTab }) => {
  const search = useSearch({ strict: false }) as { tab?: WorkforceTab };
  const navigate = useNavigate();

  const resolvedInitial: WorkforceTab =
    initialTab ||
    (search.tab && VALID_TABS.includes(search.tab)
      ? search.tab
      : "deployments");

  const [currentTab, setCurrentTab] = React.useState<WorkforceTab>(resolvedInitial);

  React.useEffect(() => {
    if (initialTab) {
      setCurrentTab(initialTab);
    } else if (search.tab && VALID_TABS.includes(search.tab)) {
      setCurrentTab(search.tab);
    }
  }, [initialTab, search.tab]);

  const handleTabChange = (tab: WorkforceTab) => {
    setCurrentTab(tab);
    try {
      navigate({
        to: "/ta/workforce",
        search: { tab },
      });
    } catch {
      // safe fallback
    }
  };

  // Counts only: the full queue is downloaded by the Redeployment tab itself, one page at a time.
  const redeploymentSummary = useQuery({
    queryKey: ["ta", "redeployment-queue", "summary"],
    queryFn: ({ signal }) => employeesApi.getRedeploymentQueueSummary({ signal }),
  });
  const needsPlacement = redeploymentSummary.data?.stages?.NEEDS_PLACEMENT ?? 0;

  const activeTab = currentTab;
  const tabFallback = (
    <div className="flex min-h-32 items-center justify-center text-sm text-slate-600" role="status" aria-live="polite">
      Loading workforce view…
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={TA_COPY.navigation.workforce}
        description="Manage site deployments, employee records, and pre-employment requirements."
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.workforce },
        ]}
      />

      {/* Sub-navigation tabs */}
      <Tabs
        value={activeTab}
        onChange={(tab) => handleTabChange(tab as WorkforceTab)}
        ariaLabel="Workforce views"
        items={[
          { id: "deployments", label: "Deployments", icon: Send, panelId: "workforce-deployments" },
          { id: "employees", label: "Employee Records (201)", icon: IdCard, panelId: "workforce-employees" },
          { id: "clearances", label: "Pre-employment Queue", icon: FileCheck2, panelId: "workforce-clearances" },
          { id: "post_deployment", label: "Post-Deployment Follow-ups", icon: FileClock, panelId: "workforce-post-deployment" },
          {
            id: "redeployment",
            label: "Redeployment",
            icon: Send,
            panelId: "workforce-redeployment",
            ...(needsPlacement > 0 ? { badge: { text: `${needsPlacement} need placement`, variant: "warning" as const } } : {}),
          },
        ]}
      />

      {/* Active Tab View */}
      <div id={`workforce-${activeTab}`} role="tabpanel" aria-label={`${activeTab} view`} tabIndex={0}>
        {activeTab === "deployments" && <React.Suspense fallback={tabFallback}><DeploymentsPage hideHeader /></React.Suspense>}
        {activeTab === "employees" && <React.Suspense fallback={tabFallback}><EmployeesPage hideHeader /></React.Suspense>}
        {activeTab === "clearances" && <React.Suspense fallback={tabFallback}><CompliancePage hideHeader /></React.Suspense>}
        {activeTab === "post_deployment" && <React.Suspense fallback={tabFallback}><PostDeploymentCompliancePage hideHeader /></React.Suspense>}
        {activeTab === "redeployment" && <React.Suspense fallback={tabFallback}><RedeploymentQueuePage /></React.Suspense>}
      </div>
    </div>
  );
};
