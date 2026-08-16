import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  ScoreBadge,
  SearchFilters,
  Pagination,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate, getApplicationStatusMeta } from "../../lib/utils";
import {
  ApplicationStatus,
  PIPELINE_FILTER_STAGES,
  ALLOWED_STAGE_TRANSITIONS,
} from "../../lib/types/enums";
import {
  Users,
  Eye,
  Archive,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

export const ApplicationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);

  // Modal states for status update and archive
  const [statusModalApp, setStatusModalApp] = useState<{ id: number; currentStatus: ApplicationStatus; name: string } | null>(null);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>(ApplicationStatus.INITIAL_SCREENING);
  const [statusReason, setStatusReason] = useState("");
  const [stageError, setStageError] = useState<string | null>(null);

  const [archiveModalApp, setArchiveModalApp] = useState<{ id: number; name: string; isArchived: boolean } | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const applicationsQuery = useQuery({
    queryKey: ["ta", "applications", { page, pageSize, search, filterValues, showArchived }],
    queryFn: () =>
      taApi.listApplications({
        page,
        limit: pageSize,
        search: search || undefined,
        status: (filterValues.status as ApplicationStatus) || undefined,
        jobId: filterValues.jobId ? Number(filterValues.jobId) : undefined,
        isArchived: showArchived,
      }),
  });

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "dropdown"],
    queryFn: () => taApi.listJobs(),
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: number; status: ApplicationStatus; reason?: string }) =>
      taApi.updateApplicationStatus(id, { status, reason }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      setStatusModalApp(null);
      setStatusReason("");
      setStageError(null);
      setFeedback({
        type: "success",
        message: `Application moved to ${getApplicationStatusMeta(vars.status).label}.`,
      });
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to update pipeline stage.";
      setStageError(msg);
      setFeedback({ type: "error", message: msg });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      taApi.archiveApplication(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      setArchiveModalApp(null);
      setArchiveReason("");
      setFeedback({ type: "success", message: "Application archived successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to archive application: " + err.message });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      taApi.restoreApplication(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      setArchiveModalApp(null);
      setArchiveReason("");
      setFeedback({ type: "success", message: "Application restored to pipeline." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to restore application: " + err.message });
    },
  });

  const queryData = applicationsQuery.data;
  const applications = Array.isArray(queryData) ? queryData : queryData?.data || [];
  const totalItems = Array.isArray(queryData) ? queryData.length : queryData?.total || 0;
  const totalPages = Array.isArray(queryData)
    ? Math.max(1, Math.ceil(queryData.length / pageSize))
    : queryData?.totalPages || 1;
  const jobs = jobsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Applications Pipeline"
        description="Track candidate applications, match evaluations, and recruitment pipeline stages"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Applications" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={showArchived ? "primary" : "outline"}
              size="sm"
              leftIcon={<Archive className="w-3.5 h-3.5" />}
              onClick={() => {
                setShowArchived(!showArchived);
                setPage(1);
              }}
            >
              {showArchived ? "Viewing Archived" : "View Archived"}
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <SearchFilters
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        filterValues={filterValues}
        onFilterChange={(k, v) => {
          setFilterValues((prev) => ({ ...prev, [k]: v }));
          setPage(1);
        }}
        onReset={() => {
          setSearch("");
          setFilterValues({});
          setPage(1);
        }}
        filters={[
          {
            key: "status",
            label: "Pipeline Stage",
            placeholder: "All Pipeline Stages",
            options: PIPELINE_FILTER_STAGES.map((s) => ({
              value: s,
              label: getApplicationStatusMeta(s).label,
            })),
          },
          {
            key: "jobId",
            label: "Job Requisition",
            placeholder: "All Job Requisitions",
            options: jobs.map((j) => ({
              value: String(j.id),
              label: j.title,
            })),
          },
        ]}
      />

      {/* Table Section */}
      {applicationsQuery.isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : applicationsQuery.isError ? (
        <ErrorState
          error={applicationsQuery.error}
          onRetry={() => applicationsQuery.refetch()}
        />
      ) : applications.length === 0 ? (
        <div className="bg-white border border-slate-300 p-6">
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title={showArchived ? "No archived applications" : "No candidates found in pipeline"}
            description={
              search || Object.keys(filterValues).length > 0
                ? "No applications matched your search filters. Try clearing filters to see all records."
                : "Candidate applications submitted through the applicant portal will appear here."
            }
            action={
              (search || Object.keys(filterValues).length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setFilterValues({});
                  }}
                >
                  Reset All Filters
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Candidate / Applicant</th>
                  <th className="px-3.5 py-2.5 font-bold">Target Position</th>
                  <th className="px-3.5 py-2.5 font-bold">Current Stage</th>
                  <th className="px-3.5 py-2.5 font-bold text-center">Match Score</th>
                  <th className="px-3.5 py-2.5 font-bold">Submission Date</th>
                  <th className="px-3.5 py-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {applications.map((app) => {
                  const p = app.user?.applicantProfile;
                  const candidateName = p
                    ? `${p.firstName} ${p.lastName}`
                    : app.user?.email || "Candidate";

                  return (
                    <tr key={app.id} className="hover:bg-slate-100/70 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-slate-950">{candidateName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {app.user?.email} {p?.mobileNumber ? `• ${p.mobileNumber}` : ""}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {app.jobPosting?.title || "Requisition"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {app.jobPosting?.location || "Philippines"}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <ScoreBadge
                          score={app.candidateFitScore ?? app.candidateScores?.[0]?.finalFitScore ?? app.aiScore}
                          size="sm"
                        />
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 text-[11px]">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to="/ta/applications/$applicationId"
                            params={{ applicationId: String(app.id) }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              View Details
                            </Button>
                          </Link>

                          {!app.isArchived ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const allowed = ALLOWED_STAGE_TRANSITIONS[app.status] || [];
                                  setStatusModalApp({
                                    id: app.id,
                                    currentStatus: app.status,
                                    name: candidateName,
                                  });
                                  setNewStatus(allowed.length > 0 ? allowed[0] : app.status);
                                  setStageError(null);
                                }}
                                title="Update Stage"
                              >
                                Stage
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setArchiveModalApp({
                                    id: app.id,
                                    name: candidateName,
                                    isArchived: false,
                                  })
                                }
                                title="Archive Application"
                                className="text-slate-400 hover:text-slate-700"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                              onClick={() =>
                                setArchiveModalApp({
                                    id: app.id,
                                    name: candidateName,
                                    isArchived: true,
                                  })
                              }
                              title="Restore Application"
                            >
                              Restore
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 border-t border-slate-300 bg-slate-50">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Update Pipeline Stage Modal */}
      <Dialog
        open={Boolean(statusModalApp)}
        onClose={() => {
          setStatusModalApp(null);
          setStageError(null);
        }}
        title="Update Recruitment Stage"
        description={`Advance or change pipeline stage for ${statusModalApp?.name}`}
      >
        <div className="space-y-4">
          {statusModalApp && (ALLOWED_STAGE_TRANSITIONS[statusModalApp.currentStatus]?.length ?? 0) === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono">
              Candidate is in a terminal status ({statusModalApp.currentStatus}). No further stage transitions are permitted.
            </div>
          ) : (
            <Select
              label="Target Pipeline Stage"
              value={newStatus}
              onChange={(e) => {
                setNewStatus(e.target.value as ApplicationStatus);
                setStageError(null);
              }}
              options={(
                (statusModalApp && ALLOWED_STAGE_TRANSITIONS[statusModalApp.currentStatus]) ||
                PIPELINE_FILTER_STAGES
              ).map((s) => ({
                value: s,
                label: getApplicationStatusMeta(s).label,
              }))}
            />
          )}

          {newStatus === ApplicationStatus.HIRED && (
            <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 text-xs rounded space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Digital 201 Personnel Record Provisioning</span>
              </div>
              <p className="text-teal-800 leading-relaxed">
                Confirming will advance stage to <strong>Hired</strong> and auto-generate the candidate's Digital 201 Employee Record in Personnel.
              </p>
              {statusModalApp && (
                <Link
                  to="/ta/applications/$applicationId"
                  params={{ applicationId: String(statusModalApp.id) }}
                >
                  <span className="text-teal-700 underline hover:text-teal-900 font-mono text-[11px] block mt-1">
                    Open candidate profile to specify custom employee number & department →
                  </span>
                </Link>
              )}
            </div>
          )}

          {newStatus === ApplicationStatus.DEPLOYED && (
            <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 text-xs rounded space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Workforce Site Deployment Setup</span>
              </div>
              <p className="text-teal-800 leading-relaxed">
                Confirming will advance stage to <strong>Deployed</strong> and create an active site deployment assignment.
              </p>
              {statusModalApp && (
                <Link
                  to="/ta/applications/$applicationId"
                  params={{ applicationId: String(statusModalApp.id) }}
                >
                  <span className="text-teal-700 underline hover:text-teal-900 font-mono text-[11px] block mt-1">
                    Open candidate profile to configure client account & site assignment →
                  </span>
                </Link>
              )}
            </div>
          )}

          {stageError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono rounded">
              {stageError}
            </div>
          )}

          <Textarea
            label="Recruiter Decision Rationale (Optional)"
            placeholder="e.g. Passed initial screening interview, endorsed to client manager"
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusModalApp(null);
                setStageError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateStatusMutation.isPending}
              onClick={() => {
                if (statusModalApp) {
                  updateStatusMutation.mutate({
                    id: statusModalApp.id,
                    status: newStatus,
                    reason: statusReason || undefined,
                  });
                }
              }}
            >
              Confirm Stage Update
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Archive / Restore Modal */}
      <Dialog
        open={Boolean(archiveModalApp)}
        onClose={() => setArchiveModalApp(null)}
        title={archiveModalApp?.isArchived ? "Restore Application" : "Archive Application"}
        description={`Record administrative reason to ${archiveModalApp?.isArchived ? "restore" : "archive"} ${archiveModalApp?.name}'s application`}
      >
        <div className="space-y-4">
          <Textarea
            label="Administrative Reason / Audit Note"
            placeholder={
              archiveModalApp?.isArchived
                ? "e.g. Candidate recontacted and available for consideration"
                : "e.g. Position filled, candidate unresponsive, or withdrew application"
            }
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            rows={3}
            required
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setArchiveModalApp(null)}>
              Cancel
            </Button>
            <Button
              variant={archiveModalApp?.isArchived ? "primary" : "danger"}
              size="sm"
              disabled={!archiveReason.trim()}
              loading={archiveMutation.isPending || restoreMutation.isPending}
              onClick={() => {
                if (!archiveModalApp) return;
                if (archiveModalApp.isArchived) {
                  restoreMutation.mutate({ id: archiveModalApp.id, reason: archiveReason });
                } else {
                  archiveMutation.mutate({ id: archiveModalApp.id, reason: archiveReason });
                }
              }}
            >
              {archiveModalApp?.isArchived ? "Restore Application" : "Archive Application"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
