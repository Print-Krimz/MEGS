import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, EmptyState, Pagination } from "../../components/common";
import { Button, ComboBox, Dialog, Input, Textarea } from "../../components/ui";
import {
  employeesApi,
  type RedeploymentJobSuggestion,
  type RedeploymentQueuePageResponse,
  type RedeploymentStage,
} from "../../lib/api/employees.api";
import { taApi } from "../../lib/api/ta.api";
import { formatDate, getApplicationStatusMeta } from "../../lib/utils";
import { notify } from "../../lib/feedback";
import { REFERENCE_QUERY_STALE_TIME_MS, SERVER_SEARCH_DEBOUNCE_MS, normalizeServerSearch } from "../../lib/query-policies";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

type Row = RedeploymentQueuePageResponse["items"][number];

const STAGES: Array<{ id: RedeploymentStage; label: string; hint: string }> = [
  { id: "NEEDS_PLACEMENT", label: "Needs placement", hint: "No application or invitation yet" },
  { id: "WAITING_FOR_REPLY", label: "Waiting for reply", hint: "Invited, worker has not answered" },
  { id: "IN_PROGRESS", label: "Already applying", hint: "In a hiring pipeline" },
];
const LONG_WAIT_DAYS = 14;
const PAGE_SIZE = 10;

const daysSince = (value: string | null) =>
  value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)) : null;

const WaitingCell: React.FC<{ since: string | null }> = ({ since }) => {
  const days = daysSince(since);
  if (since === null || days === null) return <span className="text-slate-500">Not recorded</span>;
  const long = days >= LONG_WAIT_DAYS;
  return (
    <div>
      <span
        className={`inline-flex rounded px-1.5 py-0.5 font-semibold ${
          long ? "border border-amber-300 bg-amber-50 text-amber-800" : "text-slate-800"
        }`}
        title={long ? `Waiting ${LONG_WAIT_DAYS}+ days. Prioritise this worker.` : undefined}
      >
        {days === 0 ? "Since today" : `Waiting ${days} day${days === 1 ? "" : "s"}`}
      </span>
      <div className="mt-1 text-slate-500">Since {formatDate(since)}</div>
    </div>
  );
};

const ROW_SUGGESTIONS = 3;

// Short tag for the job picker; the full reason is shown on the row.
const suggestionTag = (suggestion: RedeploymentJobSuggestion) =>
  suggestion.sameClient
    ? "Same client"
    : suggestion.matchPercent !== null
      ? `${suggestion.matchPercent}% match`
      : "Related experience";

const suggestionReason = (suggestion: RedeploymentJobSuggestion) =>
  suggestion.sameClient
    ? "Same client, skips screening"
    : suggestion.matchPercent !== null
      ? `${suggestion.matchPercent}% profile match`
      : "Matches previous role or skills";

