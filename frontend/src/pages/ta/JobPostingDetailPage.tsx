import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  ScoreBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  JobImage,
  StatusBadge,
  Tabs,
  JobContentRenderer,
  DataTable,
  ConfirmDialog,
} from "../../components/common";
import type { DataTableColumn } from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { PoolCandidateCard } from "../../components/ta/PoolCandidateCard";
import { RequirementClarityNotice } from "../../components/ta/RequirementClarityNotice";
import { FieldWarning } from "../../components/ta/FieldWarning";
import { LOCATION_HINT, LOCATION_UNCLEAR_WARNING, locationLooksUnclear } from "../../lib/requirement-hints";
import {
  formatDate,
  formatSalaryRange,
  formatEmploymentType,
  formatWorkArrangement,
  cn,
} from "../../lib/utils";
import { ApplicationStatus, JobStatus } from "../../lib/types/enums";
import { plural } from "../../lib/plural";

const ACTIVE_STAGES: string[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.PARSING,
  ApplicationStatus.REVIEW,
  ApplicationStatus.NEEDS_ATTENTION,
  ApplicationStatus.MATCHED,
  ApplicationStatus.INITIAL_SCREENING,
  ApplicationStatus.CLIENT_ENDORSEMENT,
  ApplicationStatus.FINAL_INTERVIEW,
  ApplicationStatus.COMPLIANCE,
  ApplicationStatus.CONTRACT_SIGNING,
];

const DEPLOYED_STAGES: string[] = [
  ApplicationStatus.DEPLOYED,
  ApplicationStatus.HIRED,
];
import { notify, fieldErrorsFrom } from "../../lib/feedback";
import { TalentPoolCandidate } from "../../lib/types/ta.types";
import type { CandidateScore } from "../../lib/types/application.types";
import { SendInvitationModal } from "../../components/ta/SendInvitationModal";
import { InvitationsTrackerDrawer } from "../../components/ta/InvitationsTrackerDrawer";
import { TA_COPY } from "../../lib/ta-copy";
import { useJobCandidateQueries } from "../../hooks/useJobCandidateQueries";
import {
  validateStandardText,
  validateProseText,
} from "../../lib/statutory-validation";
import { getInitialJobCandidateView } from "../../lib/job-candidate-query-policy";

// Backend fields that have an inline input on this form. Any other field's message goes in the toast.
const JOB_INLINE_FIELDS = ["title", "location", "imageUrl", "status", "description", "requirements"];

type ScoreRow = { score: CandidateScore; rank: number };

const SEGMENT_FILTERS = ["active", "deployed", "all"] as const;

