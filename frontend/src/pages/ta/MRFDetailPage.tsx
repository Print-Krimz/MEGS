import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  ConfirmDialog,
  StatusBadge,
} from "../../components/common";
import { Button, Dialog, Select, ComboBox } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { COMPLIANCE_201_PRESETS } from "../../lib/hr-constants";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ShieldCheck,
  Edit,
  CheckCircle2,
  Users,
  Briefcase,
  FileText,
  Search,
  X,
  ExternalLink,
} from "lucide-react";
import { notify } from "../../lib/feedback";

type MRFDetailTab = "deployments" | "jobs" | "specifications";

export interface MRFDetailPageProps {
  readOnly?: boolean;
  baseBackPath?: string;
}

export const MRFDetailPage: React.FC<MRFDetailPageProps> = ({
  readOnly = false,
  baseBackPath = "/ta/mrfs",
}) => {
  const queryClient = useQueryClient();
  const { mrfId } = useParams({ strict: false }) as { mrfId: string };

  const [activeTab, setActiveTab] = useState<MRFDetailTab>("deployments");
  const [personnelSearch, setPersonnelSearch] = useState("");

  const [linkJobModalOpen, setLinkJobModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number>(0);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateLabel, setTemplateLabel] = useState("");
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<{ id: number; label: string } | null>(null);

  const [editStatusModalOpen, setEditStatusModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<any>("OPEN");

  const mrfQuery = useQuery({
    queryKey: [readOnly ? "admin" : "ta", "mrf", mrfId],
    queryFn: () => (readOnly ? adminApi.getMRFDetails(mrfId) : taApi.getMRFDetails(mrfId)),
    enabled: Boolean(mrfId),
  });

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "all"],
    queryFn: () => taApi.listJobs(),
    enabled: !readOnly,
  });

  // Mutations
  const linkJobMutation = useMutation({
    mutationFn: (jobId: number) => taApi.linkJobToMRF(mrfId, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      setLinkJobModalOpen(false);
      setSelectedJobId(0);
      notify.success("Job Requisition Linked", "Job position linked to this MRF successfully.");
    },
    onError: (err: any) => {
      notify.error("Failed to Link Job", err);
    },
  });

  const addTemplateMutation = useMutation({
    mutationFn: (data: { documentLabel: string; isRequired?: boolean }) =>
      taApi.addMRFComplianceTemplate(mrfId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      setTemplateModalOpen(false);
      setTemplateLabel("");
      notify.success("Compliance Template Added", "Document template requirement added.");
    },
    onError: (err: any) => {
      notify.error("Failed to Add Template", err);
    },
  });

  const removeTemplateMutation = useMutation({
    mutationFn: (templateId: number) => taApi.removeMRFComplianceTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      setDeleteTemplateTarget(null);
      notify.success("Template Removed", "Compliance requirement template removed.");
    },
    onError: (err: any) => {
      notify.error("Failed to Remove Template", err);
    },
  });

  const updateMRFMutation = useMutation({
    mutationFn: (data: any) => taApi.updateMRF(mrfId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      setEditStatusModalOpen(false);
      notify.success("MRF Status Updated", "Manpower request updated successfully.");
    },
    onError: (err: any) => {
      notify.error("Failed to Update MRF", err);
    },
  });

  if (mrfQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Manpower Request"
          description={readOnly ? "Loading request details..." : "Loading MRF order..."}
        />
        <LoadingState variant="detail" />
      </div>
    );
  }

  const isNotFound =
    mrfQuery.error?.message?.toLowerCase().includes("not found") ||
    (mrfQuery.error as any)?.status === 404;

  if (isNotFound) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Manpower Request Not Found"
          description={`MRF Reference #${mrfId || "Unknown"}`}
          breadcrumbs={
            readOnly
              ? [
                  { label: "Administration", href: "/admin" },
                  { label: "Notifications", href: baseBackPath },
                  { label: "Record Not Found" },
                ]
              : [
                  { label: "TA Portal", href: "/ta" },
                  { label: "Manpower Requests", href: baseBackPath },
                  { label: "Record Not Found" },
                ]
          }
          actions={
            <Link to={baseBackPath}>
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                {readOnly ? "Back to Notifications" : "Back to Requests"}
              </Button>
            </Link>
          }
        />
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Briefcase className="w-6 h-6 text-slate-400" />}
            title="Manpower Request Not Available"
            description={`The Manpower Request record (#${mrfId}) was not found or may have been deleted.`}
            action={
              <Link to={baseBackPath}>
                <Button variant="primary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                  {readOnly ? "Return to Notifications" : "Return to Requests"}
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (mrfQuery.isError || !mrfQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Manpower Request" description="MRF details" />
        <ErrorState
          error={mrfQuery.error || new Error("Unable to load Manpower Request")}
          onRetry={() => mrfQuery.refetch()}
        />
      </div>
    );
  }

  const mrf = mrfQuery.data;
  const jobs = jobsQuery.data || [];
  const linkedJobs = mrf.jobPostings || [];
  const templates = mrf.complianceTemplates || [];
  const deployments = (mrf.deployments as any[]) || [];
  const deployedCount = mrf.fulfillment?.deployedCount ?? deployments.length;
  const fulfillmentRate =
    mrf.fulfillment?.fulfillmentRate ??
    (mrf.headcount > 0 ? Math.round((deployedCount / mrf.headcount) * 100) : 0);
  const remainingCount =
    mrf.fulfillment?.remainingCount ?? Math.max(0, mrf.headcount - deployedCount);
  const isFulfilled = mrf.status === "FILLED" || Boolean(mrf.fulfillment?.isFulfilled);

  // Filter deployments by personnel search query
  const filteredDeployments = deployments.filter((d: any) => {
    if (!personnelSearch.trim()) return true;
    const query = personnelSearch.toLowerCase().trim();
    const profile =
      d.employee?.user?.applicantProfile || d.application?.user?.applicantProfile;
    const workerName = profile
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
      : d.employee?.user?.email || "";
    const empNumber = d.employee?.employeeNumber || "";
    const site = d.site || mrf.location || "";
    return (
      workerName.toLowerCase().includes(query) ||
      empNumber.toLowerCase().includes(query) ||
      site.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={mrf.title}
        description={`MRF Reference #${mrf.id} • Client: ${mrf.client?.name || "Client Account"}${readOnly ? " • Read-Only Oversight" : ""}`}
        breadcrumbs={
          readOnly
            ? [
                { label: "Administration", href: "/admin" },
                { label: "Notifications", href: baseBackPath },
                { label: mrf.title },
              ]
            : [
                { label: "TA Portal", href: "/ta" },
                { label: "Manpower Requests", href: baseBackPath },
                { label: mrf.title },
              ]
        }
        actions={
          <div className="flex items-center gap-2">
            <Link to={baseBackPath}>
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                {readOnly ? "Back to Notifications" : "Back to Requests"}
              </Button>
            </Link>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Edit className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditStatus(mrf.status);
                  setEditStatusModalOpen(true);
                }}
              >
                Update Status
              </Button>
            )}
          </div>
        }
      />

      {/* Fulfillment Callout Banner */}
      {isFulfilled && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-900 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-900">
            <strong className="font-bold">Order 100% Fulfilled.</strong> Target headcount reached. Linked job postings have been closed.
          </p>
        </div>
      )}

      {/* Metrics & Overview Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-500 uppercase">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Manpower Fulfillment</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {deployedCount} / <span>{mrf.headcount}</span>{" "}
            <span className="text-xs text-slate-400 font-normal">pax</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                fulfillmentRate >= 100
                  ? "bg-emerald-600"
                  : fulfillmentRate > 0
                  ? "bg-teal-600"
                  : "bg-slate-300"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, fulfillmentRate))}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-2 font-mono">
            {fulfillmentRate}% • {remainingCount} slots remaining
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-mono font-bold text-teal-700 uppercase">
            Order Status
          </div>
          <div className="text-2xl font-bold font-mono text-teal-900 mt-1 uppercase">
            {mrf.status}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Priority: {mrf.priority}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-mono font-bold text-blue-700 uppercase">
            Target Fill Date
          </div>
          <div className="text-lg font-bold font-mono text-blue-900 mt-1">
            {mrf.targetFillDate ? formatDate(mrf.targetFillDate) : "ASAP"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Created {formatDate(mrf.createdAt)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-mono font-bold text-emerald-700 uppercase">
            Client Account Information
          </div>
          <div className="text-sm font-bold text-slate-900 mt-1 truncate" title={mrf.client?.name || "Client Account"}>
            {mrf.client?.name || "N/A"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {mrf.client?.industry || "Commercial"}
          </div>
          <div className="text-[11px] font-mono text-teal-700 mt-0.5 truncate">
            {mrf.client?.contactEmail || "No contact email"}
          </div>
        </div>
      </div>

      {/* Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "deployments"}
          onClick={() => setActiveTab("deployments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "deployments"
              ? "border-teal-600 text-teal-800 bg-teal-50/60 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg"
          }`}
        >
          <Users className="w-4 h-4 text-teal-600" />
          <span>Deployed Personnel</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-700">
            {deployments.length} / {mrf.headcount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "jobs"}
          onClick={() => setActiveTab("jobs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "jobs"
              ? "border-teal-600 text-teal-800 bg-teal-50/60 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg"
          }`}
        >
          <Briefcase className="w-4 h-4 text-teal-600" />
          <span>Linked Job Openings</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-700">
            {linkedJobs.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "specifications"}
          onClick={() => setActiveTab("specifications")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "specifications"
              ? "border-teal-600 text-teal-800 bg-teal-50/60 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg"
          }`}
        >
          <FileText className="w-4 h-4 text-teal-600" />
          <span>Order Specifications</span>
          {templates.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-700">
              {templates.length} reqs
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels with DOM Retention */}
      <div className="space-y-6">
        {/* Tab 1: Deployed Personnel */}
        <div
          role="tabpanel"
          aria-label="Deployed Personnel"
          className={activeTab === "deployments" ? "block space-y-4" : "hidden"}
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Deployed Personnel ({deployments.length} / {mrf.headcount})
                </h3>
                <p className="text-xs text-slate-500">
                  {readOnly
                    ? "Active workers and site assignments fulfilling this order (Read-Only Audit)"
                    : "Active workers and site assignments fulfilling this order"}
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={personnelSearch}
                  onChange={(e) => setPersonnelSearch(e.target.value)}
                  placeholder="Search deployed personnel by name, ID, or site..."
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 bg-white"
                />
                {personnelSearch && (
                  <button
                    type="button"
                    onClick={() => setPersonnelSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {deployments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No personnel deployed yet. Candidates become visible here once their deployment record is finalized.
              </div>
            ) : filteredDeployments.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  No deployed personnel matching &quot;{personnelSearch}&quot;.
                </p>
                <Button variant="outline" size="sm" onClick={() => setPersonnelSearch("")}>
                  Clear Search
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Worker Name</th>
                      <th className="px-4 py-3 font-semibold">Employee ID</th>
                      <th className="px-4 py-3 font-semibold">Deployment Site</th>
                      <th className="px-4 py-3 font-semibold">Contract Period</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDeployments.map((d: any) => {
                      const profile =
                        d.employee?.user?.applicantProfile || d.application?.user?.applicantProfile;
                      const workerName = profile
                        ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Unnamed Worker"
                        : d.employee?.user?.email || "Unnamed Worker";

                      const contractPeriod = `${d.contractStart ? formatDate(d.contractStart) : "N/A"} - ${
                        d.contractEnd ? formatDate(d.contractEnd) : "Ongoing"
                      }`;

                      return (
                        <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {d.employee?.id && !readOnly ? (
                              <Link
                                to="/ta/employees/$employeeId"
                                params={{ employeeId: String(d.employee.id) }}
                                className="font-semibold text-slate-900 hover:text-teal-700 hover:underline"
                              >
                                {workerName}
                              </Link>
                            ) : (
                              <span className="font-semibold">{workerName}</span>
                            )}
                            {profile?.mobileNumber && (
                              <div className="text-[11px] text-slate-400 font-mono">
                                {profile.mobileNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {d.employee?.employeeNumber || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium">
                            {d.site || mrf.location || "Main Site"}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                            {contractPeriod}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={d.status} type="deployment" size="sm" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Tab 2: Linked Job Openings */}
        <div
          role="tabpanel"
          aria-label="Linked Job Openings"
          className={activeTab === "jobs" ? "block space-y-4" : "hidden"}
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Linked Job Requisitions ({linkedJobs.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Openings actively collecting candidate applications for this MRF
                </p>
              </div>
              {!readOnly && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setLinkJobModalOpen(true)}
                >
                  Link Requisition
                </Button>
              )}
            </div>

            {linkedJobs.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  {readOnly
                    ? "No job postings linked to this MRF yet."
                    : "No job postings linked to this MRF yet. Link a requisition to connect applicant traffic."}
                </p>
                {!readOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setLinkJobModalOpen(true)}
                  >
                    Link First Requisition
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {linkedJobs.map((job: any) => (
                  <div key={job.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{job.title}</span>
                        {job.isEvergreen && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            Keep Open After Fill
                          </span>
                        )}
                        <StatusBadge status={job.status} type="raw" size="sm" />
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Requisition #{job.id} • {job.location || "Philippines"}
                      </div>
                    </div>
                    {readOnly ? (
                      <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono font-medium text-slate-700">
                        Requisition #{job.id}
                      </span>
                    ) : (
                      <Link to="/ta/jobs/$jobId" params={{ jobId: String(job.id) }}>
                        <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                          View Funnel
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab 3: Order Specifications */}
        <div
          role="tabpanel"
          aria-label="Order Specifications"
          className={activeTab === "specifications" ? "block space-y-4" : "hidden"}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column (lg:col-span-2): Order Description & Competencies */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
                  Order Description & Client Criteria
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {mrf.description || "No additional description provided for this order."}
                </p>

                {mrf.requiredSkills && (
                  <div className="pt-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                      Required Competencies:
                    </span>
                    <p className="text-xs text-slate-800 font-semibold mt-0.5">{mrf.requiredSkills}</p>
                  </div>
                )}

                {mrf.requiredExperience && (
                  <div className="pt-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                      Required Experience:
                    </span>
                    <p className="text-xs text-slate-800 font-semibold mt-0.5">{mrf.requiredExperience}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Client Account Information & Compliance Templates */}
            <div className="space-y-6">
              {/* Client Account Box */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
                  Client Account Information
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="font-bold text-slate-900">{mrf.client?.name || "Client Account"}</div>
                  <div className="text-slate-600">Industry: {mrf.client?.industry || "Commercial"}</div>
                  <div className="text-slate-600 font-mono">Contact: {mrf.client?.contactEmail || "N/A"}</div>
                </div>
              </div>

              {/* Compliance Requirement Templates */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 uppercase">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span>Requirements Templates</span>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTemplateModalOpen(true)}
                      className="text-teal-700"
                    >
                      + Add
                    </Button>
                  )}
                </div>

                {templates.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {readOnly
                      ? "No compliance document templates assigned to this MRF."
                      : "No templates assigned. Add required document types (NBI, SSS, Medical)."}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {templates.map((tpl: any) => (
                      <div key={tpl.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-800">{tpl.documentLabel}</span>
                        {!readOnly ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTemplateTarget({ id: tpl.id, label: tpl.documentLabel })}
                            className="text-rose-600 hover:text-rose-800 focus:outline-none p-1"
                            title="Remove template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                            {tpl.isRequired ? "Mandatory" : "Optional"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Dialogs (Active actions only) */}
      {!readOnly && (
        <>
          {/* Link Job Modal */}
          <Dialog
            open={linkJobModalOpen}
            onClose={() => setLinkJobModalOpen(false)}
            title="Link Job Requisition"
            description="Attach an active job posting to this Manpower Request"
            overflowVisible
            bodyClassName="min-h-[290px] flex flex-col justify-between"
          >
            <div className="space-y-4">
              <ComboBox
                label="Select Job Requisition"
                placeholder="Search active job requisitions..."
                value={selectedJobId ? String(selectedJobId) : ""}
                onChange={(val) => setSelectedJobId(Number(val) || 0)}
                options={jobs.map((j) => ({
                  value: String(j.id),
                  label: j.title,
                  subtitle: `Requisition #${j.id} • ${j.location || "Philippines"}`,
                  badge: j.status,
                }))}
                emptyText="No matching job requisitions found"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-auto">
              <Button variant="outline" size="sm" onClick={() => setLinkJobModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedJobId}
                loading={linkJobMutation.isPending}
                onClick={() => linkJobMutation.mutate(selectedJobId)}
              >
                Link Job
              </Button>
            </div>
          </Dialog>

          {/* Add Compliance Template Modal */}
          <Dialog
            open={templateModalOpen}
            onClose={() => setTemplateModalOpen(false)}
            title="Add Compliance Requirement Template"
            description="Specify clearance required for candidates under this MRF"
            overflowVisible
            bodyClassName="min-h-[290px] flex flex-col justify-between"
          >
            <div className="space-y-4">
              <ComboBox
                label="Document Template Label"
                placeholder="Search statutory clearance or type custom..."
                value={templateLabel}
                onChange={(val) => setTemplateLabel(val || "")}
                options={COMPLIANCE_201_PRESETS.map((p) => ({
                  value: p.label,
                  label: p.label,
                  subtitle: p.description,
                  badge: p.category,
                }))}
                allowCustom
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-auto">
              <Button variant="outline" size="sm" onClick={() => setTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!templateLabel.trim()}
                loading={addTemplateMutation.isPending}
                onClick={() =>
                  addTemplateMutation.mutate({
                    documentLabel: templateLabel,
                    isRequired: true,
                  })
                }
              >
                Add Template
              </Button>
            </div>
          </Dialog>

          {/* Update Status Modal */}
          <Dialog
            open={editStatusModalOpen}
            onClose={() => setEditStatusModalOpen(false)}
            title="Update MRF Status"
            description="Set current fulfillment lifecycle status"
          >
            <div className="space-y-4">
              <Select
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={[
                  { value: "OPEN", label: "OPEN" },
                  { value: "IN_PROGRESS", label: "IN PROGRESS" },
                  { value: "FILLED", label: "FILLED" },
                  { value: "ON_HOLD", label: "ON HOLD" },
                  { value: "CANCELLED", label: "CANCELLED" },
                ]}
              />
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setEditStatusModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={updateMRFMutation.isPending}
                  onClick={() => updateMRFMutation.mutate({ status: editStatus })}
                >
                  Save Status
                </Button>
              </div>
            </div>
          </Dialog>

          {/* Delete Template Confirm Dialog */}
          <ConfirmDialog
            open={Boolean(deleteTemplateTarget)}
            onClose={() => setDeleteTemplateTarget(null)}
            loading={removeTemplateMutation.isPending}
            onConfirm={() => {
              if (deleteTemplateTarget) {
                removeTemplateMutation.mutate(deleteTemplateTarget.id);
              }
            }}
            variant="danger"
            title="Remove Compliance Template"
            description={`Are you sure you want to remove '${deleteTemplateTarget?.label || "this template"}' from the MRF?`}
            confirmLabel="Remove Template"
          />
        </>
      )}
    </div>
  );
};