const SuggestedJobs: React.FC<{
  data?: { total: number; suggestions: RedeploymentJobSuggestion[] };
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onPick: (jobId?: number) => void;
}> = ({ data, loading, failed, onRetry, onPick }) => {
  if (loading) return <span className="text-slate-400">Finding matching jobs…</span>;
  if (failed) {
    return (
      <span className="text-slate-500">
        Could not load suggestions.{" "}
        <button type="button" onClick={onRetry} className="font-medium text-teal-700 hover:underline">
          Retry
        </button>
      </span>
    );
  }
  if (!data || data.total === 0) return <span className="text-slate-500">No matching open jobs</span>;
  return (
    <div className="space-y-1.5">
      <div className="font-semibold text-slate-800">
        {data.total} job{data.total === 1 ? "" : "s"} fit this worker
      </div>
      {data.suggestions.slice(0, ROW_SUGGESTIONS).map((suggestion) => (
        <button
          key={suggestion.jobId}
          type="button"
          onClick={() => onPick(suggestion.jobId)}
          title={`Assign to ${suggestion.title}`}
          className={`block w-full max-w-[18rem] rounded border px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
            suggestion.sameClient
              ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="block truncate font-medium text-slate-900">{suggestion.title}</span>
          <span className="block truncate text-[11px] text-slate-500">
            {suggestion.clientName || "Client not set"} · {suggestionReason(suggestion)}
          </span>
        </button>
      ))}
      {data.total > ROW_SUGGESTIONS && (
        <button
          type="button"
          onClick={() => onPick()}
          className="text-[11px] font-medium text-teal-700 hover:underline"
        >
          See all {data.total} matches
        </button>
      )}
    </div>
  );
};

export const RedeploymentQueuePage: React.FC = () => {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<RedeploymentStage | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<Row | null>(null);
  const [targetJobId, setTargetJobId] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  const debouncedSearch = normalizeServerSearch(useDebouncedValue(search, SERVER_SEARCH_DEBOUNCE_MS));

  // The server filters, orders, and pages the queue, and returns stage counts for the whole queue.
  const query = useQuery({
    queryKey: ["ta", "redeployment-queue", "page", { page, stage: stageFilter, search: debouncedSearch }],
    queryFn: ({ signal }) =>
      employeesApi.getRedeploymentQueuePage({ page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, stage: stageFilter }, { signal }),
    placeholderData: keepPreviousData,
  });

  const pageItems = query.data?.items ?? [];
  const totalItems = query.data?.total ?? 0;
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);
  const visibleEmployeeIds = pageItems.map((row) => row.id);

  // Separate request: scores only the workers on this page, so it stays small as the queue grows.
  const suggestionsQuery = useQuery({
    queryKey: ["ta", "redeployment-suggestions", { employeeIds: visibleEmployeeIds.join(",") }],
    queryFn: ({ signal }) => employeesApi.getRedeploymentSuggestions(visibleEmployeeIds, { signal }),
    enabled: visibleEmployeeIds.length > 0 && !query.isPlaceholderData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Open jobs are only needed once a worker is chosen for assignment.
  const openJobsQuery = useQuery({
    queryKey: ["ta", "redeployment-open-jobs"],
    queryFn: () => taApi.listJobs({ status: "OPEN" }),
    enabled: Boolean(assignmentTarget),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  // A refresh can leave the current page past the end (for example after an assignment is sent).
  useEffect(() => {
    if (query.data && !query.isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [query.data, query.isPlaceholderData, page, totalPages]);

  const assignRole = useMutation({
    mutationFn: () =>
      taApi.sendTalentPoolInvitation({
        applicantProfileId: assignmentTarget!.applicantProfileId!,
        targetJobId: Number(targetJobId),
        message: assignmentMessage.trim() || undefined,
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
      void cache.invalidateQueries({ queryKey: ["ta", "redeployment-suggestions"] });
      setAssignmentTarget(null);
      setTargetJobId("");
      setAssignmentMessage("");
      notify.success(
        "Assignment sent",
        "The worker can review and accept the open role from their portal."
      );
    },
    onError: (error: any) =>
      notify.error("Assignment failed", error?.message || error),
  });

  if (query.isLoading) return <LoadingState variant="table" rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const targetSuggestions = assignmentTarget ? suggestionsQuery.data?.items[assignmentTarget.id] : undefined;
  const suggestedJobIds = new Map<number, RedeploymentJobSuggestion>();
  if (targetSuggestions) {
    // Matching jobs lead the picker, in ranked order, labelled with why they fit.
    targetSuggestions.suggestions.forEach((suggestion) => suggestedJobIds.set(suggestion.jobId, suggestion));
  }
  const targetRanks = new Map((targetSuggestions?.suggestions ?? []).map((suggestion, index) => [suggestion.jobId, index]));
  // Same-client is decided from the worker's own placement history, so every job at a
  // previous client is flagged, not only the ones that made the suggestion list.
  const pastClientIds = new Set((assignmentTarget?.pastClients ?? []).map((client) => client.id));
  const isSameClientJob = (clientId: number | null | undefined) => clientId != null && pastClientIds.has(clientId);
  const suggestedGroup = `Suggested for ${assignmentTarget?.name ?? "this worker"}`;
  const openJobs = openJobsQuery.data || [];
  const hasSuggestions = openJobs.some((job) => suggestedJobIds.has(job.id) || isSameClientJob(job.mrf?.clientId));
  const dialogJobOptions = openJobs
    .map((job) => {
      const suggestion = suggestedJobIds.get(job.id);
      const sameClient = isSameClientJob(job.mrf?.clientId);
      const tag = sameClient
        ? { badge: "Same client · skips screening", badgeTone: "amber" as const }
        : suggestion
          ? { badge: suggestionTag(suggestion), badgeTone: "neutral" as const }
          : {};
      return {
        value: String(job.id),
        label: job.title,
        subtitle: `${job.mrf?.client?.name || "General Client"} • ${job.location || "On-site"}`,
        ...tag,
        ...(hasSuggestions ? { group: sameClient || suggestion ? suggestedGroup : "Other open jobs" } : {}),
        // Same-client jobs first, then ranked suggestions, then everything else.
        rank: sameClient ? -1 : suggestion ? targetRanks.get(job.id)! : Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.rank - b.rank)
    .map(({ rank: _rank, ...option }) => option);
  const selectedJob = openJobs.find((job) => String(job.id) === targetJobId);
  const selectedSameClient = selectedJob ? isSameClientJob(selectedJob.mrf?.clientId) : false;

  const openAssignment = (row: Row, jobId?: number) => {
    setAssignmentTarget(row);
    setTargetJobId(jobId ? String(jobId) : "");
    setAssignmentMessage("");
  };

  const counts: Record<RedeploymentStage, number> = query.data?.summary.stages ?? { NEEDS_PLACEMENT: 0, WAITING_FOR_REPLY: 0, IN_PROGRESS: 0 };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Filter by redeployment stage">
        {STAGES.map((stage) => {
          const active = stageFilter === stage.id;
          const urgent = stage.id === "NEEDS_PLACEMENT" && counts[stage.id] > 0;
          return (
            <button
              key={stage.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStageFilter(active ? null : stage.id);
                setPage(1);
              }}
              className={`rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                active
                  ? "border-teal-700 bg-teal-50"
                  : urgent
                    ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
                    : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className={`text-2xl font-bold ${urgent && !active ? "text-amber-800" : "text-slate-900"}`}>
                {counts[stage.id]}
              </div>
              <div className="text-sm font-semibold text-slate-800">{stage.label}</div>
              <div className="text-xs text-slate-500">
                {active ? "Showing only this group. Click to clear." : stage.hint}
              </div>
            </button>
          );
        })}
      </div>
      <Input
        label="Search redeployment queue"
        placeholder="Employee, previous client, or role"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      {!pageItems.length ? (
        <EmptyState
          title={stageFilter || search ? "No workers match this view" : "No workers waiting for redeployment"}
          description={
            stageFilter || search
              ? "Clear the search or the selected group to see everyone in the queue."
              : "Workers who confirm they want another assignment will appear here after their previous placement ends."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-mono text-[10px] uppercase text-slate-500">
              <tr>
                {["Employee", "Previous placement", "Waiting", "Suggested jobs", "Next action", "Actions"].map(
                  (label) => (
                    <th key={label} scope="col" className="p-3 font-semibold">
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-900">
              {pageItems.map((row, index) => (
                <React.Fragment key={row.id}>
                {pageItems[index - 1]?.stage !== row.stage && (
                  <tr className="bg-slate-50">
                    <th colSpan={6} scope="colgroup" className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      {STAGES.find((stage) => stage.id === row.stage)?.label} · {counts[row.stage]}
                    </th>
                  </tr>
                )}
                <tr>
                  <td className="p-3">
                    <Link
                      className="font-bold text-slate-900 hover:underline"
                      to="/ta/employees/$employeeId"
                      params={{ employeeId: String(row.id) }}
                    >
                      {row.name}
                    </Link>
                    <div className="mt-1 text-slate-500">{row.employeeNumber}</div>
                  </td>
                  <td className="p-3">
                    <span className="font-semibold">{row.previousClient || "Not recorded"}</span>
                    <div className="mt-1 text-slate-500">{row.previousRole || "Role not recorded"}</div>
                  </td>
                  <td className="p-3">
                    <WaitingCell since={row.waitingSince} />
                  </td>
                  <td className="p-3">
                    {row.stage === "IN_PROGRESS" ? (
                      <span className="text-slate-400">Already applying</span>
                    ) : (
                      <SuggestedJobs
                        data={suggestionsQuery.data?.items[row.id]}
                        loading={suggestionsQuery.isPending}
                        failed={suggestionsQuery.isError}
                        onRetry={() => suggestionsQuery.refetch()}
                        onPick={(jobId) => openAssignment(row, jobId)}
                      />
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{row.nextAction}</div>
                    {row.pendingInvitation && (
                      <div className="mt-1 text-slate-500">Invited to {row.pendingInvitation.title}</div>
                    )}
                    {row.applications.map((application) => (
                      <Link
                        key={application.id}
                        className="mt-1 block text-teal-700 hover:underline"
                        to="/ta/applications/$applicationId"
                        params={{ applicationId: String(application.id) }}
                      >
                        {application.client || application.title} ·{" "}
                        {getApplicationStatusMeta(application.status).label}
                      </Link>
                    ))}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={row.stage === "NEEDS_PLACEMENT" ? "primary" : "outline"}
                        size="sm"
                        onClick={() => openAssignment(row)}
                      >
                        Assign to Open Role
                      </Button>
                      <Link
                        className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                        to="/ta/employees/$employeeId"
                        params={{ employeeId: String(row.id) }}
                      >
                        View 201
                      </Link>
                    </div>
                  </td>
                </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalItems > PAGE_SIZE && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
        />
      )}
      <Dialog
        open={Boolean(assignmentTarget)}
        onClose={() => setAssignmentTarget(null)}
        title="Assign to open role"
        description={`Select an open job requisition to invite or assign ${assignmentTarget?.name}.`}
        overflowVisible
      >
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">Previously placed at: </span>
            {assignmentTarget?.pastClients.length
              ? assignmentTarget.pastClients.map((client) => client.name).join(", ")
              : "No previous client on record"}
          </div>
          {!assignmentTarget?.applicantProfileId && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              This employee does not have an applicant profile linked to their account and cannot be invited directly.
            </div>
          )}
          <ComboBox
            label="Open Job Requisition"
            placeholder="Select an open job..."
            loading={openJobsQuery.isLoading}
            loadingText="Loading open jobs..."
            value={targetJobId}
            onChange={(val) => setTargetJobId(val)}
            options={dialogJobOptions}
            disabled={openJobsQuery.isError}
            error={openJobsQuery.isError ? "Failed to load open jobs. Please try again." : undefined}
          />
          {selectedJob && (
            <div
              role="status"
              className={`rounded-md border p-3 text-xs ${
                selectedSameClient
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {selectedSameClient ? (
                <>
                  <span className="font-semibold">Same client as before ({selectedJob.mrf?.client?.name}).</span>{" "}
                  If the worker accepts, screening is skipped and the application goes straight to Requirements.
                  Documents still valid from the previous placement are reused.
                </>
              ) : (
                <>
                  <span className="font-semibold">New client for this worker
                    {selectedJob.mrf?.client?.name ? ` (${selectedJob.mrf.client.name})` : ""}.
                  </span>{" "}
                  If the worker accepts, the application starts from screening like any new applicant.
                </>
              )}
            </div>
          )}
          <Textarea
            label="Invitation Message (Optional)"
            placeholder="Add an optional note or assignment details for the worker..."
            value={assignmentMessage}
            onChange={(event) => setAssignmentMessage(event.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignmentTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={assignRole.isPending}
              disabled={!targetJobId || !assignmentTarget?.applicantProfileId}
              onClick={() => assignRole.mutate()}
            >
              Send opportunity
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
