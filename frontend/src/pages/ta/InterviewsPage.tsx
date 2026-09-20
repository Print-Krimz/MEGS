import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import { formatInterviewDeadlineStatus, TA_COPY } from "../../lib/ta-copy";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { notify } from "../../lib/feedback";

export const InterviewsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [targetInterview, setTargetInterview] = useState<{
    id: number;
    applicationId: number;
    candidateName: string;
  } | null>(null);
  const [interviewResult, setInterviewResult] = useState<"PASS" | "FAIL" | "NO_SHOW">("PASS");
  const [resultNotes, setResultNotes] = useState("");

  const slaQuery = useQuery({
    queryKey: ["ta", "compliance", "interviews"],
    queryFn: taApi.checkInterviewCompliance,
  });

  const updateResultMutation = useMutation({
    mutationFn: ({
      applicationId,
      interviewId,
      result,
      notes,
    }: {
      applicationId: number;
      interviewId: number;
      result: "PASS" | "FAIL" | "NO_SHOW";
      notes?: string;
    }) =>
      taApi.updateInterviewStatus(applicationId, interviewId, {
        result,
        conductedAt: new Date().toISOString(),
        notes,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "compliance", "interviews"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(vars.applicationId)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      setResultModalOpen(false);
      setTargetInterview(null);
      setResultNotes("");
      notify.success("Interview outcome saved", `The interview was marked as ${vars.result === "PASS" ? "passed" : vars.result === "FAIL" ? "not passed" : "no show"}.`);
    },
    onError: (err: any) => {
      notify.error("Unable to save interview outcome", err);
    },
  });

  const slaData = slaQuery.data;
  const summary = slaData?.summary || { total: 0, breached: 0, warning: 0, healthy: 0 };
  const items = slaData?.details || [];

  const filteredItems = items.filter((row) => {
    const matchesStatus =
      statusFilter === "ALL" ? true : row.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      row.candidateName.toLowerCase().includes(q) ||
      row.jobTitle.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPage(1);
  };

  if (slaQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Interview schedule" description="Loading interview deadlines..." />
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  if (slaQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Interview schedule" description="Interview deadlines" />
        <ErrorState error={slaQuery.error} onRetry={() => slaQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview schedule"
        description="Track interview deadlines and record interview outcomes."
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.interviews },
        ]}
      />

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("ALL");
            setPage(1);
          }}
          className={`text-left bg-white rounded-xl border p-4 shadow-xs transition-all ${
            statusFilter === "ALL" ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="text-[11px] font-mono font-bold text-slate-500 uppercase">
            Scheduled interviews
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {summary.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>All upcoming</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("BREACHED");
            setPage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs bg-rose-50/20 transition-all ${
            statusFilter === "BREACHED" ? "border-rose-700 ring-1 ring-rose-700" : "border-rose-200 hover:border-rose-300"
          }`}
        >
          <div className="text-[11px] font-mono font-bold text-rose-700 uppercase">
            Overdue interviews
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1 tabular-nums">
            {summary.breached}
          </div>
          <div className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-mono">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Immediate action</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("WARNING");
            setPage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs bg-amber-50/20 transition-all ${
            statusFilter === "WARNING" ? "border-amber-700 ring-1 ring-amber-700" : "border-amber-200 hover:border-amber-300"
          }`}
        >
          <div className="text-[11px] font-mono font-bold text-amber-800 uppercase">
            Due within 48 hours
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-1 tabular-nums">
            {summary.warning}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Due soon</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("HEALTHY");
            setPage(1);
          }}
          className={`text-left bg-white rounded-xl border p-4 shadow-xs transition-all ${
            statusFilter === "HEALTHY" ? "border-emerald-700 ring-1 ring-emerald-700" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="text-[11px] font-mono font-bold text-emerald-700 uppercase">
            On track
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-1 tabular-nums">
            {summary.healthy}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Within the 7-day deadline</span>
          </div>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <SearchFilters
        searchPlaceholder="Search candidate name or position title..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        onReset={handleReset}
      />

      {/* SLA Details Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900">Interviews needing attention</h3>
            <p className="text-xs text-slate-500">
              Applications that need an interviewer response before the 7-day deadline
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
              title="All interviews are on track"
              description="There are no overdue or soon-due interview outcomes."
            />
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-200">
              {paginatedItems.map((row) => (
                <article key={row.interviewId} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-slate-950 break-words">{row.candidateName}</h4>
                      <p className="mt-0.5 text-sm text-slate-600 break-words">{row.jobTitle}</p>
                    </div>
                    <span className={`shrink-0 rounded border px-2 py-1 text-xs font-semibold ${
                      row.status === "BREACHED"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : row.status === "WARNING"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}>
                      {formatInterviewDeadlineStatus(row.status)}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-slate-500">Scheduled</dt><dd className="mt-0.5 text-slate-800">{formatDateTime(row.scheduledAt)}</dd></div>
                    <div><dt className="text-slate-500">Deadline</dt><dd className="mt-0.5 text-slate-800">{formatDate(row.deadline)}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setTargetInterview({ id: row.interviewId, applicationId: row.applicationId, candidateName: row.candidateName });
                        setResultModalOpen(true);
                      }}
                    >
                      Record outcome
                    </Button>
                    <Link to="/ta/applications/$applicationId" params={{ applicationId: String(row.applicationId) }}>
                      <Button variant="outline" size="sm">View application</Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Candidate</th>
                    <th className="px-4 py-3 font-semibold">Target Position</th>
                    <th className="px-4 py-3 font-semibold">Scheduled Date</th>
                    <th className="px-4 py-3 font-semibold">Deadline</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {paginatedItems.map((row) => (
                    <tr key={row.interviewId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-sans font-bold text-slate-900">
                        {row.candidateName}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-700 font-medium">
                        {row.jobTitle}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(row.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(row.deadline)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === "BREACHED"
                              ? "bg-rose-50 text-rose-800 border border-rose-200"
                              : row.status === "WARNING"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {formatInterviewDeadlineStatus(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTargetInterview({
                                id: row.interviewId,
                                applicationId: row.applicationId,
                                candidateName: row.candidateName,
                              });
                              setResultModalOpen(true);
                            }}
                          >
                            Record Outcome
                          </Button>
                          <Link
                            to="/ta/applications/$applicationId"
                            params={{ applicationId: String(row.applicationId) }}
                          >
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredItems.length}
                pageSize={pageSize}
                onPageChange={setPage}
                itemLabel="interviews"
              />
            </div>
          </>
        )}
      </div>

      {/* Record Outcome Modal */}
      <Dialog
        open={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        title="Record interview outcome"
        description={`Record screening result for ${targetInterview?.candidateName}`}
      >
        <div className="space-y-4">
          <Select
            label="Outcome"
            value={interviewResult}
            onChange={(e) => setInterviewResult(e.target.value as any)}
            options={[
              { value: "PASS", label: "Passed — move to the next stage" },
              { value: "FAIL", label: "Not passed — do not advance" },
              { value: "NO_SHOW", label: "No show — candidate missed the interview" },
            ]}
          />
          <Textarea
            label="Interview notes"
            placeholder="Record strengths, concerns, and recommended next steps..."
            value={resultNotes}
            onChange={(e) => setResultNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setResultModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateResultMutation.isPending}
              onClick={() => {
                if (targetInterview) {
                  updateResultMutation.mutate({
                    applicationId: targetInterview.applicationId,
                    interviewId: targetInterview.id,
                    result: interviewResult,
                    notes: resultNotes || undefined,
                  });
                }
              }}
            >
              Save Evaluation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
