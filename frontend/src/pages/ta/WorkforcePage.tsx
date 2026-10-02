import React from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { DeploymentsPage } from "./DeploymentsPage";
import { EmployeesPage } from "./EmployeesPage";
import { CompliancePage } from "./CompliancePage";
import { PostDeploymentCompliancePage } from "./PostDeploymentCompliancePage";
import { Send, IdCard, FileCheck2, FileClock } from "lucide-react";
import { PageHeader, Tabs } from "../../components/common";
import { TA_COPY } from "../../lib/ta-copy";

export type WorkforceTab = "deployments" | "employees" | "clearances" | "post_deployment";

const VALID_TABS: readonly WorkforceTab[] = [
  "deployments",
  "employees",
  "clearances",
  "post_deployment",
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

  const activeTab = currentTab;

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
        ]}
      />

      {/* Active Tab View */}
      <div id={`workforce-${activeTab}`} role="tabpanel" aria-label={`${activeTab} view`} tabIndex={0}>
        {activeTab === "deployments" && <DeploymentsPage hideHeader />}
        {activeTab === "employees" && <EmployeesPage hideHeader />}
        {activeTab === "clearances" && <CompliancePage hideHeader />}
        {activeTab === "post_deployment" && <PostDeploymentCompliancePage hideHeader />}
      </div>
    </div>
  );
};
