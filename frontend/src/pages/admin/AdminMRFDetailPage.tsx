import React from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import {
  ArrowLeft,
  ShieldCheck,
  Building2,
  Users,
  Calendar,
  Briefcase,
  Layers,
} from "lucide-react";

export const AdminMRFDetailPage: React.FC = () => {
  const { mrfId } = useParams({ strict: false }) as { mrfId: string };

  const mrfQuery = useQuery({
    queryKey: ["admin", "mrf", mrfId],
    queryFn: () => adminApi.getMRFDetails(mrfId),
    enabled: Boolean(mrfId),
  });

  if (mrfQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Manpower Request" description="Loading request details..." />
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
          breadcrumbs={[
            { label: "Administration", href: "/admin" },
            { label: "Notifications", href: "/admin/notifications" },
            { label: "Record Not Found" },
          ]}
          actions={
            <Link to="/admin/notifications">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Notifications
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
              <Link to="/admin/notifications">
                <Button variant="primary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                  Return to Notifications
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
  const linkedJobs = mrf.jobPostings || [];
  const templates = mrf.complianceTemplates || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={mrf.title}
        description={`MRF Reference #${mrf.id} • Client: ${mrf.client?.name || "Client Account"} (Read-Only Oversight)`}
        breadcrumbs={[
          { label: "Administration", href: "/admin" },
          { label: "Notifications", href: "/admin/notifications" },
          { label: mrf.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/notifications">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Notifications
              </Button>
            </Link>
          </div>
        }
      />

      {/* Metrics & Overview Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-500 uppercase">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Required Headcount</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {mrf.headcount} <span className="text-xs text-slate-400 font-normal">pax</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {mrf.location || "Nationwide"}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-teal-700 uppercase">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <span>Order Status</span>
          </div>
          <div className="text-2xl font-bold font-mono text-teal-900 mt-1 uppercase">
            {mrf.status}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Priority: {mrf.priority || "Standard"}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-blue-700 uppercase">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Target Fill Date</span>
          </div>
          <div className="text-lg font-bold font-mono text-blue-900 mt-1">
            {mrf.targetFillDate ? formatDate(mrf.targetFillDate) : "ASAP"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Created {formatDate(mrf.createdAt)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-700 uppercase">
            <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
            <span>Linked Requisitions</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-1 tabular-nums">
            {linkedJobs.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Active candidate funnels
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Linked Requisitions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Requisition Description */}
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

          {/* Linked Job Requisitions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Linked Job Requisitions ({linkedJobs.length})</h3>
              <p className="text-xs text-slate-500">
                Openings actively collecting candidate applications for this MRF
              </p>
            </div>

            {linkedJobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No job postings linked to this MRF yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {linkedJobs.map((job: any) => (
                  <div key={job.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 text-xs">{job.title}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {job.location || "Philippines"} • Status: {job.status}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono font-medium text-slate-700">
                      Requisition #{job.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Client Overview & Compliance Template */}
        <div className="space-y-6">
          {/* Client Account Box */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 uppercase border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>Client Account Information</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-900">{mrf.client?.name || "Client Account"}</div>
              <div className="text-slate-600">Industry: {mrf.client?.industry || "Commercial"}</div>
              <div className="text-slate-600 font-mono">Contact: {mrf.client?.contactEmail || "N/A"}</div>
            </div>
          </div>

          {/* Compliance Requirement Templates */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 uppercase border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Requirements Templates</span>
            </div>

            {templates.length === 0 ? (
              <p className="text-xs text-slate-400">
                No compliance document templates assigned to this MRF.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {templates.map((tpl: any) => (
                  <div key={tpl.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800">{tpl.documentLabel}</span>
                    <span className="text-[10px] font-mono text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                      {tpl.isRequired ? "Mandatory" : "Optional"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
