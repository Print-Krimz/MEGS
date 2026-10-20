import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, EmptyState, Pagination } from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
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
const WARN_WAIT_DAYS = 7;
const LONG_WAIT_DAYS = 14;
const PAGE_SIZE = 10;

const daysSince = (value: string | null) =>
  value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)) : null;

const WaitingCell: React.FC<{ since: string | null }> = ({ since }) => {
  const days = daysSince(since);
  if (since === null || days === null) {
    return <span className="text-slate-400" title="No end date on the previous placement">—</span>;
  }
  const tone =
    days >= LONG_WAIT_DAYS
      ? "border border-rose-300 bg-rose-50 text-rose-800"
      : days >= WARN_WAIT_DAYS
        ? "border border-amber-300 bg-amber-50 text-amber-800"
        : "text-slate-800";
  return (
    <div>
      <span
        className={`inline-flex rounded px-1.5 py-0.5 font-semibold ${tone}`}
        title={days >= WARN_WAIT_DAYS ? `Waiting ${days} days. Prioritise this worker.` : undefined}
      >
        {days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}
      </span>
      <div className="mt-1 text-slate-500">Since {formatDate(since)}</div>
    </div>
  );
};

// Short tag for the job picker; the full reason is shown on the row.
const suggestionTag = (suggestion: RedeploymentJobSuggestion) =>
  suggestion.sameClient
    ? "Same client"
    : suggestion.matchPercent !== null
      ? `${suggestion.matchPercent}% match`
      : "Related experience";

