import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { Button, Dialog, Input, Select } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ShieldCheck,
  Edit,
} from "lucide-react";

export const MRFDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { mrfId } = useParams({ strict: false }) as { mrfId: string };

  const [linkJobModalOpen, setLinkJobModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number>(0);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateLabel, setTemplateLabel] = useState("");

  const [editStatusModalOpen, setEditStatusModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<any>("OPEN");

  const mrfQuery = useQuery({
    queryKey: ["ta", "mrf", mrfId],
    queryFn: () => taApi.getMRFDetails(mrfId),
    enabled: Boolean(mrfId),
  });

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "all"],
    queryFn: () => taApi.listJobs(),
  });

  // Mutations
  const linkJobMutation = useMutation({
    mutationFn: (jobId: number) => taApi.linkJobToMRF(mrfId, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      setLinkJobModalOpen(false);
      setSelectedJobId(0);
    },
  });

  const addTemplateMutation = useMutation({
    mutationFn: (data: { documentLabel: string; isRequired?: boolean }) =>
      taApi.addMRFComplianceTemplate(mrfId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      setTemplateModalOpen(false);
      setTemplateLabel("");
    },
  });

  const removeTemplateMutation = useMutation({
    mutationFn: (templateId: number) => taApi.removeMRFComplianceTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
    },
  });

  const updateMRFMutation = useMutation({
    mutationFn: (data: any) => taApi.updateMRF(mrfId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      setEditStatusModalOpen(false);
    },
  });

  if (mrfQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Manpower Request" description="Loading MRF order..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (mrfQuery.isError || !mrfQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Manpower Request" description="MRF details" />
        <ErrorState error={mrfQuery.error} onRetry={() => mrfQuery.refetch()} />
      </div>
    );
  }

  const mrf = mrfQuery.data;
  const jobs = jobsQuery.data || [];
  const linkedJobs = mrf.jobPostings || [];
  const templates = mrf.complianceTemplates || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={mrf.title}
        description={`MRF Reference #${mrf.id} • Client: ${mrf.client?.name || "Client Account"}`}
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Manpower Requests", href: "/ta/mrfs" },
          { label: mrf.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/mrfs">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Requests
              </Button>
            </Link>
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
          </div>
        }
      />

      {/* Metrics & Overview Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-mono font-bold text-slate-500 uppercase">
            Required Headcount
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {mrf.headcount} <span className="text-xs text-slate-400 font-normal">pax</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {mrf.location || "Nationwide"}
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
            Linked Requisitions
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
          </div>

          {/* Linked Job Requisitions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Linked Job Requisitions ({linkedJobs.length})</h3>
                <p className="text-xs text-slate-500">
                  Openings actively collecting candidate applications for this MRF
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setLinkJobModalOpen(true)}
              >
                Link Requisition
              </Button>
            </div>

            {linkedJobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No job postings linked to this MRF yet. Link a requisition to connect applicant traffic.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {linkedJobs.map((job) => (
                  <div key={job.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 text-xs">{job.title}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {job.location || "Philippines"} • Status: {job.status}
                      </div>
                    </div>
                    <Link to="/ta/jobs/$jobId" params={{ jobId: String(job.id) }}>
                      <Button variant="outline" size="sm">
                        View Requisition
                      </Button>
                    </Link>
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
            <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
              Client Account Information
            </h3>
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-900">{mrf.client?.name}</div>
              <div className="text-slate-600">Industry: {mrf.client?.industry || "Commercial"}</div>
              <div className="text-slate-600 font-mono">Contact: {mrf.client?.contactEmail || "N/A"}</div>
            </div>
          </div>

          {/* Compliance Requirement Templates */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 uppercase">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>201 Compliance Templates</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTemplateModalOpen(true)}
                className="text-teal-700"
              >
                + Add
              </Button>
            </div>

            {templates.length === 0 ? (
              <p className="text-xs text-slate-400">
                No templates assigned. Add required document types (NBI, SSS, Medical).
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800">{tpl.documentLabel}</span>
                    <button
                      type="button"
                      onClick={() => removeTemplateMutation.mutate(tpl.id)}
                      className="text-rose-600 hover:text-rose-800 focus:outline-none p-1"
                      title="Remove template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Link Job Modal */}
      <Dialog
        open={linkJobModalOpen}
        onClose={() => setLinkJobModalOpen(false)}
        title="Link Job Requisition"
        description="Attach an active job posting to this Manpower Request"
      >
        <div className="space-y-4">
          <Select
            label="Select Job Requisition"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(Number(e.target.value))}
            options={[
              { value: 0, label: "Select job posting..." },
              ...jobs.map((j) => ({ value: j.id, label: `${j.title} (#${j.id})` })),
            ]}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
        </div>
      </Dialog>

      {/* Add Compliance Template Modal */}
      <Dialog
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Add Compliance Requirement Template"
        description="Specify clearance required for candidates under this MRF"
      >
        <div className="space-y-4">
          <Input
            label="Document Template Label"
            placeholder="e.g. NBI Clearance, 5-Panel Drug Test, SSS Static"
            value={templateLabel}
            onChange={(e) => setTemplateLabel(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
    </div>
  );
};
