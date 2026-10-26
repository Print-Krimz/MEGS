import React from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { employeesApi } from "../../lib/api/employees.api";
import { PageHeader, Tabs } from "../../components/common";
import { TA_COPY } from "../../lib/ta-copy";

const DeploymentsPage = React.lazy(() =>
  import("./DeploymentsPage").then(({ DeploymentsPage }) => ({ default: DeploymentsPage })),
);
const EmployeesPage = React.lazy(() =>
  import("./EmployeesPage").then(({ EmployeesPage }) => ({ default: EmployeesPage })),
);
const PostDeploymentCompliancePage = React.lazy(() =>
  import("./PostDeploymentCompliancePage").then(({ PostDeploymentCompliancePage }) => ({ default: PostDeploymentCompliancePage })),
);
const RedeploymentQueuePage = React.lazy(() => import("./RedeploymentQueuePage").then(({ RedeploymentQueuePage }) => ({ default: RedeploymentQueuePage })));

export type WorkforceTab = "deployments" | "employees" | "follow-ups" | "redeployment";

const VALID_TABS: readonly WorkforceTab[] = ["deployments", "employees", "follow-ups", "redeployment"];

/** Old links used `post_deployment` for the follow-ups tab. They keep working. */
const normalizeWorkforceTab = (tab: unknown): WorkforceTab | undefined => {
  if (tab === "post_deployment") return "follow-ups";
  return VALID_TABS.find((valid) => valid === tab);
};

const TAB_LABELS: Record<WorkforceTab, string> = {
  deployments: TA_COPY.workforce.tabs.deployments,
  employees: TA_COPY.workforce.tabs.employees,
  "follow-ups": TA_COPY.workforce.tabs.followUps,
  redeployment: TA_COPY.workforce.tabs.redeployment,
};

const panelIdOf = (tab: WorkforceTab) => `workforce-${tab}`;
const tabIdOf = (tab: WorkforceTab) => `workforce-tab-${tab}`;

export const WorkforcePage: React.FC<{ initialTab?: WorkforceTab }> = ({ initialTab }) => {
  const search = useSearch({ strict: false }) as { tab?: string; q?: string };
  const navigate = useNavigate();

  const requestedTab = normalizeWorkforceTab(initialTab) ?? normalizeWorkforceTab(search.tab);
  const [currentTab, setCurrentTab] = React.useState<WorkforceTab>(requestedTab ?? "deployments");

  React.useEffect(() => {
    if (requestedTab) setCurrentTab(requestedTab);
  }, [requestedTab]);

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
      Loading {TAB_LABELS[activeTab].toLowerCase()}…
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={TA_COPY.navigation.workforce}
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.workforce },
        ]}
        flush
      />

      <Tabs
        value={activeTab}
        onChange={(tab) => handleTabChange(tab as WorkforceTab)}
        ariaLabel="Workforce views"
        items={VALID_TABS.map((tab) => ({
          id: tab,
          label: TAB_LABELS[tab],
          panelId: panelIdOf(tab),
          tabId: tabIdOf(tab),
          ...(tab === "redeployment" && needsPlacement > 0
            ? { badge: { text: String(needsPlacement), variant: "warning" as const } }
            : {}),
        }))}
      />

      <div id={panelIdOf(activeTab)} role="tabpanel" aria-labelledby={tabIdOf(activeTab)} tabIndex={0}>
        <React.Suspense fallback={tabFallback}>
          {activeTab === "deployments" && <DeploymentsPage hideHeader initialSearch={search.q} />}
          {activeTab === "employees" && <EmployeesPage hideHeader />}
          {activeTab === "follow-ups" && (
            <>
              {/* The tab hides the page header, so keep the one-line purpose visible here. */}
              <p className="mb-4 text-sm text-slate-600">{TA_COPY.workforce.followUpsDescription}</p>
              <PostDeploymentCompliancePage hideHeader />
            </>
          )}
          {activeTab === "redeployment" && <RedeploymentQueuePage />}
        </React.Suspense>
      </div>
    </div>
  );
};
