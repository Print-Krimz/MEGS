import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { SERVER_SEARCH_DEBOUNCE_MS, normalizeServerSearch } from "../../lib/query-policies";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

type SortField = "candidate" | "position" | "scheduledAt" | "deadline";
type SortDirection = "asc" | "desc";

// Same wording as the interview outcome dialog on the application page.
const interviewOutcomeNextStep = (result: "PASS" | "FAIL" | "NO_SHOW", isFinalInterview: boolean) => {
  if (result === "PASS") {
    return isFinalInterview
      ? "Next: move the candidate to requirements."
      : "Next: send the candidate to the client, or skip to final interview.";
  }
  if (result === "FAIL") return "The candidate stays at this stage until you close the application.";
  return "The application will be closed as backed out and archived.";
};

export const InterviewsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("deadline");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [targetInterview, setTargetInterview] = useState<{
    id: number;
    applicationId: number;
    candidateName: string;
    isFinalInterview: boolean;
  } | null>(null);
  const [interviewResult, setInterviewResult] = useState<"PASS" | "FAIL" | "NO_SHOW">("PASS");
  const [resultNotes, setResultNotes] = useState("");

  const slaQuery = useQuery({
    queryKey: ["ta", "compliance", "interviews", "page", { page, pageSize, search: debouncedSearch, status: statusFilter, stage: stageFilter, position: positionFilter, sortField, sortDirection }],
    queryFn: ({ signal }) =>
      taApi.listInterviewCompliancePage({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        stage: stageFilter || undefined,
        position: positionFilter || undefined,
        sortField,
        sortDirection,
      }, { signal }),
    placeholderData: keepPreviousData,
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
      notify.success("Interview outcome saved", `The interview was marked as ${vars.result === "PASS" ? "passed" : vars.result === "FAIL" ? "not passed" : "no show"}. ${interviewOutcomeNextStep(vars.result, Boolean(targetInterview?.isFinalInterview))}`);
    },
    onError: (err: any) => {
      notify.error("Unable to save interview outcome", err);
    },
  });

  const slaData = slaQuery.data;
  const summary = slaData?.summary || { total: 0, breached: 0, warning: 0, healthy: 0 };
  const paginatedItems = slaData?.items ?? [];
  const totalItems = slaData?.total ?? 0;
  const totalPages = Math.max(1, slaData?.totalPages ?? 1);

  const positionOptions = (slaData?.positions ?? []).map((title) => ({ value: title, label: title }));

  // A refresh can leave the current page past the end (for example after outcomes are recorded).
  useEffect(() => {
    if (slaData && !slaQuery.isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [slaData, slaQuery.isPlaceholderData, page, totalPages]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "stage") {
      setStageFilter(value);
    } else if (key === "position") {
      setPositionFilter(value);
    }
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setStageFilter("");
    setPositionFilter("");
    setStatusFilter("ALL");
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getHeaderContent = () => {
    switch (statusFilter) {
      case "BREACHED":
        return {
          title: "Overdue interviews",
          description: "Applications exceeding the 7-day SLA deadline",
        };
      case "WARNING":
        return {
          title: "Interviews due soon",
          description: "Outcome needed within 48 hours",
        };
      case "HEALTHY":
        return {
          title: "On-track interviews",
          description: "Deadlines within target limits",
        };
      default:
        return {
          title: "Interviews needing attention",
          description:
            "Applications that need an interviewer response before the 7-day deadline",
        };
    }
  };

  const headerContent = getHeaderContent();

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <th scope="col" className="px-4 py-3 font-semibold select-none">
        <button
          type="button"
          onClick={() => handleSort(field)}
          className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 rounded"
          aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
        >
          <span>{label}</span>
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
          )}
        </button>
      </th>
    );
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
          aria-pressed={statusFilter === "ALL"}
          onClick={() => {
            setStatusFilter("ALL");
            setPage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
            statusFilter === "ALL"
              ? "border-slate-800 ring-2 ring-slate-800/20 bg-slate-50/60"
              : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/40 bg-white"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
          aria-pressed={statusFilter === "BREACHED"}
          onClick={() => {
            setStatusFilter("BREACHED");
            setPage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
            statusFilter === "BREACHED"
              ? "border-slate-800 ring-2 ring-slate-800/20 bg-slate-50/60"
              : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/40 bg-white"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
          aria-pressed={statusFilter === "WARNING"}
          onClick={() => {
            setStatusFilter("WARNING");
            setPage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
            statusFilter === "WARNING"
              ? "border-slate-800 ring-2 ring-slate-800/20 bg-slate-50/60"
              : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/40 bg-white"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Due within 48 hours
          </div>
          <div className="text-2xl font-bold font-mono text-amber-800 mt-1 tabular-nums">
            {summary.warning}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Due soon</span>
          </div>
        </button>

        <button
          type="button"
          aria-pressed={statusFilter === "HEALTHY"}
          onClick={() => {
            setStatusFilter("HEALTHY");
            setPage(1);
          }}
          className={`text-left rounded-xl border p-4 shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
            statusFilter === "HEALTHY"
              ? "border-slate-800 ring-2 ring-slate-800/20 bg-slate-50/60"
              : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/40 bg-white"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            On track
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800 mt-1 tabular-nums">
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
        filterValues={{
          stage: stageFilter,
          position: positionFilter,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        }}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "stage",
            label: "Interview Stage",
            placeholder: "All interview stages",
            options: [
              { value: "INITIAL_SCREENING", label: "Initial Screening" },
              { value: "FINAL_INTERVIEW", label: "Final Interview" },
            ],
          },
          {
            key: "position",
            label: "Target Position",
            placeholder: "All target positions",
            options: positionOptions,
          },
        ]}
      />

      {/* SLA Details Queue Table */}
      <div className="bg-white rounded-lg border border-[#D9E2EC] shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-[#D9E2EC] flex items-center justify-between bg-[#F7F9FC]">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-[#102A43] uppercase">{headerContent.title}</h3>
            <p className="text-xs text-[#627D98] mt-0.5 font-mono">{headerContent.description}</p>
          </div>
        </div>

        {summary.total === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
              title="All interviews are on track"
              description="There are no overdue or soon-due interview outcomes."
            />
          </div>
        ) : totalItems === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No matching interviews"
              description="No interviews match your current search, stage, or position filter criteria."
              action={
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-200">
              {paginatedItems.map((row) => (
                <article key={row.interviewId} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-slate-950 break-words">{row.candidateName}</h4>
                        <span
                          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.currentStage === "FINAL_INTERVIEW"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {row.currentStage === "FINAL_INTERVIEW" ? "Final Interview" : "Initial Screening"}
                        </span>
                      </div>
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
                        setTargetInterview({ id: row.interviewId, applicationId: row.applicationId, candidateName: row.candidateName, isFinalInterview: row.currentStage === "FINAL_INTERVIEW" });
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
                    {renderSortHeader("candidate", "Candidate")}
                    <th scope="col" className="px-4 py-3 font-semibold">Interview Type</th>
                    {renderSortHeader("position", "Target Position")}
                    {renderSortHeader("scheduledAt", "Scheduled Date")}
                    {renderSortHeader("deadline", "Deadline")}
                    <th scope="col" className="px-4 py-3 font-semibold text-center">Status</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {paginatedItems.map((row) => (
                    <tr key={row.interviewId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-sans font-bold text-slate-900">
                        {row.candidateName}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.currentStage === "FINAL_INTERVIEW"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {row.currentStage === "FINAL_INTERVIEW" ? "Final Interview" : "Initial Screening"}
                        </span>
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
                                isFinalInterview: row.currentStage === "FINAL_INTERVIEW",
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
                            <Button variant="ghost" size="sm" aria-label={`View application for ${row.candidateName}`}>
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
                totalItems={totalItems}
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
        description={`Record the ${targetInterview?.isFinalInterview ? "final interview" : "screening"} result for ${targetInterview?.candidateName}`}
      >
        <div className="space-y-4">
          <Select
            label="Outcome"
            value={interviewResult}
            onChange={(e) => setInterviewResult(e.target.value as any)}
            options={[
              { value: "PASS", label: "Passed" },
              { value: "FAIL", label: "Not passed" },
              { value: "NO_SHOW", label: "No show" },
            ]}
          />
          <p className="text-xs text-slate-500">{interviewOutcomeNextStep(interviewResult, Boolean(targetInterview?.isFinalInterview))}</p>
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