const suggestionReason = (suggestion: RedeploymentJobSuggestion) => {
  if (suggestion.sameClient) return "Same client, skips screening";
  const shared = suggestion.sharedKeywords?.length ? `shares ${suggestion.sharedKeywords.join(", ")}` : "";
  if (suggestion.matchPercent !== null) {
    return shared ? `${suggestion.matchPercent}% profile match, ${shared}` : `${suggestion.matchPercent}% profile match`;
  }
  return shared ? `Matches previous role or skills: ${shared}` : "Matches previous role or skills";
};

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
  const top = data.suggestions[0];
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onPick()}
        className="font-semibold text-teal-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
      >
        {data.total} job{data.total === 1 ? "" : "s"} fit · View matches
      </button>
      {top && (
        <button
          type="button"
          onClick={() => onPick(top.jobId)}
          title={`Assign to ${top.title}: ${suggestionReason(top)}`}
          className="block max-w-[16rem] truncate text-left text-slate-600 hover:text-slate-900 hover:underline"
        >
          Top: {top.title} · {suggestionTag(top)}
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
  // Until the TA edits the text, the message follows the template for the chosen job.
  const [messageEdited, setMessageEdited] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  // null = automatic: Suggested when the worker has suggestions, otherwise All open jobs.
  const [jobView, setJobView] = useState<"suggested" | "all" | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        message: invitationMessage.trim() || undefined,
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
      void cache.invalidateQueries({ queryKey: ["ta", "redeployment-suggestions"] });
      setAssignmentTarget(null);
      setTargetJobId("");
      setAssignmentMessage("");
      setMessageEdited(false);
      setConfirmOpen(false);
      notify.success(
        "Assignment sent",
        "The worker can review and accept the open role from their portal."
      );
    },
    onError: (error: any) => {
      setConfirmOpen(false);
      notify.error("Assignment failed", error?.message || error);
    },
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
  const openJobs = openJobsQuery.data || [];
  const selectedJob = openJobs.find((job) => String(job.id) === targetJobId);
  const selectedSameClient = selectedJob ? isSameClientJob(selectedJob.mrf?.clientId) : false;

  const jobCards = openJobs
    .map((job) => {
      const suggestion = suggestedJobIds.get(job.id);
      const sameClient = isSameClientJob(job.mrf?.clientId);
      return {
        job,
        suggestion,
        sameClient,
        suggested: sameClient || Boolean(suggestion),
        // Same-client jobs first, then ranked suggestions, then everything else.
        rank: sameClient ? -1 : suggestion ? targetRanks.get(job.id)! : Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.rank - b.rank);
  const jobQuery = jobSearch.trim().toLowerCase();
  const visibleJobCards = jobQuery
    ? jobCards.filter(({ job }) =>
        `${job.title} ${job.mrf?.client?.name ?? ""} ${job.location ?? ""}`.toLowerCase().includes(jobQuery))
    : jobCards;
  const clientOptions = [...new Map(
    openJobs.filter((job) => job.mrf?.clientId != null).map((job) => [String(job.mrf!.clientId), job.mrf?.client?.name || "General Client"])
  )].sort((a, b) => a[1].localeCompare(b[1]));
  const clientCards = clientFilter
    ? visibleJobCards.filter(({ job }) => String(job.mrf?.clientId) === clientFilter)
    : visibleJobCards;
  const suggestedCards = clientCards.filter((card) => card.suggested);
  const otherCards = clientCards.filter((card) => !card.suggested);
  const totalSuggested = jobCards.filter((card) => card.suggested).length;
  // Searching always looks through every job, so a suggestion tab can never hide a match.
  const effectiveView = jobQuery ? "all" : (jobView ?? (totalSuggested > 0 ? "suggested" : "all"));

  // A document is reused at any client when it is a general clearance, otherwise only at a client the worker already served.
  const selectedClientId = selectedJob?.mrf?.clientId;
  const reusableDocs = (targetSuggestions?.reusableDocuments ?? []).filter(
    (doc) => doc.general || (selectedClientId != null && doc.clientIds.includes(selectedClientId))
  );
  const waitingDays = daysSince(assignmentTarget?.waitingSince ?? null);

  const firstName = assignmentTarget?.name?.trim().split(/\s+/)[0] || "there";
  const templateMessage = selectedJob
    ? selectedSameClient
      ? `Hi ${firstName}, we have an open ${selectedJob.title} role at ${selectedJob.mrf?.client?.name || "your previous client"}, where you worked before. Because you already know the client, your application goes straight to requirements and your valid documents are reused. Please review the role and accept it in your Applicant account.`
      : `Hi ${firstName}, we have an open ${selectedJob.title} role${selectedJob.mrf?.client?.name ? ` at ${selectedJob.mrf.client.name}` : ""} that fits your experience. If you accept, your application starts with screening. Please review the role and accept it in your Applicant account.`
    : "";
  const invitationMessage = messageEdited ? assignmentMessage : templateMessage;

  const openAssignment = (row: Row, jobId?: number) => {
    setAssignmentTarget(row);
    setTargetJobId(jobId ? String(jobId) : "");
    setAssignmentMessage("");
    setMessageEdited(false);
    setJobSearch("");
    setJobView(null);
    setClientFilter("");
  };

  const closeAssignment = () => {
    setAssignmentTarget(null);
    setConfirmOpen(false);
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
                    <div className="mt-1 font-mono text-[11px] text-slate-400">{row.employeeNumber}</div>
                  </td>
                  <td className="p-3">
                    {row.previousClient || row.previousRole ? (
                      <>
                        <span className="font-semibold">{row.previousClient || "—"}</span>
                        <div className="mt-1 text-slate-500">{row.previousRole || "—"}</div>
                      </>
                    ) : (
                      <span className="text-slate-400" title="No previous placement on record">—</span>
                    )}
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
                      {row.stage !== "IN_PROGRESS" && (
                        <Button
                          variant={row.stage === "NEEDS_PLACEMENT" ? "primary" : "outline"}
                          size="sm"
                          onClick={() => openAssignment(row)}
                        >
                          Assign to Open Role
                        </Button>
                      )}
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
        onClose={closeAssignment}
        title="Assign to open role"
        description={`Choose an open job to invite ${assignmentTarget?.name} to.`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <div className="font-semibold text-slate-900">{assignmentTarget?.name}</div>
            <div>
              Last placement:{" "}
              {assignmentTarget?.previousClient || assignmentTarget?.previousRole
                ? [assignmentTarget?.previousRole, assignmentTarget?.previousClient].filter(Boolean).join(" at ")
                : "none on record"}
            </div>
            <div>
              {waitingDays === null ? "Waiting time not recorded" : `Waiting ${waitingDays} day${waitingDays === 1 ? "" : "s"}`}
              {" · "}
              {targetSuggestions?.reusableDocuments?.length
                ? `${targetSuggestions?.reusableDocuments?.length} document${targetSuggestions?.reusableDocuments?.length === 1 ? "" : "s"} still valid`
                : "no valid documents on file"}
            </div>
          </div>
          {!assignmentTarget?.applicantProfileId && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              This employee does not have an applicant profile linked to their account and cannot be invited directly.
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Input
              label="Open job"
              placeholder="Search all open jobs by title, client or location"
              value={jobSearch}
              onChange={(event) => setJobSearch(event.target.value)}
            />
            {!jobQuery && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-slate-200 p-0.5 text-xs" role="tablist" aria-label="Job list">
                  {([
                    { id: "suggested", label: `Suggested (${totalSuggested})` },
                    { id: "all", label: `All open jobs (${openJobs.length})` },
                  ] as const).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={effectiveView === tab.id}
                      onClick={() => setJobView(tab.id)}
                      className={`rounded px-2.5 py-1 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                        effectiveView === tab.id ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {effectiveView === "all" && clientOptions.length > 1 && (
                  <Select
                    aria-label="Filter by client"
                    value={clientFilter}
                    onChange={(event) => setClientFilter(event.target.value)}
                    options={[{ value: "", label: "All clients" }, ...clientOptions.map(([value, label]) => ({ value, label }))]}
                  />
                )}
              </div>
            )}
            {openJobsQuery.isLoading ? (
              <p className="text-xs text-slate-500">Loading open jobs…</p>
            ) : openJobsQuery.isError ? (
              <p className="text-xs text-rose-700">Failed to load open jobs. Please try again.</p>
            ) : effectiveView === "suggested" && suggestedCards.length === 0 ? (
              <p className="text-xs text-slate-500">
                No suggested jobs for this worker.{" "}
                <button type="button" onClick={() => setJobView("all")} className="font-medium text-teal-700 hover:underline">
                  Browse all open jobs
                </button>
              </p>
            ) : clientCards.length === 0 ? (
              <p className="text-xs text-slate-500">No open jobs match your search or filter.</p>
            ) : (
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-2 lg:max-h-[30rem]" role="radiogroup" aria-label="Open jobs">
                {[
                  { heading: `Suggested for ${assignmentTarget?.name ?? "this worker"}`, cards: suggestedCards },
                  { heading: suggestedCards.length ? "Other open jobs" : "", cards: effectiveView === "all" ? otherCards : [] },
                ].map(({ heading, cards }) =>
                  cards.length === 0 ? null : (
                    <div key={heading || "all"} className="space-y-1.5">
                      {heading && (
                        <div className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{heading}</div>
                      )}
                      {cards.map(({ job, suggestion, sameClient }) => {
                        const selected = String(job.id) === targetJobId;
                        return (
                          <button
                            key={job.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setTargetJobId(String(job.id))}
                            className={`block w-full rounded-md border p-2.5 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                              selected
                                ? "border-teal-700 bg-teal-50"
                                : sameClient
                                  ? "border-amber-300 bg-amber-50/60 hover:bg-amber-50"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-900">{job.title}</span>
                              {(sameClient || suggestion) && (
                                <span
                                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                    sameClient ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  {sameClient ? "Same client" : suggestion ? suggestionTag(suggestion) : ""}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-slate-500">
                              {job.mrf?.client?.name || "General Client"} · {job.location || "On-site"}
                            </div>
                            {(sameClient || suggestion) && (
                              <div className="mt-0.5 text-slate-600">
                                {sameClient ? "Same client, skips screening" : suggestion ? suggestionReason(suggestion) : ""}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
          {!selectedJob && (
            <p className="rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-500">
              Pick a job to see its details and what happens to the worker's documents.
            </p>
          )}
          {selectedJob && (
            <div role="status" className="space-y-2 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div>
                <span className="font-semibold text-slate-900">{selectedJob.title}</span>
                {" · "}
                {[
                  selectedJob.location,
                  selectedJob.mrf?.employmentType,
                  selectedJob.mrf?.workArrangement,
                  selectedJob.mrf?.salaryRangeMin != null || selectedJob.mrf?.salaryRangeMax != null
                    ? `₱${(selectedJob.mrf?.salaryRangeMin ?? 0).toLocaleString()}${selectedJob.mrf?.salaryRangeMax != null ? `–${selectedJob.mrf.salaryRangeMax.toLocaleString()}` : "+"}`
                    : null,
                  selectedJob._count ? `${selectedJob._count.applications} applicant${selectedJob._count.applications === 1 ? "" : "s"}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div className={selectedSameClient ? "text-amber-900" : ""}>
                {selectedSameClient ? (
                  <>
                    <span className="font-semibold">Same client as before ({selectedJob.mrf?.client?.name}).</span>{" "}
                    If the worker accepts, screening is skipped and the application goes straight to Requirements.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">
                      New client for this worker{selectedJob.mrf?.client?.name ? ` (${selectedJob.mrf.client.name})` : ""}.
                    </span>{" "}
                    If the worker accepts, the application starts from screening like any new applicant.
                  </>
                )}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Documents reused: </span>
                {reusableDocs.length === 0
                  ? "none. The worker will upload every requirement."
                  : reusableDocs
                      .map((doc) => (doc.expiresAt ? `${doc.label} (valid to ${formatDate(doc.expiresAt)})` : `${doc.label} (no expiry)`))
                      .join(", ")}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Textarea
              label="Invitation message"
              placeholder="Pick a job and a message is filled in for you."
              value={invitationMessage}
              onChange={(event) => {
                setAssignmentMessage(event.target.value);
                setMessageEdited(true);
              }}
              rows={5}
              maxLength={1000}
            />
            {messageEdited && templateMessage && (
              <button
                type="button"
                onClick={() => setMessageEdited(false)}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Reset to template
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            The worker gets this invitation in their portal and can accept or decline it.
          </p>
          </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {!targetJobId && <span className="text-[11px] text-slate-500">Pick a job first</span>}
            <Button variant="outline" onClick={closeAssignment}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!targetJobId || !assignmentTarget?.applicantProfileId}
              onClick={() => setConfirmOpen(true)}
            >
              Send opportunity
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={confirmOpen && Boolean(selectedJob)}
        onClose={() => setConfirmOpen(false)}
        title="Send this opportunity?"
        description={`${selectedJob?.title ?? "This job"}${selectedJob?.mrf?.client?.name ? ` (${selectedJob.mrf.client.name})` : ""} will be sent to ${assignmentTarget?.name}.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Back
          </Button>
          <Button variant="primary" loading={assignRole.isPending} onClick={() => assignRole.mutate()}>
            Send opportunity
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
