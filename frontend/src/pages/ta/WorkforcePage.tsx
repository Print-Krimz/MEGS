import React from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { DeploymentsPage } from "./DeploymentsPage";
import { EmployeesPage } from "./EmployeesPage";
import { CompliancePage } from "./CompliancePage";
import { Send, IdCard, FileCheck2 } from "lucide-react";
import { PageHeader } from "../../components/common";

export type WorkforceTab = "deployments" | "employees" | "clearances";

export const WorkforcePage: React.FC<{ initialTab?: WorkforceTab }> = ({ initialTab }) => {
  const search = useSearch({ strict: false }) as { tab?: WorkforceTab };
  const navigate = useNavigate();

  const resolvedInitial: WorkforceTab =
    initialTab ||
    (search.tab === "employees" || search.tab === "clearances" || search.tab === "deployments"
      ? search.tab
      : "deployments");

  const [currentTab, setCurrentTab] = React.useState<WorkforceTab>(resolvedInitial);

  React.useEffect(() => {
    if (initialTab) {
      setCurrentTab(initialTab);
    } else if (search.tab && ["deployments", "employees", "clearances"].includes(search.tab)) {
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
        title="Workforce & Placements"
        description="Monitor field site assignments, digital 201 employee records, and pre-employment clearances in one place."
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Workforce & Placements" },
        ]}
      />

      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-0 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange("deployments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "deployments"
              ? "border-teal-700 text-teal-800 bg-white"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Active Site Deployments</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("employees")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "employees"
              ? "border-teal-700 text-teal-800 bg-white"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <IdCard className="w-3.5 h-3.5" />
          <span>Digital 201 Directory</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("clearances")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "clearances"
              ? "border-teal-700 text-teal-800 bg-white"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Pre-Employment Clearances</span>
        </button>
      </div>

      {/* Active Tab View */}
      <div>
        {activeTab === "deployments" && <DeploymentsPage hideHeader />}
        {activeTab === "employees" && <EmployeesPage hideHeader />}
        {activeTab === "clearances" && <CompliancePage hideHeader />}
      </div>
    </div>
  );
};
