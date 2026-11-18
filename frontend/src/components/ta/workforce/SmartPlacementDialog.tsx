import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs } from "../../common";
import { useMatchThreshold } from "../../common/ScoreBadge";
import { Button, Dialog, Input, Select, Textarea } from "../../ui";
import { RadioRow } from "../AssistedResponseDialog";
import { NoAccountChip } from "../walk-in/NoAccountChip";
import {
  employeesApi,
  type RedeploymentJobSuggestion,
  type RedeploymentSuggestionsResponse,
} from "../../../lib/api/employees.api";

type RedeploymentEmployeeSuggestions = RedeploymentSuggestionsResponse["items"][number];
import { taApi } from "../../../lib/api/ta.api";
import { notify } from "../../../lib/feedback";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../../lib/query-policies";
import { TA_COPY } from "../../../lib/ta-copy";
import { formatDate } from "../../../lib/utils";
import {
  daysSince,
  matchTagClass,
  suggestionReason,
  suggestionTag,
} from "./redeployment-helpers";

export interface SmartPlacementTarget {
  employeeId?: number;
  name: string;
  applicantProfileId?: number | null;
  hasPortalAccess?: boolean;
  hasMobile?: boolean;
  maskedMobile?: string | null;
  previousClient?: string | null;
  previousRole?: string | null;
  waitingSince?: string | null;
  pastClients?: { id: number; name?: string }[];
}

export interface SmartPlacementDialogProps {
  open: boolean;
  onClose: () => void;
  target: SmartPlacementTarget | null;
  initialJobId?: number;
  suggestions?: RedeploymentEmployeeSuggestions;
  onAssigned?: () => void;
}

/**
 * Shared placement dialog for Redeployment Queue and Employee Detail.
 * Surfaces same-client fast-track, AI-ranked job suggestions, reusable 201 documents,
 * and portal vs. walk-in (Assign now / Text the offer) flows.
 */