export const JobPostingDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { jobId } = useParams({ strict: false }) as { jobId: string };

  const [activeTab, setActiveTab] = useState<"applicants" | "talentPool">(() =>
    getInitialJobCandidateView(typeof window === "undefined" ? "" : window.location.search)
  );

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRequirements, setEditRequirements] = useState("");
  const [editStatus, setEditStatus] = useState<JobStatus>(JobStatus.OPEN);
  const [editIsEvergreen, setEditIsEvergreen] = useState(false);
  const [editModalTab, setEditModalTab] = useState<"edit" | "preview">("edit");
  const [pendingClose, setPendingClose] = useState(false);

  // Invitation Modal & Tracker Drawer State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [trackerDrawerOpen, setTrackerDrawerOpen] = useState(false);
  const [candidateToInvite, setCandidateToInvite] = useState<TalentPoolCandidate | null>(null);

  const [candidatePage, setCandidatePage] = useState(1);
  const candidatePageSize = 10;
  const [applicantFilter, setApplicantFilter] = useState<"active" | "deployed" | "all">("active");

  const jobQuery = useQuery({
    queryKey: ["ta", "job", jobId],
    queryFn: ({ signal }) => taApi.getJob(jobId, { signal }),
    enabled: Boolean(jobId),
  });

  const { rankedCandidatesQuery, talentPoolQuery } = useJobCandidateQueries(jobId, activeTab);

  const rankCandidatesMutation = useMutation({
    mutationFn: () => taApi.rankCandidates(jobId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId, "ranked"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId, "talent-pool"] });
      const count = data?.rankedCount ?? 0;
      notify.success(
        "Candidate matches updated",
        `Reviewed ${count} candidate profile${count === 1 ? "" : "s"}.`
      );
    },
    onError: (err: any) => {
      notify.error("Unable to update candidate matches", err);
    },
  });

  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const clearServerFieldError = (field: string) =>
    setServerFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const updateJobMutation = useMutation({
    mutationFn: (data: any) => taApi.updateJob(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "jobs"] });
      setEditModalOpen(false);
      setServerFieldErrors({});
      notify.success("Job opening updated", "The job details were saved.");
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const entries = Object.entries(fieldErrors);
      if (entries.length > 0) {
        setServerFieldErrors(fieldErrors);
        const toastEntry = entries.find(([field]) => !JOB_INLINE_FIELDS.includes(field)) ?? entries[0];
        notify.error("Check the highlighted fields", toastEntry[1]);
        return;
      }
      notify.error("Unable to update job opening", err);
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: JobStatus) => taApi.updateJob(jobId, { status }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "jobs"] });
      notify.success("Opening status updated", `This opening is now ${status.toLowerCase()}.`);
    },
    onError: (err: any) => {
      notify.error("Unable to change the opening status", err);
    },
  });

  const sendInvitationMutation = useMutation({
    mutationFn: taApi.sendTalentPoolInvitation,
    onSuccess: () => {
      setInviteModalOpen(false);
      setCandidateToInvite(null);
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool", "invitations"] });
      notify.success("Invitation sent", "The candidate is notified in the app and by email.");
    },
    onError: (err: any) => {
      notify.error("Unable to send invitation", err);
    },
  });

  const job = jobQuery.data;

  // Initialize edit form when job loads
  React.useEffect(() => {
    if (job) {
      setEditTitle(job.title);
      setEditLocation(job.location || "");
      setEditImageUrl(job.imageUrl || "");
      setEditDescription(job.description);
      setEditRequirements(job.requirements);
      setEditStatus(job.status);
      setEditIsEvergreen(Boolean(job.isEvergreen));
    }
  }, [job]);

  const rankedScores = React.useMemo(
    () => rankedCandidatesQuery.data || [],
    [rankedCandidatesQuery.data]
  );
  const applicantCount = rankedCandidatesQuery.data?.length ?? job?.applications?.length ?? 0;
  const talentPoolMatches = React.useMemo(
    () => talentPoolQuery.data?.items ?? [],
    [talentPoolQuery.data]
  );
  const unsearchablePoolCount = talentPoolQuery.data?.unsearchableCount ?? 0;
  // The pool is only requested when its tab opens. Until then the count is unknown, so none is shown.
  const poolCountKnown = Boolean(talentPoolQuery.data) && !talentPoolQuery.isError;

  const activeApplicantTotal = React.useMemo(
    () =>
      (job?.applications ?? []).filter(
        (application) => !application.isArchived && ACTIVE_STAGES.includes(application.status)
      ).length,
    [job]
  );

  const activeScores = React.useMemo(() => {
    return rankedScores.filter((s) => {
      const st = s.candidate?.applicationStatus || ApplicationStatus.SUBMITTED;
      return ACTIVE_STAGES.includes(st);
    });
  }, [rankedScores]);

  const deployedScores = React.useMemo(() => {
    return rankedScores.filter((s) => {
      const st = s.candidate?.applicationStatus;
      return Boolean(st && DEPLOYED_STAGES.includes(st));
    });
  }, [rankedScores]);

  const filteredScores = React.useMemo(() => {
    if (applicantFilter === "active") return activeScores;
    if (applicantFilter === "deployed") return deployedScores;
    return rankedScores;
  }, [applicantFilter, activeScores, deployedScores, rankedScores]);

  const totalPages = Math.max(1, Math.ceil(filteredScores.length / candidatePageSize));
  const pageRows: ScoreRow[] = filteredScores
    .slice((candidatePage - 1) * candidatePageSize, candidatePage * candidatePageSize)
    .map((score, idx) => ({ score, rank: (candidatePage - 1) * candidatePageSize + idx + 1 }));

  const breadcrumbs = [
    { label: TA_COPY.breadcrumbRoot, href: "/ta" },
    { label: TA_COPY.navigation.openings, href: "/ta/jobs" },
  ];

  if (jobQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          flush
          title="Job opening"
          description="Loading job opening details..."
          breadcrumbs={[...breadcrumbs, { label: "Job opening" }]}
        />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="space-y-6">
        <PageHeader flush title="Job opening" breadcrumbs={[...breadcrumbs, { label: "Job opening" }]} />
        <ErrorState subject="this job opening" error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  const candidateLabel = (row: ScoreRow) => {
    const candidate = row.score.candidate;
    const fullName = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ").trim();
    return fullName || candidate?.email || `Application #${row.score.applicationId}`;
  };

  const percent = (value: unknown) => `${Number(value).toFixed(0)}%`;

  const applicantColumns: DataTableColumn<ScoreRow>[] = [
    { key: "rank", header: "Rank", align: "center", className: "w-14", cell: (row) => row.rank },
    {
      key: "candidate",
      header: "Candidate",
      primary: true,
      cell: (row) => candidateLabel(row),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          status={row.score.candidate?.applicationStatus || ApplicationStatus.SUBMITTED}
          type="application"
          size="sm"
        />
      ),
    },
    {
      key: "match",
      header: "Match score",
      align: "center",
      cell: (row) => <ScoreBadge score={row.score.finalFitScore} size="md" />,
    },
    { key: "skills", header: "Skills", align: "center", cell: (row) => percent(row.score.skillsScore) },
    { key: "experience", header: "Experience", align: "center", cell: (row) => percent(row.score.experienceScore) },
    { key: "location", header: "Location", align: "center", cell: (row) => percent(row.score.locationScore) },
    { key: "documents", header: "Documents", align: "center", cell: (row) => percent(row.score.complianceScore) },
  ];

  const renderApplicantCard = (row: ScoreRow) => (
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/ta/applications/$applicationId"
            params={{ applicationId: String(row.score.applicationId) }}
            className="inline-flex min-h-11 items-center break-words text-sm font-semibold text-navy underline-offset-2 hover:underline focus-ring"
          >
            {row.rank}. {candidateLabel(row)}
          </Link>
          <p className="text-xs text-slate-600">Calculated {formatDate(row.score.calculatedAt)}</p>
        </div>
        <ScoreBadge score={row.score.finalFitScore} size="md" />
      </div>
      <StatusBadge
        status={row.score.candidate?.applicationStatus || ApplicationStatus.SUBMITTED}
        type="application"
        size="sm"
      />
      <p className="text-sm text-slate-700">
        Skills {percent(row.score.skillsScore)} · Experience {percent(row.score.experienceScore)} · Location{" "}
        {percent(row.score.locationScore)} · Documents {percent(row.score.complianceScore)}
      </p>
    </div>
  );

  const openEditDialog = () => {
    setEditTitle(job.title);
    setEditLocation(job.location || "");
    setEditImageUrl(job.imageUrl || "");
    setEditDescription(job.description);
    setEditRequirements(job.requirements);
    setEditStatus(job.status);
    setEditIsEvergreen(Boolean(job.isEvergreen));
    setEditModalTab("edit");
    setEditModalOpen(true);
  };

  const handleStatusChange = (next: JobStatus) => {
    if (next === job.status) return;
    if (next === JobStatus.CLOSED && activeApplicantTotal > 0) {
      setPendingClose(true);
      return;
    }
    statusMutation.mutate(next);
  };

  const hasSalary = Boolean(job.mrf?.salaryRangeMin || job.mrf?.salaryRangeMax);
  const mrfId = job.mrf?.id ?? job.mrfId;

  return (
    <div className="space-y-6">
      <PageHeader
        flush
        title={job.title}
        description={`Posted ${formatDate(job.createdAt)}`}
        breadcrumbs={[...breadcrumbs, { label: job.title }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              Edit job opening
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={rankCandidatesMutation.isPending}
              onClick={() => rankCandidatesMutation.mutate()}
            >
              Recalculate match scores
            </Button>
          </>
        }
      />

      <RequirementClarityNotice
        clarity={job.requirementClarity}
        fixHint={
          job.requirementClarity?.skillsAreTraits
            ? "Edit the required skills on the client request, and the location here."
            : "Edit the location here."
        }
      />

      {/* One summary strip. The narrative is collapsed so candidates sit in the first screen. */}
      <section aria-label="Opening summary" className="space-y-4 border border-slate-300 bg-white p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt className="mb-1 text-xs font-semibold text-slate-700">Status</dt>
            <dd>
              <label className="sr-only" htmlFor="job-status-control">
                Opening status
              </label>
              <select
                id="job-status-control"
                value={job.status}
                disabled={statusMutation.isPending}
                onChange={(e) => handleStatusChange(e.target.value as JobStatus)}
                className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-900 focus-ring md:min-h-9"
              >
                <option value={JobStatus.OPEN}>Open</option>
                <option value={JobStatus.DRAFT}>Draft</option>
                <option value={JobStatus.CLOSED}>Closed</option>
              </select>
              {job.isEvergreen && <span className="mt-1 block text-xs text-slate-600">Always open</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">Client</dt>
            <dd className="font-medium text-slate-900">{job.mrf?.client?.name || "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">Work site</dt>
            <dd className="font-medium text-slate-900">{job.location || "Philippines"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">Monthly pay</dt>
            <dd className="font-medium text-slate-900">
              {hasSalary ? formatSalaryRange(job.mrf?.salaryRangeMin, job.mrf?.salaryRangeMax) : "Not specified"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">Type and arrangement</dt>
            <dd className="font-medium text-slate-900">
              {job.mrf?.employmentType ? formatEmploymentType(job.mrf.employmentType) : "Not specified"}
              {" · "}
              {formatWorkArrangement(job.mrf?.workArrangement)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">Manpower request</dt>
            <dd className="font-medium">
              {mrfId ? (
                <Link
                  to="/ta/mrfs/$mrfId"
                  params={{ mrfId: String(mrfId) }}
                  className="inline-flex min-h-11 items-center text-navy underline-offset-2 hover:underline focus-ring md:min-h-0"
                >
                  Request #{mrfId}
                </Link>
              ) : (
                <span className="text-slate-700">None (direct posting)</span>
              )}
            </dd>
          </div>
        </dl>

        <details className="group border-t border-slate-200 pt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-navy focus-ring md:min-h-0 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show description and requirements</span>
            <span className="hidden group-open:inline">Hide description and requirements</span>
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Description and responsibilities</h2>
              <JobContentRenderer content={job.description} variant="ta" />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Required skills and qualifications</h2>
              <JobContentRenderer content={job.requirements} variant="ta" />
            </div>
          </div>
        </details>
      </section>

      {/* Candidate Sourcing & Matching Section */}
      <div className="border border-slate-300 bg-white">
        <div className="flex flex-col justify-between sm:flex-row sm:items-center">
          <Tabs
            value={activeTab}
            onChange={(tab) => setActiveTab(tab as "applicants" | "talentPool")}
            ariaLabel="Job opening candidate views"
            items={[
              { id: "applicants", label: `Applicants (${applicantCount})`, panelId: "job-applicants" },
              {
                id: "talentPool",
                label: poolCountKnown ? `Candidate pool matches (${talentPoolMatches.length})` : "Candidate pool matches",
                panelId: "job-talent-pool",
              },
            ]}
            className="flex-1 border-b-0"
          />

          <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 sm:border-b-0 sm:py-0">
            <Button variant="outline" size="sm" onClick={() => setTrackerDrawerOpen(true)}>
              {TA_COPY.invitations.sent}
            </Button>
          </div>
        </div>

        {/* Tab 1: Direct Applicants */}
        {activeTab === "applicants" && (
          <div id="job-applicants" role="tabpanel" tabIndex={0}>
            {rankedCandidatesQuery.isLoading ? (
              <LoadingState variant="table" rows={4} />
            ) : rankedScores.length === 0 ? (
              <EmptyState
                bare
                title="No applicant matches yet"
                description="Recalculate match scores to compare applicants with this opening's requirements."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    loading={rankCandidatesMutation.isPending}
                    onClick={() => rankCandidatesMutation.mutate()}
                  >
                    Recalculate match scores
                  </Button>
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <div className="inline-flex gap-1 bg-slate-200/60 p-1 text-sm font-medium" role="group" aria-label="Applicant filter">
                    {SEGMENT_FILTERS.map((id) => {
                      const count = id === "active" ? activeScores.length : id === "deployed" ? deployedScores.length : rankedScores.length;
                      const label = id === "active" ? "Active" : id === "deployed" ? "Deployed" : "All";
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={applicantFilter === id}
                          onClick={() => {
                            setApplicantFilter(id);
                            setCandidatePage(1);
                          }}
                          className={cn(
                            "min-h-11 px-3 py-1 transition-colors focus-ring md:min-h-8",
                            applicantFilter === id
                              ? "bg-white font-semibold text-navy shadow-xs"
                              : "text-slate-700 hover:text-slate-950"
                          )}
                        >
                          {`${label} (${count})`}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-sm text-slate-600">
                    Showing {filteredScores.length} of {rankedScores.length}
                  </p>
                </div>

                {filteredScores.length === 0 ? (
                  <EmptyState
                    bare
                    title={
                      applicantFilter === "active"
                        ? "No active applicants in the pipeline"
                        : applicantFilter === "deployed"
                        ? "No one deployed from this opening yet"
                        : "No applicants found"
                    }
                    description={
                      applicantFilter === "active" && deployedScores.length > 0
                        ? `All ${plural(deployedScores.length, "applicant")} ${deployedScores.length === 1 ? "has" : "have"} been deployed. Switch to Deployed or All to see them.`
                        : "Applicants appear here once they apply or are matched."
                    }
                    action={
                      applicantFilter === "active" && deployedScores.length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setApplicantFilter("deployed");
                            setCandidatePage(1);
                          }}
                        >
                          {`View deployed (${deployedScores.length})`}
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <>
                    <p className="px-4 pt-3 text-sm text-slate-600">
                      Match score combines skills, experience, location and pre-employment documents.
                    </p>
                    <DataTable
                      className="mt-3 border-0 border-t"
                      caption="Applicants ranked by match score"
                      columns={applicantColumns}
                      rows={pageRows}
                      getRowId={(row) => String(row.score.id)}
                      renderCard={renderApplicantCard}
                      cardsBelow="lg"
                      rowHref={(row) => `/ta/applications/${row.score.applicationId}`}
                      footer={
                        <Pagination
                          variant="inset"
                          currentPage={candidatePage}
                          totalPages={totalPages}
                          totalItems={filteredScores.length}
                          pageSize={candidatePageSize}
                          onPageChange={setCandidatePage}
                          itemLabel="candidates"
                        />
                      }
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Discovered Talent Pool Candidates */}
        {activeTab === "talentPool" && (
          <div id="job-talent-pool" role="tabpanel" tabIndex={0}>
            {talentPoolMatches.length > 0 && (
              <p className="px-4 pt-4 text-sm text-slate-600">
                Ranked by the same match score used for applications. Scores are a guide; you decide whom to invite.
                {unsearchablePoolCount > 0 &&
                  ` ${plural(unsearchablePoolCount, "candidate pool member")} can't be matched yet and ${unsearchablePoolCount === 1 ? "is" : "are"} not shown.`}
              </p>
            )}
            {talentPoolQuery.isLoading ? (
              <LoadingState variant="cards" />
            ) : talentPoolQuery.isError ? (
              <div className="p-4">
                <ErrorState subject="candidate pool matches" error={talentPoolQuery.error} onRetry={() => talentPoolQuery.refetch()} />
              </div>
            ) : talentPoolMatches.length === 0 ? (
              <EmptyState
                bare
                title="No candidate pool matches for this opening"
                description={
                  unsearchablePoolCount > 0
                    ? `${plural(unsearchablePoolCount, "candidate pool member")} can't be matched yet because ${unsearchablePoolCount === 1 ? "their profile is" : "their profiles are"} still being prepared. Try again later.`
                    : "No available pool member is close enough to this opening."
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                {talentPoolMatches.map((res) => {
                  const c = res.candidate;
                  const isAlreadyInPipeline =
                    rankedScores.some(
                      (r: any) =>
                        (Boolean(r.candidate?.id) && Boolean(c.id) && r.candidate?.id === c.id) ||
                        (Boolean(r.candidate?.email) && Boolean(c.email) && r.candidate?.email?.toLowerCase() === c.email?.toLowerCase())
                    ) ||
                    Boolean(
                      job?.applications?.some(
                        (application) =>
                          !application.isArchived &&
                          application.status !== ApplicationStatus.ARCHIVED &&
                          application.status !== ApplicationStatus.BACKOUT &&
                          application.status !== ApplicationStatus.REJECTED &&
                          (application.user?.id === c.id || application.user?.email?.toLowerCase() === c.email?.toLowerCase())
                      )
                    );

                  return (
                    <PoolCandidateCard
                      key={c.id}
                      result={res}
                      maxSkills={5}
                      actions={
                        <span className="ml-auto">
                          {isAlreadyInPipeline ? (
                            <span className="text-sm font-medium text-navy">In active pipeline</span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCandidateToInvite(c);
                                setInviteModalOpen(true);
                              }}
                            >
                              {TA_COPY.invitations.inviteToApply}
                            </Button>
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingClose}
        onClose={() => setPendingClose(false)}
        onConfirm={() => {
          setPendingClose(false);
          statusMutation.mutate(JobStatus.CLOSED);
        }}
        title="Close this opening?"
        description={`${plural(activeApplicantTotal, "applicant")} ${activeApplicantTotal === 1 ? "is" : "are"} still in the pipeline. Close this opening anyway?`}
        confirmLabel="Close opening"
        variant="warning"
      />

      {/* Edit Job Modal */}
      <Dialog
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setServerFieldErrors({});
        }}
        title="Edit job opening"
        description="Update the details applicants see."
        size="xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editTitle.trim()) return;

            const titleErr = validateStandardText(editTitle, "Title", { maxLength: 200 });
            if (titleErr) {
              notify.error("Check the highlighted fields", titleErr);
              return;
            }

            if (editLocation.trim()) {
              const locErr = validateStandardText(editLocation, "Location", { maxLength: 200 });
              if (locErr) {
                notify.error("Check the highlighted fields", locErr);
                return;
              }
            }

            if (editDescription.trim()) {
              const descErr = validateProseText(editDescription, "Description", { maxLength: 10000 });
              if (descErr) {
                notify.error("Check the highlighted fields", descErr);
                return;
              }
            }

            if (editRequirements.trim()) {
              const reqErr = validateProseText(editRequirements, "Requirements", { maxLength: 10000 });
              if (reqErr) {
                notify.error("Check the highlighted fields", reqErr);
                return;
              }
            }

            updateJobMutation.mutate({
              title: editTitle.trim(),
              location: editLocation.trim() || undefined,
              imageUrl: editImageUrl.trim() || undefined,
              description: editDescription.trim(),
              requirements: editRequirements.trim(),
              status: editStatus,
              isEvergreen: editIsEvergreen,
            });
          }}
          className="space-y-4"
        >
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="inline-flex gap-1 bg-slate-100 p-1 text-sm font-medium text-slate-700" role="group" aria-label="Form view">
              {(
                [
                  ["edit", "Edit details"],
                  ["preview", "Preview"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={editModalTab === id}
                  onClick={() => setEditModalTab(id)}
                  className={cn(
                    "min-h-11 px-3 py-1.5 transition-colors focus-ring md:min-h-9",
                    editModalTab === id ? "bg-white font-semibold text-navy shadow-xs" : "text-slate-700 hover:text-slate-950"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {editModalTab === "edit" ? (
            <div className="space-y-4">
              <Input
                label="Title"
                value={editTitle}
                error={serverFieldErrors.title}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  clearServerFieldError("title");
                }}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Input
                    label="Work site"
                    helperText={LOCATION_HINT}
                    value={editLocation}
                    error={serverFieldErrors.location}
                    onChange={(e) => {
                      setEditLocation(e.target.value);
                      clearServerFieldError("location");
                    }}
                  />
                  <FieldWarning show={locationLooksUnclear(editLocation)}>{LOCATION_UNCLEAR_WARNING}</FieldWarning>
                </div>
                <Input
                  label="Image web address (optional)"
                  placeholder="https://example.com/company-banner.jpg"
                  value={editImageUrl}
                  error={serverFieldErrors.imageUrl}
                  onChange={(e) => {
                    setEditImageUrl(e.target.value);
                    clearServerFieldError("imageUrl");
                  }}
                />
              </div>
              <Select
                label="Opening status"
                value={editStatus}
                error={serverFieldErrors.status}
                onChange={(e) => {
                  setEditStatus(e.target.value as JobStatus);
                  clearServerFieldError("status");
                }}
                options={[
                  { value: JobStatus.OPEN, label: "Open" },
                  { value: JobStatus.DRAFT, label: "Draft" },
                  { value: JobStatus.CLOSED, label: "Closed" },
                ]}
              />


              <Textarea
                label="Description and responsibilities"
                value={editDescription}
                error={serverFieldErrors.description}
                onChange={(e) => {
                  setEditDescription(e.target.value);
                  clearServerFieldError("description");
                }}
                rows={4}
                maxLength={10000}
                required
              />
              <Textarea
                label="Required skills and qualifications"
                value={editRequirements}
                error={serverFieldErrors.requirements}
                onChange={(e) => {
                  setEditRequirements(e.target.value);
                  clearServerFieldError("requirements");
                }}
                rows={4}
                maxLength={10000}
                required
              />

              {/* Keep Open After Fill Toggle */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex min-h-11 cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy focus-ring"
                    checked={editIsEvergreen}
                    onChange={(e) => setEditIsEvergreen(e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Keep open after positions are filled</span>
                    <span className="block text-xs leading-tight text-slate-600">
                      Leave this opening open for future applicants.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4 border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3 border-b border-slate-200 pb-3">
                  <JobImage src={editImageUrl} title={editTitle || "Job opening"} alt={editTitle || "Job opening"} size="md" />
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900">{editTitle || "Untitled job opening"}</h3>
                    <p className="text-sm text-slate-600">
                      {editLocation || "Philippines"} · {editStatus.charAt(0) + editStatus.slice(1).toLowerCase()}
                      {editIsEvergreen ? " · Always open" : ""}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
                  <div className="space-y-2 md:col-span-7">
                    <h4 className="text-sm font-semibold text-slate-800">Description and responsibilities</h4>
                    <div className="min-h-[160px] border border-slate-200 bg-white p-4">
                      {editDescription ? (
                        <JobContentRenderer content={editDescription} variant="ta" />
                      ) : (
                        <p className="text-sm italic text-slate-600">No description entered yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-5">
                    <h4 className="text-sm font-semibold text-slate-800">Required skills and qualifications</h4>
                    <div className="min-h-[160px] border border-slate-200 bg-white p-4">
                      {editRequirements ? (
                        <JobContentRenderer content={editRequirements} variant="ta" />
                      ) : (
                        <p className="text-sm italic text-slate-600">No requirements entered yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={updateJobMutation.isPending}>
              Save job opening
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Send Job Invitation Modal */}
      <SendInvitationModal
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setCandidateToInvite(null);
        }}
        candidate={candidateToInvite}
        targetJobId={Number(jobId)}
        targetJobTitle={job.title}
        onSend={(payload) => sendInvitationMutation.mutate(payload)}
        loading={sendInvitationMutation.isPending}
      />

      {/* Outgoing Invitations Tracker Drawer */}
      <InvitationsTrackerDrawer
        open={trackerDrawerOpen}
        onClose={() => setTrackerDrawerOpen(false)}
        jobPostingId={Number(jobId)}
      />
    </div>
  );
};