export const SmartPlacementDialog: React.FC<SmartPlacementDialogProps> = ({
  open,
  onClose,
  target,
  initialJobId,
  suggestions: providedSuggestions,
  onAssigned,
}) => {
  const matchThreshold = useMatchThreshold();
  const cache = useQueryClient();

  const [targetJobId, setTargetJobId] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [jobView, setJobView] = useState<"suggested" | "all" | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [confirmMode, setConfirmMode] = useState<"INVITE" | "ASSIGN" | "TEXT" | null>(null);
  const [assignChannel, setAssignChannel] = useState<"ASSISTED_PHONE" | "IN_PERSON">("ASSISTED_PHONE");

  useEffect(() => {
    if (!open) return;
    setTargetJobId(initialJobId ? String(initialJobId) : "");
    setAssignmentMessage("");
    setMessageEdited(false);
    setJobSearch("");
    setJobView(null);
    setClientFilter("");
    setConfirmMode(null);
  }, [open, initialJobId, target?.employeeId, target?.applicantProfileId]);

  const openJobsQuery = useQuery({
    queryKey: ["ta", "redeployment-open-jobs"],
    queryFn: () => taApi.listJobs({ status: "OPEN" }),
    enabled: open,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const fetchedSuggestionsQuery = useQuery({
    queryKey: ["ta", "redeployment-suggestions", { employeeIds: String(target?.employeeId ?? "") }],
    queryFn: ({ signal }) => employeesApi.getRedeploymentSuggestions([target!.employeeId!], { signal }),
    enabled: open && !providedSuggestions && Boolean(target?.employeeId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const targetSuggestions =
    providedSuggestions ??
    (target?.employeeId ? fetchedSuggestionsQuery.data?.items[target.employeeId] : undefined);

  const targetHasPortal = target?.hasPortalAccess ?? true;
  const openJobs = openJobsQuery.data || [];
  const selectedJob = openJobs.find((job) => String(job.id) === targetJobId);

  const pastClientIds = new Set((target?.pastClients ?? []).map((client) => client.id));
  const isSameClientJob = (clientId: number | null | undefined) => clientId != null && pastClientIds.has(clientId);
  const selectedSameClient = selectedJob ? isSameClientJob(selectedJob.mrf?.clientId) : false;

  const suggestedJobIds = new Map<number, RedeploymentJobSuggestion>();
  if (targetSuggestions) {
    targetSuggestions.suggestions.forEach((suggestion) => suggestedJobIds.set(suggestion.jobId, suggestion));
  }
  const targetRanks = new Map(
    (targetSuggestions?.suggestions ?? []).map((suggestion, index) => [suggestion.jobId, index]),
  );

  const jobCards = openJobs
    .map((job) => {
      const suggestion = suggestedJobIds.get(job.id);
      const sameClient = isSameClientJob(job.mrf?.clientId);
      return {
        job,
        suggestion,
        sameClient,
        suggested: sameClient || Boolean(suggestion),
        rank: sameClient ? -1 : suggestion ? targetRanks.get(job.id)! : Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const jobQuery = jobSearch.trim().toLowerCase();
  const visibleJobCards = jobQuery
    ? jobCards.filter(({ job }) =>
        `${job.title} ${job.mrf?.client?.name ?? ""} ${job.location ?? ""}`.toLowerCase().includes(jobQuery),
      )
    : jobCards;

  const clientOptions = [
    ...new Map(
      openJobs
        .filter((job) => job.mrf?.clientId != null)
        .map((job) => [String(job.mrf!.clientId), job.mrf?.client?.name || "General Client"]),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const clientCards = clientFilter
    ? visibleJobCards.filter(({ job }) => String(job.mrf?.clientId) === clientFilter)
    : visibleJobCards;

  const suggestedCards = clientCards.filter((card) => card.suggested);
  const otherCards = clientCards.filter((card) => !card.suggested);
  const totalSuggested = jobCards.filter((card) => card.suggested).length;
  const effectiveView = jobQuery ? "all" : (jobView ?? (totalSuggested > 0 ? "suggested" : "all"));

  const selectedClientId = selectedJob?.mrf?.clientId;
  const reusableDocs = (targetSuggestions?.reusableDocuments ?? []).filter(
    (doc) => doc.general || (selectedClientId != null && doc.clientIds.includes(selectedClientId)),
  );
  const waitingDays = daysSince(target?.waitingSince ?? null);

  const firstName = target?.name?.trim().split(/\s+/)[0] || "there";
  const acceptLine = targetHasPortal
    ? "Please review the role and accept it in your Applicant account."
    : "Please let us know if you accept.";
  const templateMessage = selectedJob
    ? selectedSameClient
      ? `Hi ${firstName}, we have an open ${selectedJob.title} role at ${selectedJob.mrf?.client?.name || "your previous client"}, where you worked before. Because you already know the client, your application goes straight to requirements and your valid documents are reused. ${acceptLine}`
      : `Hi ${firstName}, we have an open ${selectedJob.title} role${selectedJob.mrf?.client?.name ? ` at ${selectedJob.mrf.client.name}` : ""} that fits your experience. If you accept, your application starts with screening. ${acceptLine}`
    : "";
  const invitationMessage = messageEdited ? assignmentMessage : templateMessage;

  const assignRole = useMutation({
    mutationFn: async (mode: "INVITE" | "ASSIGN" | "TEXT") => {
      const invitation = await taApi.sendTalentPoolInvitation({
        applicantProfileId: target!.applicantProfileId!,
        targetJobId: Number(targetJobId),
        message: invitationMessage.trim() || undefined,
      });
      try {
        if (mode === "ASSIGN") {
          await taApi.recordAssistedResponse(invitation.id, { decision: "ACCEPT", channel: assignChannel });
        } else if (mode === "TEXT") {
          const sms = await taApi.sendOfferSmsLink(invitation.id);
          return { mode, sentTo: sms.sentTo };
        }
      } catch (error: any) {
        return { mode, followUpError: String(error?.message || "Try again from the pending offer.") };
      }
      return { mode };
    },
    onSuccess: (result: { mode: "INVITE" | "ASSIGN" | "TEXT"; sentTo?: string; followUpError?: string }) => {
      void cache.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
      void cache.invalidateQueries({ queryKey: ["ta", "redeployment-suggestions"] });
      void cache.invalidateQueries({ queryKey: ["ta", "talent-pool", "invitations"] });
      if (target?.employeeId) {
        void cache.invalidateQueries({ queryKey: ["ta", "employee", String(target.employeeId)] });
      }
      if (result.mode === "ASSIGN") void cache.invalidateQueries({ queryKey: ["ta", "applications"] });
      const name = target?.name ?? "The worker";
      const jobTitle = selectedJob?.title ?? "the job";
      setConfirmMode(null);
      onAssigned?.();
      onClose();
      if (result.followUpError) {
        notify.error(
          result.mode === "ASSIGN" ? "Offer saved, but the yes was not recorded" : "Offer saved, but the text was not sent",
          `${result.followUpError} Use ${result.mode === "ASSIGN" ? "Record reply" : "Text offer link"} on ${name}'s pending offer.`,
        );
      } else if (result.mode === "ASSIGN") {
        notify.success("Assigned", `${name} now has an application for ${jobTitle}.`);
      } else if (result.mode === "TEXT") {
        notify.success("Offer texted", `Sent to ${result.sentTo}. ${name} can accept or decline from the link.`);
      } else {
        notify.success(
          "Invitation sent",
          targetHasPortal
            ? "The worker can review and accept the open role from their portal."
            : "Record their reply or text them an offer link from the pending invitation.",
        );
      }
    },
    onError: (error: any) => {
      setConfirmMode(null);
      notify.error("Could not create the offer", error?.message || error);
    },
  });

  const handleClose = () => {
    setConfirmMode(null);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        title={TA_COPY.workforce.actions.findJob}
        description={
          targetHasPortal
            ? `Choose an open job to invite ${target?.name} to. They accept it from their applicant account.`
            : `Choose an open job for ${target?.name}. They have no applicant account, so you assign them or text them the offer.`
        }
        size="xl"
      >
        <div className="space-y-4">
          <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
              {target?.name}
              <NoAccountChip hasPortalAccess={target?.hasPortalAccess} />
            </div>
            <div>
              Last placement:{" "}
              {target?.previousClient || target?.previousRole
                ? [target?.previousRole, target?.previousClient].filter(Boolean).join(" at ")
                : "none on record"}
            </div>
            <div>
              {waitingDays === null ? "Waiting time not recorded" : `Waiting ${waitingDays} day${waitingDays === 1 ? "" : "s"}`}
              {" · "}
              {targetSuggestions?.reusableDocuments?.length
                ? `${targetSuggestions.reusableDocuments.length} document${targetSuggestions.reusableDocuments.length === 1 ? "" : "s"} still valid`
                : "no valid documents on file"}
            </div>
          </div>
          {!target?.applicantProfileId && (
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
                  <Tabs
                    ariaLabel="Job list"
                    value={effectiveView}
                    onChange={(id) => setJobView(id as "suggested" | "all")}
                    items={[
                      { id: "suggested", label: `Suggested (${totalSuggested})`, panelId: "smart-placement-jobs" },
                      { id: "all", label: `All open jobs (${openJobs.length})`, panelId: "smart-placement-jobs" },
                    ]}
                  />
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
              <div id="smart-placement-jobs">
                {openJobsQuery.isLoading ? (
                  <p className="text-xs text-slate-600">Loading open jobs…</p>
                ) : openJobsQuery.isError ? (
                  <p className="text-xs text-rose-700">Failed to load open jobs. Please try again.</p>
                ) : effectiveView === "suggested" && suggestedCards.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    No suggested jobs for this worker.{" "}
                    <button type="button" onClick={() => setJobView("all")} className="font-medium text-navy hover:underline">
                      Browse all open jobs
                    </button>
                  </p>
                ) : clientCards.length === 0 ? (
                  <p className="text-xs text-slate-600">No open jobs match your search or filter.</p>
                ) : (
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-2 lg:max-h-[30rem]" role="radiogroup" aria-label="Open jobs">
                    {[
                      { heading: `Suggested for ${target?.name ?? "this worker"}`, cards: suggestedCards },
                      { heading: suggestedCards.length ? "Other open jobs" : "", cards: effectiveView === "all" ? otherCards : [] },
                    ].map(({ heading, cards }) =>
                      cards.length === 0 ? null : (
                        <div key={heading || "all"} className="space-y-1.5">
                          {heading && (
                            <div className="px-1 text-xs font-bold tracking-wide text-slate-600">{heading}</div>
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
                                className={`block w-full rounded-md border p-2.5 text-left text-xs transition-colors focus-ring ${
                                  selected
                                    ? "border-navy bg-navy-soft"
                                    : sameClient
                                      ? "border-amber-300 bg-amber-50/60 hover:bg-amber-50"
                                      : "border-slate-200 bg-white hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-slate-900">{job.title}</span>
                                  {(sameClient || suggestion) && (
                                    <span
                                      className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-semibold ${
                                        sameClient
                                          ? "border-amber-300 bg-amber-100 text-amber-900"
                                          : suggestion
                                            ? matchTagClass(suggestion, matchThreshold)
                                            : ""
                                      }`}
                                    >
                                      {sameClient ? "Same client" : suggestion ? suggestionTag(suggestion) : ""}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 text-slate-600">
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
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {!selectedJob && (
                <p className="rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                  Pick a job to see its details and what happens to the worker&apos;s documents.
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
                    className="text-xs font-medium text-navy hover:underline"
                  >
                    Reset to template
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-600">
                {targetHasPortal
                  ? "The worker gets this invitation in their portal and can accept or decline it."
                  : target?.hasMobile
                    ? "Assign now if they already said yes by phone or in person. Otherwise text them the offer."
                    : "Assign now once they say yes by phone or in person. There is no mobile number to text."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {!targetJobId && <span className="text-xs text-slate-600">Pick a job first</span>}
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {targetHasPortal ? (
              <Button
                variant="primary"
                disabled={!targetJobId || !target?.applicantProfileId}
                onClick={() => setConfirmMode("INVITE")}
              >
                {TA_COPY.workforce.actions.sendInvitation}
              </Button>
            ) : (
              <>
                {target?.hasMobile && (
                  <Button
                    variant="outline"
                    disabled={!targetJobId || !target?.applicantProfileId}
                    onClick={() => setConfirmMode("TEXT")}
                  >
                    Text the offer
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={!targetJobId || !target?.applicantProfileId}
                  onClick={() => {
                    setAssignChannel("ASSISTED_PHONE");
                    setConfirmMode("ASSIGN");
                  }}
                >
                  Assign now
                </Button>
              </>
            )}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmMode !== null && Boolean(selectedJob)}
        onClose={() => (assignRole.isPending ? undefined : setConfirmMode(null))}
        title={
          confirmMode === "ASSIGN"
            ? `Assign ${target?.name} to this job?`
            : confirmMode === "TEXT"
              ? `Text the offer to ${target?.maskedMobile ?? target?.name}?`
              : "Send this invitation?"
        }
        description={
          confirmMode === "ASSIGN"
            ? `Only do this if ${target?.name} already said yes. Their application for ${selectedJob?.title ?? "this job"} starts right away.`
            : confirmMode === "TEXT"
              ? `${target?.name} gets an SMS with a link to accept or decline ${selectedJob?.title ?? "this job"}. The link works once.`
              : `${selectedJob?.title ?? "This job"}${selectedJob?.mrf?.client?.name ? ` (${selectedJob.mrf.client.name})` : ""} will be sent to ${target?.name}.`
        }
      >
        {confirmMode === "ASSIGN" && (
          <fieldset className="mb-4 space-y-2" disabled={assignRole.isPending}>
            <legend className="text-sm font-medium text-slate-900">How did they say yes?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <RadioRow
                name="assign-channel"
                value="ASSISTED_PHONE"
                label="Phone call"
                checked={assignChannel === "ASSISTED_PHONE"}
                onChange={() => setAssignChannel("ASSISTED_PHONE")}
              />
              <RadioRow
                name="assign-channel"
                value="IN_PERSON"
                label="In person"
                checked={assignChannel === "IN_PERSON"}
                onChange={() => setAssignChannel("IN_PERSON")}
              />
            </div>
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={assignRole.isPending} onClick={() => setConfirmMode(null)}>
            Back
          </Button>
          <Button
            variant="primary"
            loading={assignRole.isPending}
            onClick={() => confirmMode && assignRole.mutate(confirmMode)}
          >
            {confirmMode === "ASSIGN" ? "Assign now" : confirmMode === "TEXT" ? "Send text" : TA_COPY.workforce.actions.sendInvitation}
          </Button>
        </div>
      </Dialog>
    </>
  );
};
